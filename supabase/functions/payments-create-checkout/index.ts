import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ============================================================================
   FOMO — payments-create-checkout

   Creates a checkout session for a ticket purchase and returns the provider's
   hosted payment-page URL. Security-critical points:
     - The unit price is looked up SERVER-SIDE from the event's ticket_types, never
       taken from the client — a tampered client can't pay less than the real price.
     - A `payments` row is written with the service role (the client can't).
     - The split (seller share vs platform fee) is computed here, so the money is
       divided correctly at the provider.

   Deploy:  supabase functions deploy payments-create-checkout
   Secrets: GROW_API_KEY, GROW_USER_ID  (Supabase URL / keys are injected)
   ============================================================================ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PLATFORM_FEE_PCT = 0.10; // FOMO's cut — keep in sync with BookingFlow's display

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Identify the buyer.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: "יש להתחבר כדי לרכוש כרטיס." }, 401);

  let body: { eventId?: string; ticketLabel?: string; quantity?: number };
  try { body = await req.json(); } catch { return json({ error: "בקשה לא תקינה." }, 400); }
  const { eventId, ticketLabel } = body;
  const quantity = Math.max(1, Math.min(10, Number(body.quantity) || 1));
  if (!eventId) return json({ error: "חסר מזהה אירוע." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 2. Load the event and derive the REAL price server-side.
  const { data: event, error: evErr } = await admin
    .from("events").select("id, user_id, title, event_date, price, ticket_types").eq("id", eventId).maybeSingle();
  if (evErr || !event) return json({ error: "האירוע לא נמצא." }, 404);
  if (event.user_id === user.id) return json({ error: "לא ניתן לקנות כרטיס לאירוע שיצרת." }, 400);

  const tickets = Array.isArray(event.ticket_types) ? event.ticket_types : [];
  const chosen = tickets.find((t: { name?: string }) => t?.name === ticketLabel);
  const unitPrice = Number(chosen?.price ?? event.price ?? 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return json({ error: "האירוע אינו בתשלום." }, 400);

  // 3. The organizer must have an active payout account.
  const { data: seller } = await admin
    .from("seller_accounts").select("account_id, status, payouts_enabled").eq("user_id", event.user_id).maybeSingle();
  if (!seller || seller.status !== "active" || !seller.payouts_enabled) {
    return json({ error: "המארגן עדיין לא חיבר חשבון תשלומים. נסה שוב מאוחר יותר." }, 409);
  }

  // 4. Split: buyer pays subtotal + fee; seller receives subtotal; platform keeps the fee.
  const subtotal = Math.round(unitPrice * quantity);
  const platformFee = Math.round(subtotal * PLATFORM_FEE_PCT);
  const total = subtotal + platformFee;

  // 5. Record the order (source of truth) before sending the buyer to pay.
  const { data: payment, error: payErr } = await admin.from("payments").insert({
    event_id: event.id, buyer_id: user.id, seller_id: event.user_id,
    ticket_label: ticketLabel ?? null, quantity,
    amount: total, platform_fee: platformFee, seller_amount: subtotal,
    currency: "ILS", provider: "grow", status: "created",
    hold_until: event.event_date ?? null,
  }).select("id").single();
  if (payErr || !payment) {
    console.error("[create-checkout] payment insert failed:", payErr);
    return json({ error: "שגיאה ביצירת ההזמנה." }, 500);
  }

  // 6. GROW INTEGRATION POINT — open a hosted payment page with the split, tagging our
  //    payment id so the webhook can match it back.
  const GROW_API_KEY = Deno.env.get("GROW_API_KEY");
  const GROW_USER_ID = Deno.env.get("GROW_USER_ID");
  if (!GROW_API_KEY || !GROW_USER_ID) {
    return json({ error: "שירות הסליקה עדיין לא הוגדר. הוסף את מפתחות Grow ופרוס מחדש.", paymentId: payment.id });
  }

  try {
    const origin = req.headers.get("origin") ?? "https://fomo-tal.netlify.app";

    // TODO(grow): call Grow/Meshulam's "createPaymentProcess" with:
    //   - sum: total (agorot → total*100), description: event.title
    //   - the sub-seller id (seller.account_id) + platform fee, for the marketplace split
    //   - cField1: payment.id  (so payments-webhook can find this order)
    //   - successUrl / cancelUrl: `${origin}` , notifyUrl: the payments-webhook URL
    //
    //   const resp = await fetch("https://secure.meshulam.co.il/api/light/server/1.0/createPaymentProcess", {
    //     method: "POST", headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       apiKey: GROW_API_KEY, userId: GROW_USER_ID,
    //       sum: total, description: `כרטיס ל${event.title}`,
    //       subSellerId: seller.account_id, marketplaceFee: platformFee,
    //       cField1: payment.id, successUrl: origin, cancelUrl: origin,
    //     }),
    //   });
    //   const g = await resp.json();
    //   const url = g?.data?.url;
    //   if (!url) return json({ error: "ספק הסליקה החזיר תשובה לא צפויה." }, 502);
    //   await admin.from("payments").update({ status: "pending" }).eq("id", payment.id);
    //   return json({ url, paymentId: payment.id });

    void origin; void total;
    return json({ error: "אינטגרציית Grow ממתינה להשלמת פרטי החשבון (endpoint + מפתחות).", paymentId: payment.id });
  } catch (e) {
    console.error("[create-checkout] grow error:", e);
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return json({ error: "שגיאה בפתיחת התשלום. נסה שוב." }, 502);
  }
});
