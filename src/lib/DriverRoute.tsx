import { ReactNode, useEffect } from 'react';
import { RoleRoute } from '@/lib/RoleRoute';
import { loadGoogleMapsScript } from '@/lib/googleMaps';

export function DriverRoute({ children }: { children: ReactNode }) {
  // Pre-warm the Maps SDK as soon as the driver is authenticated so it's
  // ready before they navigate to any map page.
  useEffect(() => { loadGoogleMapsScript(); }, []);
  return <RoleRoute role="driver">{children}</RoleRoute>;
}
