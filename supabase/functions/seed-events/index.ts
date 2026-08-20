/*
  seed-events — keeps the app feeling ALIVE by topping up each backpacker hub to ~6 believable,
  non-repeating private events, hosted by fake Israeli "seed" users. All content is OURS (zero
  copyright). Private events + a bot host that never approves → real users see the permanent
  "⏳ ממתין לאישור המארגן" (or "האירוע מלא") state = FOMO, with no real logistics.

  Safe: creating an event fires NO push (only chat messages do). Real users are never notified.

  Setup (once):
    1. Run migration 20260802000000_seed_events_infra.sql in the SQL Editor (adds is_seed/seed_key
       columns + ~25 seed users). This function reads those seed users as hosts + attendee-fillers.
    2. supabase functions deploy seed-events
    3. supabase secrets set SEED_SECRET=<pick-a-long-random-string>
  Run (manual, Phase 1): POST with header  x-seed-secret: <SEED_SECRET>
  Automate (Phase 3): a weekly pg_cron + pg_net call to this URL with the same header.

  Idempotent top-up: only adds what's missing (never exceeds ~6/hub) and won't reuse a template
  (seed_key) that's already live for that hub, so the set stays fresh and non-repeating.
*/
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const TARGET_PER_HUB = 6;
const DAYS_AHEAD = 8; // spread events across roughly the coming week

// ── Destinations (backpacker hubs with a big Israeli crowd) ──────────────────────────────────────
type Spot = { name: string; lat: number; lng: number };
type Hub = { country: string; city: string; utcOffsetH: number; subSpots: Spot[] };
const DESTINATIONS: Hub[] = [
  { country: "TH", city: "קו פנגן", utcOffsetH: 7, subSpots: [
    { name: "Haad Rin", lat: 9.6743, lng: 100.0687 },
    { name: "Secret Beach", lat: 9.7539, lng: 99.9560 },
    { name: "Haad Yao", lat: 9.7726, lng: 99.9583 },
    { name: "Thong Sala", lat: 9.7118, lng: 99.9856 },
    { name: "Srithanu", lat: 9.7620, lng: 99.9700 },
  ]},
  { country: "TH", city: "פאי", utcOffsetH: 7, subSpots: [
    { name: "Walking Street", lat: 19.3583, lng: 98.4407 },
    { name: "Pai Canyon", lat: 19.3300, lng: 98.4700 },
    { name: "Bamboo Bridge", lat: 19.3100, lng: 98.4200 },
    { name: "Pam Bok Waterfall", lat: 19.3400, lng: 98.4000 },
  ]},
  { country: "PH", city: "סיארגאו", utcOffsetH: 8, subSpots: [
    { name: "Cloud 9", lat: 9.8140, lng: 126.1670 },
    { name: "General Luna", lat: 9.7870, lng: 126.1590 },
    { name: "Pacifico", lat: 9.9330, lng: 126.1170 },
    { name: "Maasin River", lat: 9.8500, lng: 126.0500 },
  ]},
  { country: "IN", city: "כסול", utcOffsetH: 5.5, subSpots: [
    { name: "Chalal", lat: 32.0140, lng: 77.3200 },
    { name: "Kasol Market", lat: 32.0100, lng: 77.3150 },
    { name: "Riverside", lat: 32.0090, lng: 77.3100 },
    { name: "Tosh Road", lat: 32.0000, lng: 77.3400 },
  ]},
  { country: "IN", city: "גואה", utcOffsetH: 5.5, subSpots: [
    { name: "Anjuna", lat: 15.5870, lng: 73.7440 },
    { name: "Arambol", lat: 15.6870, lng: 73.7040 },
    { name: "Palolem", lat: 15.0100, lng: 74.0230 },
    { name: "Vagator", lat: 15.5990, lng: 73.7380 },
  ]},
  { country: "IN", city: "רישיקש", utcOffsetH: 5.5, subSpots: [
    { name: "Laxman Jhula", lat: 30.1280, lng: 78.3300 },
    { name: "Tapovan", lat: 30.1300, lng: 78.3200 },
    { name: "Ganga Beach", lat: 30.1100, lng: 78.3300 },
  ]},
];

