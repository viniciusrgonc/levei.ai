import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserSetup } from '@/hooks/useUserSetup';

type UserRole = 'admin' | 'driver' | 'restaurant';

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  driver: '/driver/dashboard',
  restaurant: '/restaurant/dashboard',
};

interface RoleRouteProps {
  role: UserRole;
  children: ReactNode;
}

export function RoleRoute({ role: requiredRole, children }: RoleRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserSetup();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }

      if (role !== requiredRole) {
        const destination = role ? ROLE_DASHBOARDS[role as UserRole] : '/dashboard';
        navigate(destination ?? '/dashboard');
      }
    }
  }, [user, role, requiredRole, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return user && role === requiredRole ? <>{children}</> : null;
}
