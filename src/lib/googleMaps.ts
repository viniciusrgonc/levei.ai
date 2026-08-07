const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function googleMapsEnabled(): boolean {
  return !!API_KEY && API_KEY !== 'COLE_SUA_CHAVE_AQUI';
}

// Mantido para compatibilidade — mapa continua Leaflet (OSM)
export function loadGoogleMapsScript(): Promise<boolean> {
  return Promise.resolve(false);
}

// ── Places Autocomplete (New) — REST com CORS ─────────────────────────────────

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!googleMapsEnabled()) return [];
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ['br'],
        languageCode: 'pt-BR',
      }),
    });
    if (!res.ok) {
      console.warn('[Google Places] status', res.status);
      return [];
    }
    const data = await res.json();
    return (data.suggestions ?? [])
      .filter((s: any) => s.placePrediction)
      .map((s: any) => ({
        placeId: s.placePrediction.placeId,
        description: s.placePrediction.text.text,
      }));
  } catch {
    return [];
  }
}

// ── Place Details ─────────────────────────────────────────────────────────────

export async function getPlaceDetails(
  placeId: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  if (!googleMapsEnabled()) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': API_KEY!,
        'X-Goog-FieldMask': 'location,formattedAddress',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const loc = data.location;
    return loc
      ? { lat: loc.latitude, lng: loc.longitude, address: data.formattedAddress }
      : null;
  } catch {
    return null;
  }
}

// ── Geocoding REST ────────────────────────────────────────────────────────────

export async function geocodeAddressGoogle(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!googleMapsEnabled()) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=br&language=pt-BR&key=${API_KEY}`,
    );
    const data = await res.json();
    if (data.status !== 'OK') return null;
    const loc = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

// ── Reverse Geocoding REST ────────────────────────────────────────────────────

export async function reverseGeocodeGoogle(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!googleMapsEnabled()) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${API_KEY}`,
    );
    const data = await res.json();
    if (data.status !== 'OK') return null;
    return data.results?.[0]?.formatted_address ?? null;
  } catch {
    return null;
  }
}