// ── Templates (each key = one template; many title/description variants → non-repeating) ──────────
type Category = "parties" | "workshops";
type Template = {
  id: string; category: Category; emoji: string; localHour: number;
  titles: string[]; descs: string[]; maxRange: [number, number];
};
const TEMPLATES: Template[] = [
  { id: "villa", category: "parties", emoji: "🏠", localHour: 22, maxRange: [18, 30], titles: [
      "מסיבת וילה על ההר", "Villa Sunset Session", "מסיבת גג פרטית", "House Party · בריכה וטבע", "מסיבת וילה — לילה לבן",
    ], descs: [
      "וילה מטורפת עם נוף, מוזיקה טובה וחבר׳ה. מגיעים?", "סאונד סיסטם, בריכה, ואנשים מהממים. כניסה מוגבלת.",
      "ערב אינטימי בווילה — טבע, אור נרות, וסט של דיפ האוס.", "מסיבת בית קטנה ואיכותית. מביאים טוב מצב רוח בלבד.",
    ]},
  { id: "pool", category: "parties", emoji: "🏊", localHour: 15, maxRange: [22, 36], titles: [
      "Pool Party צהריים", "מסיבת בריכה + דיג׳יי", "Splash · מסיבת בריכה", "מסיבת בריכה על השקיעה", "Daytime Pool Vibes",
    ], descs: [
      "שמש, מים, ומוזיקה. הכי כיף של השבוע.", "בריכת אינפיניטי, קוקטיילים וסט חמים. בואו רטובים.",
      "מתחילים בצהריים וממשיכים לשקיעה. פלמינגו מתנפחים כלולים.", "מסיבת בריכה קלאסית עם הכי טוב מהחבר׳ה.",
    ]},
  { id: "trance", category: "parties", emoji: "🌀", localHour: 23, maxRange: [24, 40], titles: [
      "Trance Night ביער", "מסיבת טראנס תת-קרקעית", "Psy Journey", "Full Moon Trance", "Open Air · Progressive",
    ], descs: [
      "לילה של פסיי-טראנס עם ליינאפ מקומי. אנרגיה אחרת.", "מסיבת אופן-אייר בין העצים. דקורציות, לייזרים, וסאונד נקי.",
      "מסע של כמה שעות — פרוגרסיב עד זריחה.", "טראנס מתחת לכוכבים. מגיעים עם לב פתוח.",
    ]},
  { id: "beach", category: "parties", emoji: "🔥", localHour: 21, maxRange: [26, 44], titles: [
      "Beach Bonfire Party", "מסיבת חוף עם מדורה", "Sunset Beach Session", "מסיבת חוף — תופים ואש", "Fire Show on the Beach",
    ], descs: [
      "מדורה על החוף, תופים, וסט של אורגני האוס. קלאסיקה.", "בירה קרה, גלים ברקע, ומוזיקה טובה. הכי תרמילאי שיש.",
      "מופע אש, ג׳אם של תופים, וריקודים על החול.", "שקיעה, מדורה, וחבר׳ה — ערב חוף מושלם.",
    ]},
  { id: "yoga", category: "workshops", emoji: "🧘", localHour: 8, maxRange: [10, 18], titles: [
      "יוגה בזריחה", "Sunrise Vinyasa", "סדנת יוגה על החוף", "Morning Flow", "יוגה + מדיטציה מודרכת",
    ], descs: [
      "שיעור בוקר רגוע מול הים. מתאים לכל הרמות. מביאים מזרן.", "וינייאסה זורמת לפתוח את היום. מקומות מוגבלים.",
      "נשימה, תנועה, ושקט — בזריחה הכי יפה.", "פותחים את הבוקר ביוגה עדינה ומדיטציה קצרה.",
    ]},
  { id: "breath", category: "workshops", emoji: "🌬️", localHour: 9, maxRange: [8, 16], titles: [
      "סדנת נשימות", "Breathwork Journey", "מעגל נשימה ושחרור", "Conscious Breathing", "נשימה מעגלית + סאונד",
    ], descs: [
      "מסע נשימה מעצים לשחרור מתחים. חוויה עוצמתית.", "טכניקת נשימה מעגלית עם ליווי סאונד. הביאו שמיכה.",
      "שעה וחצי של נשימה מודעת — מרגישים אחרי אחרת לגמרי.", "מעגל נשימה אינטימי לשחרור ואיפוס.",
    ]},
];

