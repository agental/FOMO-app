/* ============================================================================
   FOMO — import-events

   Pulls public events from phangan.events (WordPress REST API, one site that also
   covers Samui / Bangkok / Koh Tao) and upserts them into `events` as EXTERNAL
   events: shown like any event, but with a `external_url` "buy tickets" link
   instead of the join/approval flow.

   Lightweight on purpose (Edge Functions have a tight memory budget): NO supabase-js
   client — it upserts straight to PostgREST with fetch — and it processes ONE small
   page at a time so nothing large accumulates in memory.

   Deploy WITHOUT JWT verification, gate with a shared secret:
     supabase secrets set IMPORT_SECRET=<long-random-string>
   Call it (manually or from the weekly cron) with header  x-import-secret: <same>.

   Idempotent: upsert on (source, source_uid) — re-runs UPDATE existing rows and
   INSERT new ones. Past events are pruned by the existing auto-delete cron.
   ============================================================================ */

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const OWNER_ID = "e0000000-0000-4000-a000-000000000001"; // system "אירועי תאילנד" user (see migration)
const SITE = "https://phangan.events";
const SOURCE = "phangan.events";
const PER_PAGE = 20; // small pages → small peak memory

// AUTHORITATIVE city → the `event_type_2` taxonomy slug on each event (koh-phangan / bangkok / koh-tao …).
// The API has no GPS, so we place events at their region centre; per-venue/per-event spread() scatters them.
type Region = { city: string; lat: number; lng: number };
const REGIONS: Record<string, Region> = {
  "koh-phangan": { city: "קופנגן",     lat: 9.7500,  lng: 100.0136 },
  "phangan":     { city: "קופנגן",     lat: 9.7500,  lng: 100.0136 },
  "koh-samui":   { city: "קוסמוי",     lat: 9.5357,  lng: 100.0629 },
  "samui":       { city: "קוסמוי",     lat: 9.5357,  lng: 100.0629 },
  "koh-tao":     { city: "קוטאו",      lat: 10.0956, lng: 99.8405  },
  "bangkok":     { city: "בנגקוק",     lat: 13.7563, lng: 100.5018 },
  "phuket":      { city: "פוקט",       lat: 7.8804,  lng: 98.3923  },
  "pattaya":     { city: "פטאיה",      lat: 12.9236, lng: 100.8825 },
  "chiang-mai":  { city: "צ׳יאנג מאי", lat: 18.7883, lng: 98.9853  },
  "krabi":       { city: "קראבי",      lat: 8.0863,  lng: 98.9063  },
};
const DEFAULT_REGION: Region = REGIONS["koh-phangan"]; // the site's home base — only used if nothing matches

