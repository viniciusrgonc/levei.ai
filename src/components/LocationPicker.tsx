import { useState, useEffect, useRef, useCallback } from 'react';
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

export default function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress,
}: LocationPickerProps) {
  const [latitude, setLatitude] = useState(initialLat || -23.55052);
  const [longitude, setLongitude] = useState(initialLng || -46.633308);
  const [address, setAddress] = useState(initialAddress || '');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const updateLocation = useCallback(
    async (lat: number, lng: number) => {
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
    },
    [onLocationSelect]
  );

  // Initialize Leaflet map (no react-leaflet to avoid context issues)
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
  }, [latitude, longitude, updateLocation]);

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
      },
      (error) => {
        alert('Não foi possível obter sua localização: ' + error.message);
      }
    );
  };

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={getCurrentLocation} className="w-full">
        <Navigation className="w-4 h-4 mr-2" />
        Usar Minha Localização
      </Button>

      <div className="w-full h-[400px] rounded-lg border shadow-lg overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />
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
