import { useState, useEffect, useCallback } from 'react';
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

function MapController({ 
  position, 
  onLocationUpdate 
}: { 
  position: [number, number]; 
  onLocationUpdate: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  
  useMapEvents({
    click: (e) => {
      onLocationUpdate(e.latlng.lat, e.latlng.lng);
    },
  });
  
  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [map, position]);
  
  return null;
}

export default function LocationPicker({ 
  onLocationSelect, 
  initialLat, 
  initialLng,
  initialAddress 
}: LocationPickerProps) {
  const [latitude, setLatitude] = useState(initialLat || -23.550520);
  const [longitude, setLongitude] = useState(initialLng || -46.633308);
  const [address, setAddress] = useState(initialAddress || '');

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await response.json();
      
      if (data.display_name) {
        setAddress(data.display_name);
        onLocationSelect(lat, lng, data.display_name);
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
  }, [onLocationSelect]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        alert('Não foi possível obter sua localização: ' + error.message);
      }
    );
  };

  const handleMarkerDrag = useCallback((e: L.DragEndEvent) => {
    const marker = e.target as L.Marker;
    const position = marker.getLatLng();
    updateLocation(position.lat, position.lng);
  }, [updateLocation]);

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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[latitude, longitude]}
            draggable={true}
            eventHandlers={{
              dragend: handleMarkerDrag,
            }}
          />
          <MapController 
            position={[latitude, longitude]} 
            onLocationUpdate={updateLocation}
          />
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
