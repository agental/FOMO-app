/* ============================================================================
   FOMO — mapkit-token

   Mints a short-lived MapKit JS token (an ES256-signed JWT) so the web app can
   load Apple Maps. MapKit JS will NOT render without this — mapkit.init() calls
   an authorizationCallback that fetches this token.

   Secrets to set (Supabase → Edge Functions → Secrets):
     MAPKIT_KEY_ID       - the 10-char Key ID of your MapKit JS key
     MAPKIT_TEAM_ID      - your 10-char Apple Developer Team ID
     MAPKIT_PRIVATE_KEY  - the FULL contents of the AuthKey_XXXX.p8 file
                           (including the -----BEGIN PRIVATE KEY----- lines)
     MAPKIT_ORIGIN       - (optional) e.g. https://fomo-tal.netlify.app
                           restricts the token to that web origin. Leave empty
                           during dev (Expo Go loads from a LAN IP origin).

   Deploy WITHOUT JWT verification (it's a public token endpoint; the token is
   short-lived and, when MAPKIT_ORIGIN is set, origin-restricted).
   ============================================================================ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The .p8 is a PKCS#8 PEM. Strip the header/footer + whitespace and base64-decode to DER.
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\\n/g, "")   // in case the secret was stored with literal \n
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function mintToken(): Promise<string> {
  const keyId = (Deno.env.get("MAPKIT_KEY_ID") || "").trim();
  const teamId = (Deno.env.get("MAPKIT_TEAM_ID") || "").trim();
  const pem = Deno.env.get("MAPKIT_PRIVATE_KEY") || "";
  const origin = (Deno.env.get("MAPKIT_ORIGIN") || "").trim();
  if (!keyId || !teamId || !pem) throw new Error("missing MAPKIT_KEY_ID / MAPKIT_TEAM_ID / MAPKIT_PRIVATE_KEY");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload: Record<string, unknown> = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 30, // 30 min (MapKit re-fetches via the authorizationCallback as needed)
  };
  if (origin) payload.origin = origin;

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // crypto.subtle returns the ES256 signature already in the JOSE r||s (64-byte) form JWT expects.
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = await mintToken();
    // Plain text — MapKit's authorizationCallback wants the raw token string.
    return new Response(token, {
      headers: { ...CORS, "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
