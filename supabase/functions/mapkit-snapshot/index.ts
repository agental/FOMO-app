/* ============================================================================
   FOMO — mapkit-snapshot

   Returns a REAL Apple Maps static image (PNG) for a shared location, so chat /
   group "shared location" bubbles show an actual map instead of a placeholder.

   Why a server proxy (and not an <img> straight to Apple):
     • Apple's Snapshot Web API (snapshot.apple-mapkit.com) authorizes with the
       SAME ES256 JWT as MapKit JS. But our normal MapKit token is ORIGIN-locked
       (MAPKIT_ORIGIN), and a browser never sends an Origin header on an <img>
       GET → Apple rejects it (ORIGIN_CHECK_FAILURE, actual: null).
     • So here we mint a token WITHOUT the origin claim, call Apple server-side,
       and stream the PNG back. The unrestricted token never reaches the client.

   Uses the same secrets as mapkit-token:
     MAPKIT_KEY_ID, MAPKIT_TEAM_ID, MAPKIT_PRIVATE_KEY
   Deploy WITHOUT JWT verification (an <img> can't send the anon apikey header).
   ============================================================================ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// A MapKit JWT WITHOUT the origin claim (so a server-side snapshot call passes the origin check).
async function mintOriginlessToken(): Promise<string> {
  const keyId = (Deno.env.get("MAPKIT_KEY_ID") || "").trim();
  const teamId = (Deno.env.get("MAPKIT_TEAM_ID") || "").trim();
  const pem = Deno.env.get("MAPKIT_PRIVATE_KEY") || "";
  if (!keyId || !teamId || !pem) throw new Error("missing MAPKIT_KEY_ID / MAPKIT_TEAM_ID / MAPKIT_PRIVATE_KEY");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: teamId, iat: now, exp: now + 60 * 30 };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

const clampNum = (v: string | null, def: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = new URL(req.url);
    const lat = Number(u.searchParams.get("lat"));
    const lng = Number(u.searchParams.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new Response(JSON.stringify({ error: "lat/lng required" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    const w = clampNum(u.searchParams.get("w"), 460, 120, 640);
    const h = clampNum(u.searchParams.get("h"), 320, 120, 640);
    const z = clampNum(u.searchParams.get("z"), 15, 3, 20);
    const color = (u.searchParams.get("color") || "f97316").replace(/[^0-9a-fA-F]/g, "").slice(0, 6) || "f97316";

    const token = await mintOriginlessToken();
    const params = new URLSearchParams();
    params.set("center", `${lat.toFixed(6)},${lng.toFixed(6)}`);
    params.set("z", String(z));
    params.set("size", `${w}x${h}`);
    params.set("scale", "2");
    params.set("t", "standard");
    params.set("colorScheme", "light");
    params.set("lang", "he");
    params.set("annotations", JSON.stringify([{ point: `${lat.toFixed(6)},${lng.toFixed(6)}`, color, markerStyle: "large" }]));
    params.set("token", token);

    const appleUrl = `https://snapshot.apple-mapkit.com/api/v1/snapshot?${params.toString()}`;
    const res = await fetch(appleUrl);
    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: "apple snapshot failed", status: res.status, body: body.slice(0, 300) }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        ...CORS,
        "Content-Type": res.headers.get("Content-Type") || "image/png",
        // Snapshots for a fixed coordinate never change → cache hard (CDN + browser).
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
