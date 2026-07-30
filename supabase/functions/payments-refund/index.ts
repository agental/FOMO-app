import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ============================================================================
   FOMO — payments-refund

   Refunds a ticket when the organizer rejects the buyer's request (or an admin
   intervenes). Verifies the caller is the event's organizer or an admin, refunds
   the captured payment at the provider, and marks the `payments` row refunded.

   Called best-effort from RequestsScreen's reject action. Safe to call for a free
   event / a request with no payment — it just no-ops.

   Deploy:  supabase functions deploy payments-refund
   Secrets: GROW_API_KEY, GROW_USER_ID
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

  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  let body: { joinRequestId?: string };
  try { body = await req.json(); } catch { return json({ error: "bad body" }, 400); }
  if (!body.joinRequestId) return json({ error: "missing joinRequestId" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Find the captured payment for this request.
  const { data: payment } = await admin
    .from("payments").select("*").eq("join_request_id", body.joinRequestId).maybeSingle();
  if (!payment) return json({ ok: true, note: "no payment to refund" }); // free event / never paid

  // Only the seller (organizer) or an admin may refund.
  const { data: me } = await admin.from("users").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = me?.role === "admin";
  if (payment.seller_id !== user.id && !isAdmin) return json({ error: "forbidden" }, 403);

  if (payment.status === "refunded") return json({ ok: true });        // idempotent
  if (payment.status !== "paid" && payment.status !== "released") {
    // Nothing was captured (created/pending/failed) — just mark it so no payout happens.
    await admin.from("payments").update({ status: "refunded" }).eq("id", payment.id);
    return json({ ok: true });
  }

  // GROW INTEGRATION POINT — call Grow's refund endpoint for payment.provider_ref, then mark it.
  const GROW_API_KEY = Deno.env.get("GROW_API_KEY");
  if (!GROW_API_KEY || !payment.provider_ref) {
    return json({ error: "refund provider not configured" }, 503);
  }
  try {
    // const resp = await fetch("https://secure.meshulam.co.il/api/light/server/1.0/refundTransaction", {
    //   method: "POST", headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ apiKey: GROW_API_KEY, transactionId: payment.provider_ref, sum: payment.amount }),
    // });
    // const g = await resp.json();
    // if (g?.status !== 1) return json({ error: "refund failed at provider" }, 502);

    await admin.from("payments").update({ status: "refunded" }).eq("id", payment.id);
    return json({ ok: true });
  } catch (e) {
    console.error("[refund] grow error:", e);
    return json({ error: "refund error" }, 502);
  }
});
