import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlaceData {
  placeId: string;
  placeName: string;
  placeAddress: string;
  rating?: number | null;
  reviewCount?: number | null;
  photoUrl?: string | null;
  photos?: string[];
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  website?: string;
  phone?: string;
  types?: string[];
  openNow?: boolean;
}

interface PlaceResult {
  raw: PlaceData;
  photoRefs: string[];
}

async function resolveRedirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return response.url;
  } catch {
    try {
      const response = await fetch(url, { method: "GET", redirect: "follow" });
      return response.url;
    } catch {
      return url;
    }
  }
}

function extractFromUrl(url: string): { placeId?: string; lat?: number; lng?: number; query?: string } | null {
  try {
    const placeIdMatch = url.match(/[?&]place_id=([^&]+)/);
    if (placeIdMatch) return { placeId: decodeURIComponent(placeIdMatch[1]) };

    const coordsAtSign = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),\d+/);
    const placeRoute = url.match(/\/place\/([^/@?]+)/);

    if (placeRoute) {
      const rawName = decodeURIComponent(placeRoute[1]).replace(/\+/g, " ");
      if (coordsAtSign) {
        return { query: rawName, lat: parseFloat(coordsAtSign[1]), lng: parseFloat(coordsAtSign[2]) };
      }
      return { query: rawName };
    }

    if (coordsAtSign) {
      return { lat: parseFloat(coordsAtSign[1]), lng: parseFloat(coordsAtSign[2]) };
    }

    const searchRoute = url.match(/\/search\/([^/?@]+)/);
    if (searchRoute) {
      const query = decodeURIComponent(searchRoute[1]).replace(/\+/g, " ");
      const coord = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
      if (coord) return { query, lat: parseFloat(coord[1]), lng: parseFloat(coord[2]) };
      return { query };
    }

    const queryParam = url.match(/[?&]q=([^&]+)/);
    if (queryParam) {
      const q = decodeURIComponent(queryParam[1]);
      const coordQ = q.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
      if (coordQ) return { lat: parseFloat(coordQ[1]), lng: parseFloat(coordQ[2]) };
      return { query: q };
    }

    const anyCoords = url.match(/(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
    if (anyCoords) return { lat: parseFloat(anyCoords[1]), lng: parseFloat(anyCoords[2]) };

    return null;
  } catch {
    return null;
  }
}

function buildPlaceResult(place: Record<string, unknown>): PlaceResult {
  let city = "";
  let country = "";

  const components = place.address_components as Array<{ types: string[]; long_name: string; short_name: string }> | undefined;
  if (components) {
    for (const c of components) {
      if (c.types.includes("locality")) city = c.long_name;
      if (c.types.includes("country")) country = c.short_name;
    }
    if (!city) {
      for (const c of components) {
        if (c.types.includes("administrative_area_level_2")) city = c.long_name;
      }
    }
  }

  const photosRaw = place.photos as Array<{ photo_reference: string }> | undefined;
  const photoRefs: string[] = [];
  if (photosRaw?.length) {
    for (let i = 0; i < Math.min(photosRaw.length, 5); i++) {
      photoRefs.push(photosRaw[i].photo_reference);
    }
  }

  const geometry = place.geometry as { location: { lat: number; lng: number } } | undefined;
  const openingHours = place.opening_hours as { open_now?: boolean } | undefined;

  return {
    raw: {
      placeId: place.place_id as string,
      placeName: place.name as string,
      placeAddress: place.formatted_address as string,
      rating: (place.rating as number) ?? null,
      reviewCount: (place.user_ratings_total as number) ?? null,
      photoUrl: null,
      photos: [],
      latitude: geometry?.location.lat ?? 0,
      longitude: geometry?.location.lng ?? 0,
      city,
      country,
      website: (place.website as string) ?? undefined,
      phone: (place.formatted_phone_number as string) ?? undefined,
      types: (place.types as string[]) ?? undefined,
      openNow: openingHours?.open_now,
    },
    photoRefs,
  };
}

const PLACE_FIELDS = "place_id,name,formatted_address,rating,user_ratings_total,photos,geometry,address_components,website,formatted_phone_number,types,opening_hours";

