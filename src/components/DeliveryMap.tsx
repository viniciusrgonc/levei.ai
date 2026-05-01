import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface DeliveryMapProps {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  driverLat?: number;
  driverLng?: number;
  locationHistory?: Array<{ latitude: number; longitude: number }>;
  /** Height of the map in pixels (default: 208) */
  heightPx?: number;
}

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapBoundsController({ 
  pickupLat, 
  pickupLng, 
  deliveryLat, 
  deliveryLng, 
  driverLat, 
  driverLng 
}: Omit<DeliveryMapProps, 'locationHistory'>) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([
      [pickupLat, pickupLng],
      [deliveryLat, deliveryLng],
    ]);

    if (driverLat && driverLng) {
      bounds.extend([driverLat, driverLng]);
    }

    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, pickupLat, pickupLng, deliveryLat, deliveryLng, driverLat, driverLng]);

  return null;
}

export default function DeliveryMap({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  driverLat,
  driverLng,
  locationHistory = [],
  heightPx = 208,
}: DeliveryMapProps) {
  const center: [number, number] = [
    (pickupLat + deliveryLat) / 2,
    (pickupLng + deliveryLng) / 2,
  ];

  // Create polyline from location history
  const routePositions: [number, number][] = locationHistory.map(loc => [
    Number(loc.latitude),
    Number(loc.longitude)
  ]);

  return (
    <div style={{ width: '100%', height: heightPx, overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Pickup marker */}
        <Marker position={[pickupLat, pickupLng]} icon={pickupIcon} />
        
        {/* Delivery marker */}
        <Marker position={[deliveryLat, deliveryLng]} icon={deliveryIcon} />
        
        {/* Driver marker */}
        {driverLat && driverLng && (
          <Marker position={[driverLat, driverLng]} icon={driverIcon} />
        )}

        {/* Route path */}
        {routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            color="#3b82f6"
            weight={4}
            opacity={0.7}
          />
        )}

        <MapBoundsController
          pickupLat={pickupLat}
          pickupLng={pickupLng}
          deliveryLat={deliveryLat}
          deliveryLng={deliveryLng}
          driverLat={driverLat}
          driverLng={driverLng}
        />
      </MapContainer>
    </div>
  );
}