// Fallback ONLY when event_type_2 is missing/unknown: guess the region from venue/title text.
const KEYWORDS: { key: RegExp; slug: string }[] = [
  { key: /samui/i,               slug: "koh-samui" },
  { key: /bangkok|บางกอก/i,      slug: "bangkok" },
  { key: /koh[\s-]?tao|ko tao/i, slug: "koh-tao" },
  { key: /phuket/i,              slug: "phuket" },
  { key: /pattaya/i,             slug: "pattaya" },
  { key: /chiang[\s-]?mai/i,     slug: "chiang-mai" },
  { key: /krabi/i,               slug: "krabi" },
  { key: /phangan|pha-?ngan/i,   slug: "koh-phangan" },
];

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
}
function stripHtml(s: string): string {
  return decodeEntities((s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

// The real ticket link is usually an external URL inside the content; else fall back to the event page.
function ticketLink(contentHtml: string, eventLink: string): string {
  const hosts = /(entrix|ticketmelon|megatix|eventbrite|ra\.co|dice\.fm|zeevent|eventpop|ticketstripe|line\.me|wa\.me|whatsapp)/i;
  const hrefs = [...(contentHtml || "").matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]);
  const known = hrefs.find((u) => hosts.test(u));
  if (known) return known;
  const external = hrefs.find((u) => !/phangan\.events/i.test(u));
  return external || eventLink;
}

function regionOf(typeSlug: string, text: string): Region {
  if (typeSlug && REGIONS[typeSlug]) return REGIONS[typeSlug]; // authoritative
  const kw = KEYWORDS.find((k) => k.key.test(text));           // fallback guess
  return (kw && REGIONS[kw.slug]) || DEFAULT_REGION;
}

// The API exposes no per-event GPS (all events of a venue share one term), so we synthesize stable,
// spread-out points: each VENUE gets its own cluster around the island centre, each EVENT a small
// jitter — deterministic (hash-based) so re-imports keep the same spot and nothing stacks.
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function spread(center: { lat: number; lng: number }, venueKey: string, eventKey: string) {
  const vh = hash32(venueKey);
  const ang = (vh % 3600) / 3600 * Math.PI * 2;          // venue direction from centre
  const rad = 0.008 + ((vh >>> 12) % 1000) / 1000 * 0.045; // 0.008–0.053° (~0.9–5.9 km)
  const eh = hash32(eventKey);
  const jLat = (((eh & 0xffff) / 0xffff) - 0.5) * 0.003;  // ±~0.0015° (~150 m) per-event jitter
  const jLng = (((eh >>> 16) / 0xffff) - 0.5) * 0.003;
  return {
    lat: +(center.lat + Math.sin(ang) * rad + jLat).toFixed(6),
    lng: +(center.lng + Math.cos(ang) * rad + jLng).toFixed(6),
  };
}

// Upsert a batch straight to PostgREST (no supabase-js). merge-duplicates == ON CONFLICT DO UPDATE.
async function upsert(url: string, key: string, rows: Record<string, unknown>[]) {
  const res = await fetch(`${url}/rest/v1/events?on_conflict=source,source_uid`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`upsert ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  // trim both sides — a stray newline/space pasted into the dashboard secret field is the usual culprit.
  const secret = (Deno.env.get("IMPORT_SECRET") || "").trim();
  const provided = (req.headers.get("x-import-secret") || "").trim();
  if (secret && provided !== secret) {
    return json({ error: "forbidden", setLen: secret.length, gotLen: provided.length }, 403);
  }

  const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const nowSec = Math.floor(Date.now() / 1000);
  let upserted = 0, skipped = 0, page = 1;

  try {
    // Walk the WP REST API one small page at a time; upsert each page, then drop it.
    for (; page <= 30; page++) {
      const res = await fetch(
        `${SITE}/wp-json/wp/v2/ajde_events?per_page=${PER_PAGE}&_embed=1&page=${page}`,
        { headers: { "Accept": "application/json", "User-Agent": "FOMO-import/1.0" } },
      );
      if (res.status === 400 || res.status === 404) break; // past the last page
      if (!res.ok) return json({ error: `wp ${res.status}`, upserted, page }, 502);

      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;

      const rows: Record<string, unknown>[] = [];
      for (const ev of batch) {
        const startSec = Number(ev._unix_start_ev);
        if (!startSec || isNaN(startSec) || startSec < nowSec) { skipped++; continue; }

        const title = decodeEntities(ev?.title?.rendered || "").slice(0, 120) || "אירוע";
        const contentHtml = ev?.content?.rendered || "";
        const link = ev?.link || SITE;

        let venue = "", venueSlug = "", typeSlug = "";
        let termId = Array.isArray(ev?.event_location) && ev.event_location.length ? ev.event_location[0] : 0;
        const termGroups = ev?._embedded?.["wp:term"] || [];
        for (const g of termGroups) for (const t of (g || [])) {
          if (t?.taxonomy === "event_location") {
            if (t?.name) venue = decodeEntities(t.name);
            if (t?.slug) venueSlug = String(t.slug);
            if (!termId && t?.id) termId = t.id;
          } else if (t?.taxonomy === "event_type_2" && t?.slug) {
            typeSlug = String(t.slug); // the authoritative city tag (koh-phangan / bangkok / …)
          }
        }
        const img = ev?._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null;
        const place = regionOf(typeSlug, `${venue} ${venueSlug} ${title} ${link}`);
        const pt = spread(place, String(termId || venue || title), String(ev.id));

        rows.push({
          user_id: OWNER_ID,
          title,
          description: stripHtml(contentHtml).slice(0, 900),
          city: place.city,       // island/destination — the filterable "where" (קופנגן / קוסמוי / בנגקוק / קוטאו)
          address: venue || null, // specific venue name (e.g. "RETRO MOUNTAIN") shown as the location line
          country: "TH",
          event_date: new Date(startSec * 1000).toISOString(),
          latitude: pt.lat,
          longitude: pt.lng,
          event_type: "parties",
          emoji: "🎟️",
          image_url: img,
          attendees: [],
          max_attendees: 9999,
          is_private: false,
          is_external: true,
          external_url: ticketLink(contentHtml, link),
          source: SOURCE,
          source_uid: String(ev.id),
          has_group: false,
        });
      }

      if (rows.length) { await upsert(SUPA_URL, SERVICE, rows); upserted += rows.length; }
      if (batch.length < PER_PAGE) break; // last page
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e), upserted, page }, 500);
  }

  return json({ ok: true, upserted, skipped, pages: page });
});
