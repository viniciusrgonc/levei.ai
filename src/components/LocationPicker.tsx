import { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

const MapClickHandler = ({ onLocationUpdate }: { onLocationUpdate: (lat: number, lng: number) => void }) => {
  const map = useMapEvents({
    click: (e) => {
      onLocationUpdate(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapCenterController = ({ center, zoom }: { center: [number, number]; zoom?: number }) => {
  const map = useMap();
  
  useEffect(() => {
    if (map) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  
  return null;
};

export default function LocationPicker({ 
  onLocationSelect, 
  initialLat, 
  initialLng,
  initialAddress 
}: LocationPickerProps) {
  const [latitude, setLatitude] = useState(initialLat || -23.550520);
  const [longitude, setLongitude] = useState(initialLng || -46.633308);
  const [address, setAddress] = useState(initialAddress || '');
  const markerRef = useRef<L.Marker>(null);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);

    try {
      // Use Nominatim (OpenStreetMap) for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        setAddress(data.display_name);
        onLocationSelect(lat, lng, data.display_name);
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        onLocationSelect(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    } catch (error) {
      console.error('Erro ao obter endereço:', error);
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      onLocationSelect(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  }, [onLocationSelect]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        updateLocation(lat, lng);
      },
      (error) => {
        alert('Não foi possível obter sua localização: ' + error.message);
      }
    );
  };

  return (
    <div className="space-y-4">
      <Button 
        type="button"
        variant="outline" 
        onClick={getCurrentLocation}
        className="w-full"
      >
        <Navigation className="w-4 h-4 mr-2" />
        Usar Minha Localização
      </Button>

      <div className="w-full h-[400px] rounded-lg border shadow-lg overflow-hidden">
        <MapContainer
          center={[latitude, longitude]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[latitude, longitude]}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const position = marker.getLatLng();
                updateLocation(position.lat, position.lng);
              },
            }}
            ref={markerRef}
          />
          <MapClickHandler onLocationUpdate={updateLocation} />
          <MapCenterController center={[latitude, longitude]} />
        </MapContainer>
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
