import { ReactNode } from 'react';
import { RoleRoute } from '@/lib/RoleRoute';

export function AdminRoute({ children }: { children: ReactNode }) {
  return <RoleRoute role="admin">{children}</RoleRoute>;
}
