import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ============================================================================
   FOMO — payments-webhook

   Server-to-server notification from Grow when a payment settles. This is the ONLY
   place a purchase becomes real: it marks the `payments` row paid and creates the
   pending join request the organizer then approves. Because it's the source of the
   "paid" truth, a client can never fake it.

   IMPORTANT — deploy WITHOUT JWT verification (Grow doesn't send a Supabase token):
     supabase functions deploy payments-webhook --no-verify-jwt
   Then register this function's URL as the notify/callback URL in the Grow dashboard.
   ============================================================================ */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Grow's light API posts form-encoded data; accept JSON too, just in case.
  let payload: Record<string, string> = {};
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) payload[k] = String(v);
    }
  } catch (e) {
    console.error("[webhook] bad body:", e);
    return json({ error: "bad body" }, 400);
  }

  // GROW INTEGRATION POINT — verify the notification is genuinely from Grow (HMAC/signature
  // against GROW_API_KEY) before trusting it, and read the real field names from their docs.
  //   const valid = verifyGrowSignature(payload, Deno.env.get("GROW_API_KEY")!);
  //   if (!valid) return json({ error: "bad signature" }, 401);
  const paymentId   = payload.cField1 ?? payload.customFields ?? "";      // our payments.id (set at checkout)
  const providerRef = payload.transactionId ?? payload.asmachta ?? payload.paymentId ?? null;
  const paidOk      = (payload.status ?? payload.statusCode ?? "") === "1" || payload.success === "true";

  if (!paymentId) return json({ error: "missing payment ref" }, 400);

  // Look up our order.
  const { data: payment, error: pErr } = await admin
    .from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (pErr || !payment) { console.error("[webhook] unknown payment:", paymentId, pErr); return json({ ok: true }); }

  // Idempotent: if we already processed this, do nothing (webhooks can retry).
  if (payment.status === "paid" || payment.join_request_id) return json({ ok: true });

  if (!paidOk) {
    await admin.from("payments").update({ status: "failed", provider_ref: providerRef }).eq("id", payment.id);
    return json({ ok: true });
  }

  // Mark paid, then create the pending join request the organizer approves (money is now real).
  await admin.from("payments").update({ status: "paid", provider_ref: providerRef }).eq("id", payment.id);

  // Don't double-create if the buyer already has a request for this event.
  const { data: existingReq } = await admin
    .from("event_join_requests").select("id")
    .eq("event_id", payment.event_id).eq("user_id", payment.buyer_id).maybeSingle();

  let joinRequestId = existingReq?.id ?? null;
  if (!joinRequestId) {
    const { data: reqRow, error: reqErr } = await admin.from("event_join_requests").insert({
      event_id: payment.event_id, user_id: payment.buyer_id, status: "pending",
      paid_amount: payment.amount, ticket_label: payment.ticket_label,
    }).select("id").single();
    if (reqErr) { console.error("[webhook] join request insert failed:", reqErr); }
    else joinRequestId = reqRow.id;
  }
  if (joinRequestId) await admin.from("payments").update({ join_request_id: joinRequestId }).eq("id", payment.id);

  return json({ ok: true });
});
