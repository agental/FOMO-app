import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ============================================================================
   FOMO — payments-onboard-seller

   Starts (or resumes) an organizer's payout onboarding at the payment provider
   (Grow / Meshulam). Flow:
     1. Identify the caller from their JWT.
     2. Ensure a seller_accounts row exists (service role — the client can't write it).
     3. Ask Grow to create/fetch a sub-seller and return a hosted KYC/onboarding URL.
     4. Return that URL; the client opens it in the system browser.

   The raw IBAN / ID are entered on Grow's hosted page, never here. We store only the
   resulting sub-seller id + status.

   Deploy:  supabase functions deploy payments-onboard-seller
   Secrets: supabase secrets set GROW_API_KEY=... GROW_USER_ID=...
   (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
   ============================================================================ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Who is calling? (verified from their JWT)
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: "יש להתחבר כדי לחבר חשבון תשלומים." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 2. Ensure a (pending) seller account row exists — this part is real and works today.
  let { data: account } = await admin
    .from("seller_accounts").select("*").eq("user_id", user.id).maybeSingle();
  if (!account) {
    const { data: created, error: insErr } = await admin
      .from("seller_accounts")
      .insert({ user_id: user.id, provider: "grow", status: "pending" })
      .select("*").single();
    if (insErr) {
      console.error("[onboard-seller] insert failed:", insErr);
      return json({ error: "שגיאה ביצירת חשבון תשלומים." }, 500);
    }
    account = created;
  }

  // 3. GROW INTEGRATION POINT — needs the real account + keys.
  const GROW_API_KEY = Deno.env.get("GROW_API_KEY");
  const GROW_USER_ID = Deno.env.get("GROW_USER_ID");
  if (!GROW_API_KEY || !GROW_USER_ID) {
    // Not configured yet: the row is created, but there's no provider to onboard against.
    return json({ error: "שירות הסליקה עדיין לא הוגדר. הוסף את מפתחות Grow ופרוס מחדש." });
  }

  try {
    const origin = req.headers.get("origin") ?? "https://fomo-tal.netlify.app";

    // TODO(grow): replace with Grow/Meshulam's real marketplace sub-seller onboarding call.
    // It should create (or fetch) a sub-seller under GROW_USER_ID for `user`, and return a
    // hosted KYC URL that redirects back to `origin` when finished. Then persist the sub-seller
    // id + onboarding URL onto the row:
    //
    //   const resp = await fetch("https://secure.meshulam.co.il/api/light/server/1.0/createSubSeller", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       apiKey: GROW_API_KEY, userId: GROW_USER_ID,
    //       sellerEmail: user.email, returnUrl: origin,
    //     }),
    //   });
    //   const g = await resp.json();
    //   const url = g?.data?.url;
    //   const subSellerId = g?.data?.sellerId;
    //   if (!url) return json({ error: "ספק הסליקה החזיר תשובה לא צפויה." }, 502);
    //   await admin.from("seller_accounts")
    //     .update({ account_id: String(subSellerId), details: { ...account.details, onboarding_url: url } })
    //     .eq("id", account.id);
    //   return json({ url });

    void origin;
    return json({ error: "אינטגרציית Grow ממתינה להשלמת פרטי החשבון (endpoint + מפתחות)." });
  } catch (e) {
    console.error("[onboard-seller] grow error:", e);
    return json({ error: "שגיאה בחיבור לספק הסליקה. נסה שוב." }, 502);
  }
});
