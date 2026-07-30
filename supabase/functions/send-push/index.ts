import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ============================================================================
   FOMO — send-push

   Sends a BACKGROUND / remote push notification (Expo Push API) when a new
   message is inserted. Invoked by two Supabase Database Webhooks:
     - INSERT on public.messages        (direct chats)
     - INSERT on public.group_messages  (city group chats)

   The app also shows LOCAL banners while it's OPEN (realtime → native bridge);
   this function is what reaches the user when the app is BACKGROUNDED/CLOSED.

   Deploy WITHOUT JWT verification (the webhook isn't a logged-in user), and gate
   it with a shared secret header instead:
     supabase functions deploy send-push --no-verify-jwt
     supabase secrets set PUSH_HOOK_SECRET=<some-long-random-string>
   Then add header `x-push-secret: <same string>` to BOTH database webhooks.
   ============================================================================ */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** ISO-3166 alpha-2 → flag emoji (regional indicator letters). */
function flagEmoji(iso2: string): string {
  const cc = (iso2 || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Short body preview, matching the in-app version. */
function preview(content: string | null | undefined, type?: string | null): string {
  if (type === "image") return "📷 תמונה";
  if (type === "location") return "📍 מיקום";
  const t = (content || "").trim();
  return t.length > 120 ? t.slice(0, 120) + "…" : t || "הודעה חדשה";
}

/** Push to Expo in batches of 100. Prunes tokens Expo reports as unregistered. */
async function sendExpo(
  admin: ReturnType<typeof createClient>,
  messages: { to: string; title: string; body: string; sound: "default" }[],
) {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(chunk),
      });
      const out = await res.json().catch(() => null) as { data?: { status: string; details?: { error?: string } }[] } | null;
      // Prune tokens Expo says are no longer valid, so we stop pushing to dead devices.
      const dead: string[] = [];
      out?.data?.forEach((r, idx) => {
        if (r?.status === "error" && r?.details?.error === "DeviceNotRegistered") dead.push(chunk[idx].to);
      });
      if (dead.length) await admin.from("push_tokens").delete().in("token", dead);
    } catch (e) {
      console.error("expo push failed:", e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Gate with a shared secret (the webhook sends it as a header).
  const secret = Deno.env.get("PUSH_HOOK_SECRET");
  if (secret && req.headers.get("x-push-secret") !== secret) return json({ error: "forbidden" }, 403);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  let payload: { table?: string; record?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const table = payload.table;
  const row = payload.record || {};

  // Collect recipient user ids + the notification title/body per message type.
  let recipientIds: string[] = [];
  let title = "FOMO";
  let body = "";

  if (table === "messages") {
    const senderId = row.sender_id as string;
    const convoId = row.conversation_id as string;
    if (!senderId || !convoId) return json({ skip: "missing dm fields" });

    const { data: convo } = await admin
      .from("conversations")
      .select("participant_1_id, participant_2_id")
      .eq("id", convoId)
      .maybeSingle();
    if (!convo) return json({ skip: "no conversation" });
    const otherId = convo.participant_1_id === senderId ? convo.participant_2_id : convo.participant_1_id;
    if (!otherId) return json({ skip: "no recipient" });

    const { data: sender } = await admin.from("users").select("display_name").eq("id", senderId).maybeSingle();
    recipientIds = [otherId as string];
    title = (sender?.display_name as string) || "הודעה חדשה";
    body = preview(row.content as string, row.type as string);
  } else if (table === "group_messages") {
    const senderId = row.user_id as string;
    const channelId = row.channel_id as string;
    if (row.type === "system" || !senderId || !channelId) return json({ skip: "group skip" });

    const { data: members } = await admin
      .from("group_members")
      .select("user_id, status")
      .eq("channel_id", channelId);
    recipientIds = (members || [])
      .filter((m) => m.status !== "left" && m.user_id !== senderId)
      .map((m) => m.user_id as string);
    if (recipientIds.length === 0) return json({ skip: "no group recipients" });

    const { data: ch } = await admin
      .from("group_channels")
      .select("city_name, city_emoji, country_code")
      .eq("id", channelId)
      .maybeSingle();
    title = [flagEmoji((ch?.country_code as string) || ""), (ch?.city_emoji as string) || "", (ch?.city_name as string) || "קבוצה"]
      .map((s) => (s || "").trim()).filter(Boolean).join(" ") || "קבוצה";
    body = `${(row.display_name as string) || "מישהו"}: ${preview(row.content as string, row.type as string)}`;
  } else {
    return json({ skip: "unknown table" });
  }

  // Resolve recipient user ids → device tokens.
  const { data: tokenRows } = await admin
    .from("push_tokens")
    .select("token")
    .in("user_id", recipientIds);
  const tokens = [...new Set((tokenRows || []).map((t) => t.token as string).filter(Boolean))];
  if (tokens.length === 0) return json({ sent: 0, reason: "no tokens" });

  await sendExpo(admin, tokens.map((to) => ({ to, title, body, sound: "default" as const })));
  return json({ sent: tokens.length });
});
