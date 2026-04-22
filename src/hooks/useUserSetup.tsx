import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface UserSetupStatus {
  role: 'admin' | 'restaurant' | 'driver' | null;
  hasCompletedSetup: boolean;
  loading: boolean;
}

export function useUserSetup(): UserSetupStatus {
  const { role, hasCompletedSetup, roleLoading } = useAuth();

  return {
    role,
    hasCompletedSetup,
    loading: roleLoading,
  };
}

export function useAuthRedirect() {
  const { user, loading: authLoading, role, hasCompletedSetup, roleLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    if (!user) return;

    if (roleLoading) return;

    const currentPath = window.location.pathname;

    if (role === 'admin') {
      if (!currentPath.startsWith('/admin/')) {
        navigate('/admin/dashboard', { replace: true });
      }
      return;
    }

    if (currentPath.startsWith('/driver/') && role === 'driver') {
      return;
    }

    if (currentPath.startsWith('/restaurant/') && role === 'restaurant') {
      if (!hasCompletedSetup && currentPath !== '/restaurant/setup') {
        navigate('/restaurant/setup', { replace: true });
      } else if (hasCompletedSetup && currentPath === '/restaurant/setup') {
        navigate('/restaurant/dashboard', { replace: true });
      }
      return;
    }

    if (!role) {
      if (currentPath !== '/dashboard') {
        navigate('/dashboard', { replace: true });
      }
      return;
    }

    if (!hasCompletedSetup) {
      if (role === 'restaurant' && currentPath !== '/restaurant/setup') {
        navigate('/restaurant/setup', { replace: true });
      } else if (role === 'driver' && currentPath !== '/driver/setup') {
        navigate('/driver/setup', { replace: true });
      }
      return;
    }

    if (role === 'restaurant' && !currentPath.startsWith('/restaurant/')) {
      navigate('/restaurant/dashboard', { replace: true });
    } else if (role === 'driver' && !currentPath.startsWith('/driver/')) {
      navigate('/driver/dashboard', { replace: true });
    }
  }, [authLoading, user, roleLoading, role, hasCompletedSetup, navigate]);

  return { role, hasCompletedSetup, loading: authLoading || roleLoading };
}
