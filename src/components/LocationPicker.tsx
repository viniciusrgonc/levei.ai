import { useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
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

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

export default function LocationPicker({ 
  onLocationSelect, 
  initialLat, 
  initialLng,
  initialAddress 
}: LocationPickerProps) {
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [latitude, setLatitude] = useState(initialLat || -23.550520);
  const [longitude, setLongitude] = useState(initialLng || -46.633308);
  const [address, setAddress] = useState(initialAddress || '');
  const [showKeyInput, setShowKeyInput] = useState(true);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const updateLocation = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);

    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ location: { lat, lng } });
      
      if (result.results[0]) {
        const newAddress = result.results[0].formatted_address;
        setAddress(newAddress);
        onLocationSelect(lat, lng, newAddress);
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        onLocationSelect(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
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
        
        if (map) {
          map.panTo({ lat, lng });
          map.setZoom(15);
        }
        updateLocation(lat, lng);
      },
      (error) => {
        alert('Não foi possível obter sua localização: ' + error.message);
      }
    );
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      updateLocation(lat, lng);
    }
  };

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      updateLocation(lat, lng);
    }
  };

  if (showKeyInput) {
    return (
      <div className="space-y-4 p-6 bg-card rounded-lg border">
        <div className="space-y-2">
          <Label htmlFor="googleMapsKey">
            <MapPin className="w-4 h-4 inline mr-2" />
            Chave da API Google Maps (Necessário)
          </Label>
          <Input
            id="googleMapsKey"
            type="text"
            placeholder="Cole sua chave da API do Google Maps aqui"
            value={googleMapsKey}
            onChange={(e) => setGoogleMapsKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Obtenha sua chave gratuita em{' '}
            <a 
              href="https://console.cloud.google.com/google/maps-apis" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google Cloud Console
            </a>
          </p>
        </div>
        <Button 
          onClick={() => setShowKeyInput(false)} 
          disabled={!googleMapsKey}
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
          onClick={() => setShowKeyInput(true)}
          className="flex-shrink-0"
        >
          Alterar Chave
        </Button>
      </div>

      <div className="w-full rounded-lg border shadow-lg overflow-hidden">
        <LoadScript googleMapsApiKey={googleMapsKey}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={{ lat: latitude, lng: longitude }}
            zoom={14}
            onClick={handleMapClick}
            onLoad={onLoad}
            onUnmount={onUnmount}
          >
            <Marker
              position={{ lat: latitude, lng: longitude }}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
            />
          </GoogleMap>
        </LoadScript>
      </div>

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
