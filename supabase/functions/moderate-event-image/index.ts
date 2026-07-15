import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ approved: true, reason: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let base64Image: string, mediaType: string;
  try {
    const body = await req.json();
    base64Image = body.image;      // base64 string (no data: prefix)
    mediaType = body.mediaType ?? "image/jpeg";
  } catch {
    return new Response(JSON.stringify({ approved: false, reason: "בקשה לא תקינה" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = `You are a content moderator for FOMO — a social events app.
Review this image and decide if it's suitable as an event cover photo.

APPROVE if the image shows:
- People at social events, parties, gatherings
- Outdoor activities, nature, trips, food & dining
- Concerts, sports, workshops, cultural events
- Venues, locations, or atmospheres that match a social event
- Any photo that would look good as an event invitation

REJECT if the image is:
- A screenshot of a phone, app, text message, or website
- A meme, flyer with excessive text, or digital graphic
- Explicit, violent, or offensive content
- An extremely dark, blurry, or unrecognizable photo
- A completely irrelevant image (e.g., a document, spreadsheet, logo)

Respond ONLY with a JSON object in this exact format:
{"approved": true} or {"approved": false, "reason": "קצר הסבר בעברית למה נדחה (1 משפט)"}`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      // If Claude is unreachable, approve by default (don't block uploads)
      console.error("Anthropic API error:", resp.status, await resp.text());
      return new Response(JSON.stringify({ approved: true, reason: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text?.trim() ?? "";

    // Parse JSON from Claude's response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback — approve if we can't parse
    return new Response(JSON.stringify({ approved: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-event-image error:", e);
    // Fail open — don't block uploads if moderation crashes
    return new Response(JSON.stringify({ approved: true, reason: "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
