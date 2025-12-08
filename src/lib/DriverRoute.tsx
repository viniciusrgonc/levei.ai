import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserSetup } from '@/hooks/useUserSetup';

interface DriverRouteProps {
  children: ReactNode;
}

export function DriverRoute({ children }: DriverRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserSetup();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }

      if (role !== 'driver') {
        // Redirect non-driver users to their appropriate dashboard
        if (role === 'restaurant') {
          navigate('/restaurant/dashboard');
        } else if (role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    }
  }, [user, role, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return user && role === 'driver' ? <>{children}</> : null;
}