// ── Cover images per template (curated free Pexels stock, hotlink-allowed, no API key, hi-res) ────
const px = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
const IMAGE_IDS: Record<string, number[]> = {
  villa:  [30505259, 30505255, 752484, 30421147],
  pool:   [33832436, 7294042, 4307128, 7294267, 7294545, 7294598, 7294660],
  trance: [35120748, 35120756, 5143166, 15204410, 3808102, 33588956],
  beach:  [2975690, 3986698, 1685966, 1552173, 9059674, 12169332],
  yoga:   [846309, 5928340, 1828171, 9154500, 104309],
  breath: [3822622, 3822621, 3822864, 3544322],
};

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sample<T>(arr: T[], n: number): T[] { return shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length))); }
// UTC instant for a local hour at the hub, `daysAhead` from now, with a little jitter.
// Guarantees the result is in the FUTURE (a "today" event whose local hour already passed would
// otherwise land in the past → hidden by the event_date>=now filter and instantly deletable).
function eventDateISO(daysAhead: number, localHour: number, offsetH: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  const minutes = pick([0, 15, 30, 45]);
  d.setUTCHours(Math.round(localHour - offsetH), minutes, 0, 0);
  while (d.getTime() <= Date.now() + 60 * 60 * 1000) d.setUTCDate(d.getUTCDate() + 1); // ≥1h ahead
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("SEED_SECRET");
  if (!secret || req.headers.get("x-seed-secret") !== secret) return json({ error: "forbidden" }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Seed users act as BOTH hosts and the attendee-filler pool.
  const { data: seeds, error: seedErr } = await admin.from("users").select("id").eq("is_seed", true);
  if (seedErr) return json({ error: "load seeds failed", detail: seedErr.message }, 500);
  const seedIds: string[] = (seeds || []).map((u: { id: string }) => u.id);
  if (seedIds.length < 5) return json({ error: "no seed users — run 20260802000000_seed_events_infra.sql first" }, 400);

  // Admin-curated image overrides per template (seed_key). When an admin replaces a seed event's
  // cover in the app, it's saved here — so we REUSE that image for this template from now on ("learn").
  const { data: ovRows } = await admin.from("seed_image_overrides").select("seed_key,image_url");
  const overrides = new Map<string, string>(
    (ovRows || []).map((r: { seed_key: string; image_url: string }) => [r.seed_key, r.image_url]),
  );

  const nowISO = new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  const perHub: Record<string, number> = {};

  for (const hub of DESTINATIONS) {
    // What's already live for this hub → how many to add, and which templates to avoid repeating.
    const { data: existing } = await admin
      .from("events").select("seed_key")
      .eq("is_seed", true).eq("city", hub.city).gte("event_date", nowISO);
    const liveKeys = new Set((existing || []).map((e: { seed_key: string | null }) => e.seed_key).filter(Boolean));
    const toCreate = Math.max(0, TARGET_PER_HUB - (existing?.length || 0));
    perHub[hub.city] = toCreate;
    if (toCreate === 0) continue;

    // Candidate (template × variant) keys not already live → shuffle → take what we need.
    const candidates: { tpl: Template; vi: number; key: string }[] = [];
    for (const tpl of TEMPLATES) {
      const n = Math.min(tpl.titles.length, tpl.descs.length);
      for (let vi = 0; vi < n; vi++) candidates.push({ tpl, vi, key: `${tpl.id}:${vi}` });
    }
    const fresh = shuffle(candidates.filter((c) => !liveKeys.has(c.key)));
    const chosen = (fresh.length >= toCreate ? fresh : [...fresh, ...shuffle(candidates)]).slice(0, toCreate);

    for (const c of chosen) {
      const { tpl, vi, key } = c;
      const host = pick(seedIds);
      const pool = seedIds.filter((id) => id !== host);
      const spot = pick(hub.subSpots);
      const isFull = Math.random() < 0.4;
      const maxAttendees = randInt(tpl.maxRange[0], tpl.maxRange[1]);
      const goingCount = isFull
        ? Math.min(maxAttendees, pool.length)           // full → attendees == max (button shows "האירוע מלא")
        : Math.min(randInt(Math.ceil(maxAttendees * 0.4), maxAttendees - 1), pool.length); // partial → spots left
      const attendees = sample(pool, goingCount);
      // If we couldn't fill to max (only ~24 seed users), cap max so the "full" ones still read as full.
      const finalMax = isFull ? attendees.length : maxAttendees;

      rows.push({
        user_id: host,
        title: tpl.titles[vi],
        description: tpl.descs[vi],
        image_url: overrides.get(key) ?? (IMAGE_IDS[tpl.id]?.length ? px(pick(IMAGE_IDS[tpl.id])) : null),
        country: hub.country,
        city: hub.city,
        address: `${spot.name}, ${hub.city}`,
        latitude: spot.lat + (Math.random() - 0.5) * 0.004,
        longitude: spot.lng + (Math.random() - 0.5) * 0.004,
        event_date: eventDateISO(randInt(0, DAYS_AHEAD), tpl.localHour, hub.utcOffsetH),
        event_type: tpl.category,
        emoji: tpl.emoji,
        max_attendees: Math.max(finalMax, 1),
        attendees,
        is_private: true,
        is_seed: true,
        seed_key: key,
        created_at: new Date(Date.now() - randInt(0, 6 * 24 * 60) * 60 * 1000).toISOString(), // staggered "posted X ago"
      });
    }
  }

  if (rows.length === 0) return json({ ok: true, message: "all hubs already full", perHub });
  const { error: insErr, count } = await admin.from("events").insert(rows, { count: "exact" });
  if (insErr) return json({ error: "insert failed", detail: insErr.message }, 500);
  return json({ ok: true, inserted: count ?? rows.length, perHub });
});
