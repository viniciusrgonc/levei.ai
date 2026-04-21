import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Navigation, Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

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

export default function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress,
}: LocationPickerProps) {
  const [latitude, setLatitude] = useState(initialLat || -23.55052);
  const [longitude, setLongitude] = useState(initialLng || -46.633308);
  const [address, setAddress] = useState(initialAddress || '');
  const [activeTab, setActiveTab] = useState<string>('map');

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
  const [searchTimeout, setSearchTimeoutState] = useState<ReturnType<typeof setTimeout> | null>(null);

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
          const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setAddress(coords);
          onLocationSelect(lat, lng, coords);
        }
      } catch (error) {
        console.error('Erro ao obter endereço:', error);
        const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setAddress(coords);
        onLocationSelect(lat, lng, coords);
      }
    },
    [onLocationSelect]
  );

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 14,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker and map when coords change
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
    }
  }, [latitude, longitude]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude);
        setActiveTab('map');
      },
      (error) => {
        alert('Não foi possível obter sua localização: ' + error.message);
      }
    );
  };

  // Search for addresses
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=br`
      );
      const data = await response.json();
      setSuggestions(data || []);
    } catch (error) {
      console.error('Erro na busca:', error);
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      searchAddress(value);
    }, 500);
    setSearchTimeoutState(timeout);
  };

  // Select a suggestion
  const selectSuggestion = (suggestion: AddressSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    setLatitude(lat);
    setLongitude(lng);
    setAddress(suggestion.display_name);
    setSuggestions([]);
    setSearchQuery('');
    onLocationSelect(lat, lng, suggestion.display_name);

    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], 16);
    }
    setActiveTab('map');
  };

  // Build and use manual address
  const useManualAddress = async () => {
    const fullAddress = [
      street && number ? `${street}, ${number}` : street,
      complement,
      neighborhood,
      city,
      'Brasil',
    ]
      .filter(Boolean)
      .join(', ');

    if (!street || !city) {
      alert('Por favor, preencha ao menos a rua e a cidade.');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setLatitude(lat);
        setLongitude(lng);
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
        alert('Endereço salvo, mas não foi possível localizar no mapa. A localização aproximada será usada.');
      }
    } catch (error) {
      console.error('Erro ao buscar coordenadas:', error);
      setAddress(fullAddress);
      onLocationSelect(latitude, longitude, fullAddress);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={getCurrentLocation} className="w-full">
        <Navigation className="w-4 h-4 mr-2" />
        Usar Minha Localização
      </Button>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="map" className="text-xs sm:text-sm">
            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs sm:text-sm">
            <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            Buscar
          </TabsTrigger>
          <TabsTrigger value="manual" className="text-xs sm:text-sm">
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="mt-4">
          <div className="w-full aspect-[4/3] sm:h-[350px] rounded-lg border shadow-lg overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Clique no mapa ou arraste o marcador para selecionar a localização
          </p>
        </TabsContent>

        <TabsContent value="search" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite o endereço para buscar..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
            )}
          </div>

          {suggestions.length > 0 && (
            <Card>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors text-sm"
                      onClick={() => selectSuggestion(suggestion)}
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{suggestion.display_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {searchQuery.length > 0 && searchQuery.length < 3 && (
            <p className="text-xs text-muted-foreground text-center">
              Digite pelo menos 3 caracteres para buscar
            </p>
          )}

          {searchQuery.length >= 3 && !searching && suggestions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Nenhum resultado encontrado. Tente digitar o endereço manualmente.
            </p>
          )}
        </TabsContent>

        <TabsContent value="manual" className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="street" className="text-xs">Rua / Avenida *</Label>
              <Input
                id="street"
                placeholder="Ex: Av. Paulista"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="number" className="text-xs">Número</Label>
              <Input
                id="number"
                placeholder="1000"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="complement" className="text-xs">Complemento</Label>
            <Input
              id="complement"
              placeholder="Apto, Bloco, Sala (opcional)"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="neighborhood" className="text-xs">Bairro</Label>
              <Input
                id="neighborhood"
                placeholder="Centro"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city" className="text-xs">Cidade *</Label>
              <Input
                id="city"
                placeholder="São Paulo"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={useManualAddress}
            disabled={searching || !street || !city}
            className="w-full"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Usar Este Endereço
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            * Campos obrigatórios. O sistema tentará localizar o endereço no mapa.
          </p>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input value={latitude.toFixed(6)} readOnly className="text-xs" />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input value={longitude.toFixed(6)} readOnly className="text-xs" />
        </div>
      </div>

      {address && (
        <div className="space-y-2">
          <Label>Endereço Selecionado</Label>
          <div className="p-3 bg-primary/10 rounded-md">
            <p className="text-sm">{address}</p>
          </div>
        </div>
      )}
    </div>
  );
}
