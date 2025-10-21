import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LocationPickerProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

export default function LocationPicker({ 
  onLocationSelect, 
  initialLat, 
  initialLng,
  initialAddress 
}: LocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [latitude, setLatitude] = useState(initialLat || -23.550520);
  const [longitude, setLongitude] = useState(initialLng || -46.633308);
  const [address, setAddress] = useState(initialAddress || '');
  const [showTokenInput, setShowTokenInput] = useState(true);

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: 14,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    marker.current = new mapboxgl.Marker({ draggable: true, color: '#8B5CF6' })
      .setLngLat([longitude, latitude])
      .addTo(map.current);

    marker.current.on('dragend', () => {
      const lngLat = marker.current!.getLngLat();
      updateLocation(lngLat.lat, lngLat.lng);
    });

    map.current.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      marker.current?.setLngLat([lng, lat]);
      updateLocation(lat, lng);
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  const updateLocation = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`
      );
      const data = await response.json();
      const newAddress = data.features[0]?.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setAddress(newAddress);
      onLocationSelect(lat, lng, newAddress);
    } catch (error) {
      console.error('Erro ao obter endereço:', error);
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      onLocationSelect(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        if (marker.current && map.current) {
          marker.current.setLngLat([lng, lat]);
          map.current.flyTo({ center: [lng, lat], zoom: 14 });
          updateLocation(lat, lng);
        }
      },
      (error) => {
        alert('Não foi possível obter sua localização: ' + error.message);
      }
    );
  };

  if (showTokenInput) {
    return (
      <div className="space-y-4 p-6 bg-card rounded-lg border">
        <div className="space-y-2">
          <Label htmlFor="mapboxToken">
            <MapPin className="w-4 h-4 inline mr-2" />
            Token Mapbox (Necessário)
          </Label>
          <Input
            id="mapboxToken"
            type="text"
            placeholder="Cole seu token público do Mapbox aqui"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Obtenha seu token gratuito em{' '}
            <a 
              href="https://mapbox.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              mapbox.com
            </a>
          </p>
        </div>
        <Button 
          onClick={() => setShowTokenInput(false)} 
          disabled={!mapboxToken}
          className="w-full"
        >
          Inicializar Mapa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button 
          type="button"
          variant="outline" 
          onClick={getCurrentLocation}
          className="flex-1"
        >
          <Navigation className="w-4 h-4 mr-2" />
          Usar Minha Localização
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowTokenInput(true)}
          className="flex-shrink-0"
        >
          Alterar Token
        </Button>
      </div>

      <div 
        ref={mapContainer} 
        className="w-full h-96 rounded-lg border shadow-lg"
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input value={latitude.toFixed(6)} readOnly />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input value={longitude.toFixed(6)} readOnly />
        </div>
      </div>

      {address && (
        <div className="space-y-2">
          <Label>Endereço Detectado</Label>
          <div className="p-3 bg-primary/10 rounded-md">
            <p className="text-sm">{address}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Clique no mapa ou arraste o marcador para selecionar a localização
      </p>
    </div>
  );
}
