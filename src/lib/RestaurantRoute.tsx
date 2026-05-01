import { ReactNode } from 'react';
import { RoleRoute } from '@/lib/RoleRoute';

export function RestaurantRoute({ children }: { children: ReactNode }) {
  return <RoleRoute role="restaurant">{children}</RoleRoute>;
}
