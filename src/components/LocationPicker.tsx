import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Search, MapPin, Loader2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Fix default marker icon issue with Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

type Tab = 'map' | 'search' | 'manual';

export default function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress,
}: LocationPickerProps) {
  const [latitude, setLatitude] = useState(initialLat || -19.874976);
  const [longitude, setLongitude] = useState(initialLng || -44.99354);
  const [address, setAddress] = useState(initialAddress || '');
  const [activeTab, setActiveTab] = useState<Tab>('search');

  // Manual address fields
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [complement, setComplement] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const updateLocation = useCallback(
    async (lat: number, lng: number, skipReverseGeocode = false) => {
      setLatitude(lat);
      setLongitude(lng);
      if (skipReverseGeocode) return;
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
        );
        const data = await response.json();
        if (data.display_name) {
          setAddress(data.display_name);
          onLocationSelect(lat, lng, data.display_name);
          if (data.address) {
            setStreet(data.address.road || data.address.street || '');
            setNumber(data.address.house_number || '');
            setNeighborhood(data.address.suburb || data.address.neighbourhood || data.address.quarter || '');
            setCity(data.address.city || data.address.town || data.address.municipality || '');
          }
        } else {
          onLocationSelect(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      } catch {
        onLocationSelect(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    },
    [onLocationSelect]
  );

  // Initialize Leaflet map (only when tab is 'map')
  useEffect(() => {
    if (activeTab !== 'map') return;
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker([latitude, longitude], { draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', (e: L.DragEndEvent) => {
      const pos = (e.target as L.Marker).getLatLng();
      updateLocation(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      updateLocation(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [activeTab]);

  // Sync marker when coords change externally
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
    }
  }, [latitude, longitude]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocation(pos.coords.latitude, pos.coords.longitude);
        setActiveTab('map');
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 3) { setSuggestions([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&countrycodes=br`
        );
        setSuggestions(await res.json() || []);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 500);
  };

  const selectSuggestion = (s: AddressSuggestion) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setLatitude(lat); setLongitude(lng);
    setAddress(s.display_name);
    setSuggestions([]); setSearchQuery('');
    onLocationSelect(lat, lng, s.display_name);
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], 16);
    }
    setActiveTab('map');
  };

  const useManualAddress = async () => {
    const fullAddress = [
      street && number ? `${street}, ${number}` : street,
      complement, neighborhood, city, 'Brasil',
    ].filter(Boolean).join(', ');
    if (!street || !city) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`
      );
      const data = await res.json();
      if (data?.[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setLatitude(lat); setLongitude(lng);
        setAddress(fullAddress);
        onLocationSelect(lat, lng, fullAddress);
        if (mapRef.current && markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          mapRef.current.setView([lat, lng], 16);
        }
        setActiveTab('map');
      } else {
        setAddress(fullAddress);
        onLocationSelect(latitude, longitude, fullAddress);
      }
    } catch {
      setAddress(fullAddress);
      onLocationSelect(latitude, longitude, fullAddress);
    } finally { setSearching(false); }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'search', label: 'Buscar', icon: <Search className="h-4 w-4" /> },
    { key: 'map',    label: 'Mapa',   icon: <MapPin className="h-4 w-4" /> },
    { key: 'manual', label: 'Manual', icon: null },
  ];

  return (
    <div className="space-y-3">
      {/* GPS button */}
      <button
        type="button"
        onClick={getCurrentLocation}
        disabled={geoLoading}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-gray-200 bg-white text-gray-700 font-medium text-sm active:bg-gray-50 transition-colors"
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
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Search tab */}
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
                  <span className="text-sm text-gray-700 line-clamp-2">{s.display_name}</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 3 && !searching && suggestions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              Nenhum resultado. Tente o modo Manual.
            </p>
          )}
        </div>
      )}

      {/* Map tab */}
      {activeTab === 'map' && (
        <div className="space-y-2">
          <div className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: 260 }}>
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>
          <p className="text-xs text-gray-400 text-center">
            Toque no mapa ou arraste o marcador para ajustar
          </p>
        </div>
      )}

      {/* Manual tab */}
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
            onClick={useManualAddress}
            disabled={searching || !street || !city}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {searching
              ? <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</>
              : <><Check className="h-4 w-4" />Confirmar endereço</>
            }
          </button>
        </div>
      )}

      {/* Selected address confirmation */}
      {address && (
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
          <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 leading-snug">{address}</p>
        </div>
      )}
    </div>
  );
}
