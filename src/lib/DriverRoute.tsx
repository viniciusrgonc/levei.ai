import { ReactNode } from 'react';
import { RoleRoute } from '@/lib/RoleRoute';

export function DriverRoute({ children }: { children: ReactNode }) {
  return <RoleRoute role="driver">{children}</RoleRoute>;
}
