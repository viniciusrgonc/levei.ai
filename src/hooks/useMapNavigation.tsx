import { useState, useEffect } from 'react';

interface RouteInfo {
  distance: number; // em metros
  duration: number; // em segundos
  coordinates: [number, number][];
}

export function useMapNavigation(
  start: [number, number] | null,
  end: [number, number] | null
) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!start || !end) {
      setRoute(null);
      return;
    }

    const fetchRoute = async () => {
      setLoading(true);
      setError(null);

      try {
        // Usando OSRM (Open Source Routing Machine) - gratuito
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const routeData = data.routes[0];
          
          setRoute({
            distance: routeData.distance,
            duration: routeData.duration,
            coordinates: routeData.geometry.coordinates.map((coord: number[]) => 
              [coord[1], coord[0]] as [number, number]
            )
          });
        } else {
          // Fallback para linha reta se não conseguir rota
          setRoute({
            distance: calculateDistance(start, end) * 1000,
            duration: (calculateDistance(start, end) / 40) * 3600, // Estimativa: 40 km/h
            coordinates: [start, end]
          });
        }
      } catch (err) {
        console.error('Erro ao buscar rota:', err);
        setError('Não foi possível calcular a rota');
        
        // Fallback para linha reta
        setRoute({
          distance: calculateDistance(start, end) * 1000,
          duration: (calculateDistance(start, end) / 40) * 3600,
          coordinates: [start, end]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [start, end]);

  return { route, loading, error };
}

// Função para calcular distância usando Haversine
function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(coord2[0] - coord1[0]);
  const dLon = toRad(coord2[1] - coord1[1]);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1[0])) *
      Math.cos(toRad(coord2[0])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
