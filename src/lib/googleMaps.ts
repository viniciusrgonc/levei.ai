const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function googleMapsEnabled(): boolean {
  return !!API_KEY && API_KEY !== 'COLE_SUA_CHAVE_AQUI';
}

// ── Places Autocomplete (New) ─────────────────────────────────────────────────

export interface PlaceSuggestion {
  placeId: string;
  description: string;
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (!googleMapsEnabled()) return [];
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:br&language=pt-BR&key=${API_KEY}`,
  );
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('[Google Places]', data.status, data.error_message);
    return [];
  }
  return (data.predictions ?? []).map((p: any) => ({
    placeId: p.place_id,
    description: p.description,
  }));
}

// ── Place Details: placeId → { lat, lng, address } ───────────────────────────

export async function getPlaceDetails(
  placeId: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  if (!googleMapsEnabled()) return null;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&language=pt-BR&key=${API_KEY}`,
  );
  const data = await res.json();
  if (data.status !== 'OK') {
    console.error('[Google Place Details]', data.status);
    return null;
  }
  const loc = data.result?.geometry?.location;
  return loc
    ? { lat: loc.lat, lng: loc.lng, address: data.result.formatted_address }
    : null;
}

// ── Geocoding: address → { lat, lng } ────────────────────────────────────────

export async function geocodeAddressGoogle(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!googleMapsEnabled()) return null;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=br&language=pt-BR&key=${API_KEY}`,
  );
  const data = await res.json();
  if (data.status !== 'OK') return null;
  const loc = data.results?.[0]?.geometry?.location;
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

// ── Reverse geocoding: { lat, lng } → address string ─────────────────────────

export async function reverseGeocodeGoogle(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!googleMapsEnabled()) return null;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=pt-BR&key=${API_KEY}`,
  );
  const data = await res.json();
  if (data.status !== 'OK') return null;
  return data.results?.[0]?.formatted_address ?? null;
}
