export interface ReverseGeocodeResult {
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  address: string | null;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  if (!mapboxToken) {
    console.warn('[reverseGeocode] No Mapbox token available');
    return {
      countryCode: null,
      countryName: null,
      city: null,
      address: null,
    };
  }

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=place,neighborhood,locality,country&language=he`
    );

    if (!response.ok) {
      throw new Error(`Geocoding API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      console.warn('[reverseGeocode] No features returned from geocoding API');
      return {
        countryCode: null,
        countryName: null,
        city: null,
        address: null,
      };
    }

    let countryCode: string | null = null;
    let countryName: string | null = null;
    let city: string | null = null;
    let address = data.features[0]?.place_name || null;

    const feature = data.features[0];
    if (feature.context) {
      const countryContext = feature.context.find((c: { id: string; short_code?: string; text?: string }) =>
        c.id.startsWith('country.')
      );

      if (countryContext) {
        countryCode = countryContext.short_code?.toUpperCase() || null;
        countryName = countryContext.text || null;
      }
    }

    const countryFeature = data.features.find((f: { place_type: string[]; properties?: { short_code?: string }; text?: string }) =>
      f.place_type?.includes('country')
    );

    if (countryFeature && !countryCode) {
      countryCode = countryFeature.properties?.short_code?.toUpperCase() || null;
      countryName = countryFeature.text || null;
    }

    const placeFeature = data.features.find((f: { place_type: string[]; text?: string }) =>
      f.place_type?.includes('place') || f.place_type?.includes('locality')
    );

    if (placeFeature) {
      city = placeFeature.text || null;
    }

    console.log('[reverseGeocode] Result:', {
      countryCode,
      countryName,
      city,
      coordinates: { latitude, longitude },
    });

    return {
      countryCode,
      countryName,
      city,
      address,
    };
  } catch (error) {
    console.error('[reverseGeocode] Error:', error);
    return {
      countryCode: null,
      countryName: null,
      city: null,
      address: null,
    };
  }
}
