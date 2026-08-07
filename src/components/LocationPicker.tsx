import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Search, MapPin, Loader2, Check, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  googleMapsEnabled,
  loadGoogleMapsScript,
  searchPlaces,
  getPlaceDetails,
  reverseGeocodeGoogle,
  geocodeAddressGoogle,
  type PlaceSuggestion,
} from '@/lib/googleMaps';

interface NominatimSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressSuggestion {
  label: string;
  lat?: string;
  lon?: string;
  placeId?: string;
}

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  onClear?: () => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

type Tab = 'map' | 'search' | 'manual';

// ── Nominatim fallbacks ───────────────────────────────────────────────────────
async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR' } },
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

async function geocodeAddressNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR' } },
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch {
    return null;
  }
}

// ── Unified helpers ───────────────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (googleMapsEnabled()) {
    const r = await reverseGeocodeGoogle(lat, lng);
    if (r) return r;
  }
  return reverseGeocodeNominatim(lat, lng);
}

async function geocodeAddress(q: string): Promise<{ lat: number; lng: number } | null> {
  if (googleMapsEnabled()) {
    const r = await geocodeAddressGoogle(q);
    if (r) return r;
  }
  return geocodeAddressNominatim(q);
}

export default function LocationPicker({
  onLocationSelect,
  onClear,
  initialLat,
  initialLng,
  initialAddress,
}: LocationPickerProps) {
  const [confirmedLat, setConfirmedLat] = useState<number | null>(initialLat ?? null);
  const [confirmedLng, setConfirmedLng] = useState<number | null>(initialLng ?? null);
  const [confirmedAddress, setConfirmedAddress] = useState<string>(initialAddress || '');

  const [mapLat, setMapLat] = useState(initialLat ?? -19.874976);
  const [mapLng, setMapLng] = useState(initialLng ?? -44.99354);

  const [activeTab, setActiveTab] = useState<Tab>('search');

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [complement, setComplement] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const [geoLoading, setGeoLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // typed as any to support both Google Maps and Leaflet fallback
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const reverseGeocodeInProgress = useRef(false);
  const mapLatLngRef = useRef({ lat: mapLat, lng: mapLng });

  useEffect(() => {
    mapLatLngRef.current = { lat: mapLat, lng: mapLng };
  }, [mapLat, mapLng]);

  const confirm = useCallback(
    (lat: number, lng: number, addr: string) => {
      setConfirmedLat(lat);
      setConfirmedLng(lng);
      setConfirmedAddress(addr);
      setMapLat(lat);
      setMapLng(lng);
      onLocationSelect(lat, lng, addr);
    },
    [onLocationSelect],
  );

  // ── Map tab: Google Maps (falls back to OpenStreetMap via Leaflet) ────────
  useEffect(() => {
    if (activeTab !== 'map') return;
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    const initGoogleMap = async () => {
      const ok = await loadGoogleMapsScript();
      if (cancelled || !mapContainerRef.current) return;

      if (ok) {
        const gm = (window as any).google.maps;
        const { lat, lng } = mapLatLngRef.current;

        const map = new gm.Map(mapContainerRef.current, {
          center: { lat, lng },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const marker = new gm.Marker({
          position: { lat, lng },
          map,
          draggable: true,
        });

        mapRef.current = map;
        markerRef.current = marker;

        const handleInteraction = async (latV: number, lngV: number) => {
          if (reverseGeocodeInProgress.current) return;
          reverseGeocodeInProgress.current = true;
          const addr = await reverseGeocode(latV, lngV);
          if (!cancelled) confirm(latV, lngV, addr);
          reverseGeocodeInProgress.current = false;
        };

        gm.event.addListener(marker, 'dragend', () => {
          const pos = marker.getPosition();
          handleInteraction(pos.lat(), pos.lng());
        });

        gm.event.addListener(map, 'click', (e: any) => {
          marker.setPosition(e.latLng);
          handleInteraction(e.latLng.lat(), e.latLng.lng());
        });
      } else {
        // Fallback: Leaflet + OpenStreetMap
        if (cancelled || !mapContainerRef.current) return;

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        const { lat, lng } = mapLatLngRef.current;
        const map = L.map(mapContainerRef.current, { center: [lat, lng], zoom: 15, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        mapRef.current = map;
        markerRef.current = marker;

        const handleInteraction = async (latV: number, lngV: number) => {
          if (reverseGeocodeInProgress.current) return;
          reverseGeocodeInProgress.current = true;
          marker.setLatLng([latV, lngV]);
          map.setView([latV, lngV], map.getZoom());
          const addr = await reverseGeocode(latV, lngV);
          if (!cancelled) confirm(latV, lngV, addr);
          reverseGeocodeInProgress.current = false;
        };

        marker.on('dragend', (e: any) => {
          const pos = e.target.getLatLng();
          handleInteraction(pos.lat, pos.lng);
        });
        map.on('click', (e: any) => handleInteraction(e.latlng.lat, e.latlng.lng));
      }
    };

    initGoogleMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        const gm = (window as any).google?.maps;
        if (gm) {
          gm.event.clearInstanceListeners(mapRef.current);
          if (markerRef.current) gm.event.clearInstanceListeners(markerRef.current);
        } else {
          // Leaflet cleanup
          mapRef.current.remove?.();
        }
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync map position when coords change ─────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const gm = (window as any).google?.maps;
    if (gm) {
      const pos = new gm.LatLng(mapLat, mapLng);
      markerRef.current.setPosition(pos);
      mapRef.current.panTo(pos);
    } else {
      // Leaflet
      markerRef.current.setLatLng?.([mapLat, mapLng]);
      mapRef.current.setView?.([mapLat, mapLng], mapRef.current.getZoom?.());
    }
  }, [mapLat, mapLng]);

  // ── GPS ──────────────────────────────────────────────────────────────────
  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const addr = await reverseGeocode(lat, lng);
        confirm(lat, lng, addr);
        setActiveTab('map');
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  // ── Search tab ────────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 3) { setSuggestions([]); return; }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        if (googleMapsEnabled()) {
          const results: PlaceSuggestion[] = await searchPlaces(value);
          if (results.length > 0) {
            setSuggestions(results.map((r) => ({ label: r.description, placeId: r.placeId })));
            return;
          }
        }
        // Fallback: Nominatim
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=br`,
          { headers: { 'Accept-Language': 'pt-BR' } },
        );
        const data: NominatimSuggestion[] = (await res.json()) || [];
        setSuggestions(data.map((d) => ({ label: d.display_name, lat: d.lat, lon: d.lon })));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const selectSuggestion = async (s: AddressSuggestion) => {
    setSuggestions([]);
    setSearchQuery('');
    if (s.placeId) {
      setSearching(true);
      const details = await getPlaceDetails(s.placeId);
      setSearching(false);
      if (details) confirm(details.lat, details.lng, details.address);
    } else if (s.lat && s.lon) {
      const lat = parseFloat(s.lat);
      const lng = parseFloat(s.lon);
      if (!isNaN(lat) && !isNaN(lng)) confirm(lat, lng, s.label);
    }
  };

  // ── Manual tab ────────────────────────────────────────────────────────────
  const handleManualConfirm = async () => {
    if (!street || !city) return;
    setManualError('');
    setManualLoading(true);

    const fullAddress = [
      street && number ? `${street}, ${number}` : street,
      complement,
      neighborhood,
      city,
      'Brasil',
    ]
      .filter(Boolean)
      .join(', ');

    const coords = await geocodeAddress(fullAddress);

    if (coords) {
      confirm(coords.lat, coords.lng, fullAddress);
      setManualLoading(false);
    } else {
      setConfirmedAddress(fullAddress);
      setManualError('Não encontramos esse endereço automaticamente. Confirme a localização no mapa abaixo.');
      setManualLoading(false);
      setActiveTab('map');
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'search', label: 'Buscar' },
    { key: 'map',    label: 'Mapa'   },
    { key: 'manual', label: 'Manual' },
  ];

  const isConfirmed = confirmedLat !== null && confirmedLng !== null && confirmedAddress !== '';

  return (
    <div className="space-y-3">

      {/* GPS button */}
      <button
        type="button"
        onClick={getCurrentLocation}
        disabled={geoLoading}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-medium text-sm active:bg-gray-50 transition-colors disabled:opacity-60"
      >
        {geoLoading
          ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          : <Navigation className="h-4 w-4 text-blue-600" />}
        Usar minha localização
      </button>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 h-9 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search tab ── */}
      {activeTab === 'search' && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Digite rua, bairro ou cidade..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 h-12 rounded-xl border-gray-200 text-sm"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
            )}
            {searchQuery && !searching && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSuggestions([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-50 last:border-0 transition-colors min-h-[52px]"
                >
                  <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700 line-clamp-2">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 3 && !searching && suggestions.length === 0 && (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-gray-400">Nenhum resultado encontrado.</p>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className="text-sm text-blue-600 font-medium underline"
              >
                Tentar inserir manualmente
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Map tab ── */}
      {activeTab === 'map' && (
        <div className="space-y-2">
          {manualError && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-snug">{manualError}</p>
            </div>
          )}
          <div className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: 260 }}>
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>
          <p className="text-xs text-gray-400 text-center">
            Toque no mapa ou arraste o marcador para confirmar a localização
          </p>
        </div>
      )}

      {/* ── Manual tab ── */}
      {activeTab === 'manual' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Rua / Avenida *</p>
              <Input
                placeholder="Ex: Av. Paulista"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="h-11 rounded-xl border-gray-200"
              />
            </div>
            <div className="w-24 space-y-1">
              <p className="text-xs text-gray-500 font-medium">Número</p>
              <Input
                placeholder="100"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="h-11 rounded-xl border-gray-200"
              />
            </div>
          </div>

          <Input
            placeholder="Complemento (opcional)"
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            className="h-11 rounded-xl border-gray-200"
          />

          <div className="flex gap-2">
            <Input
              placeholder="Bairro"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="h-11 rounded-xl border-gray-200 flex-1"
            />
            <Input
              placeholder="Cidade *"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="h-11 rounded-xl border-gray-200 flex-1"
            />
          </div>

          <button
            type="button"
            onClick={handleManualConfirm}
            disabled={manualLoading || !street || !city}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {manualLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Localizando...</>
              : <><Check className="h-4 w-4" />Confirmar endereço</>
            }
          </button>

          <p className="text-xs text-gray-400 text-center">
            Se não encontrarmos, você poderá fixar no mapa.
          </p>
        </div>
      )}

      {/* ── Confirmed address banner ── */}
      {isConfirmed && (
        <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check className="h-3 w-3 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-green-700 mb-0.5">Endereço confirmado</p>
            <p className="text-sm text-green-800 leading-snug line-clamp-2">{confirmedAddress}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setConfirmedLat(null);
              setConfirmedLng(null);
              setConfirmedAddress('');
              setManualError('');
              setActiveTab('search');
              onClear?.();
            }}
            className="flex-shrink-0 mt-0.5"
            title="Alterar endereço"
          >
            <X className="h-4 w-4 text-green-600 hover:text-green-800" />
          </button>
        </div>
      )}
    </div>
  );
}