async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<PlaceResult | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${PLACE_FIELDS}&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("Place Details status:", data.status, "for placeId:", placeId);
    if (data.status !== "OK" || !data.result) {
      console.error("Place Details API error:", data.status, data.error_message);
      return null;
    }
    return buildPlaceResult(data.result);
  } catch (error) {
    console.error("fetchPlaceDetails error:", error);
    return null;
  }
}

async function searchPlaceByText(query: string, apiKey: string, lat?: number, lng?: number): Promise<PlaceResult | null> {
  try {
    let url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${apiKey}`;
    if (lat && lng) url += `&locationbias=point:${lat},${lng}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log("FindPlace status:", data.status, "query:", query);

    if (data.status === "OK" && data.candidates?.length > 0) {
      return await fetchPlaceDetails(data.candidates[0].place_id, apiKey);
    }

    const tsUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const tsResp = await fetch(tsUrl);
    const tsData = await tsResp.json();
    console.log("TextSearch status:", tsData.status, "query:", query);

    if (tsData.status === "OK" && tsData.results?.length > 0) {
      return await fetchPlaceDetails(tsData.results[0].place_id, apiKey);
    }

    return null;
  } catch (error) {
    console.error("searchPlaceByText error:", error);
    return null;
  }
}

async function findPlaceByCoordinates(lat: number, lng: number, apiKey: string): Promise<PlaceResult | null> {
  try {
    for (const radius of [50, 200, 500]) {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(`NearbySearch radius=${radius} status:`, data.status);
      if (data.status === "OK" && data.results?.length > 0) {
        return await fetchPlaceDetails(data.results[0].place_id, apiKey);
      }
    }
    return null;
  } catch (error) {
    console.error("findPlaceByCoordinates error:", error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const reqUrl = new URL(req.url);

  if (req.method === "GET" && reqUrl.pathname.endsWith("/photo")) {
    try {
      const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
      if (!apiKey) return new Response("Missing API key", { status: 500, headers: corsHeaders });
      const ref = reqUrl.searchParams.get("ref");
      if (!ref) return new Response("Missing ref", { status: 400, headers: corsHeaders });
      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${apiKey}`;
      const resp = await fetch(photoUrl, { redirect: "follow" });
      if (!resp.ok) return new Response("Photo fetch failed", { status: resp.status, headers: corsHeaders });
      const contentType = resp.headers.get("content-type") || "image/jpeg";
      const buffer = await resp.arrayBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Google Maps API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const googleMapsUrl: string = body?.googleMapsUrl?.trim() ?? "";
    if (!googleMapsUrl) {
      return new Response(JSON.stringify({ error: "Google Maps URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resolvedUrl = googleMapsUrl;
    const isShortLink = /goo\.gl|maps\.app\.goo\.gl|g\.co\/maps/i.test(resolvedUrl);
    if (isShortLink) {
      console.log("Resolving short link:", resolvedUrl);
      resolvedUrl = await resolveRedirect(resolvedUrl);
      console.log("Resolved to:", resolvedUrl);
    }

    const parsed = extractFromUrl(resolvedUrl);
    console.log("Parsed URL data:", JSON.stringify(parsed));

    if (!parsed) {
      return new Response(JSON.stringify({ error: "Invalid Google Maps URL format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let placeResult: PlaceResult | null = null;

    if (parsed.placeId) {
      placeResult = await fetchPlaceDetails(parsed.placeId, apiKey);
    }

    if (!placeResult && parsed.query) {
      placeResult = await searchPlaceByText(parsed.query, apiKey, parsed.lat, parsed.lng);
    }

    if (!placeResult && parsed.lat && parsed.lng) {
      placeResult = await findPlaceByCoordinates(parsed.lat, parsed.lng, apiKey);
    }

    if (!placeResult) {
      return new Response(
        JSON.stringify({ error: "Could not find the business from this link. Try copying the link from the Google Maps share button." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const photoUrls = placeResult.photoRefs.map(
      (ref) => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(ref)}&key=${apiKey}`
    );
    placeResult.raw.photos = photoUrls;
    placeResult.raw.photoUrl = photoUrls[0] ?? null;

    return new Response(JSON.stringify(placeResult.raw), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
