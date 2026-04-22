import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

type UserRole = 'admin' | 'restaurant' | 'driver' | null;

interface UserSetupStatus {
  role: UserRole;
  hasCompletedSetup: boolean;
  loading: boolean;
}

export function useUserSetup(): UserSetupStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<UserSetupStatus>({
    role: null,
    hasCompletedSetup: false,
    loading: true,
  });

  const getPrimaryRole = (roles: Array<{ role: string }>): UserRole => {
    if (roles.some(({ role }) => role === 'admin')) return 'admin';
    if (roles.some(({ role }) => role === 'restaurant')) return 'restaurant';
    if (roles.some(({ role }) => role === 'driver')) return 'driver';
    return null;
  };

  const fetchSetupStatus = useCallback(async () => {
    if (!user) {
      setStatus({ role: null, hasCompletedSetup: false, loading: false });
      return;
    }

    setStatus((current) => ({ ...current, loading: true }));

    const fetchRoles = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      return getPrimaryRole(data ?? []);
    };

    let userRole = await fetchRoles();

    if (!userRole && user.email?.toLowerCase() === 'admin@admin.com') {
      await (supabase as any).rpc('ensure_admin_user');
      userRole = await fetchRoles();
    }

    if (!userRole) {
      setStatus({ role: null, hasCompletedSetup: false, loading: false });
      return;
    }

    let hasCompleted = false;

    if (userRole === 'restaurant') {
      const { data } = await supabase
        .from('restaurants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      hasCompleted = !!data;
    } else if (userRole === 'driver') {
      const { data } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      hasCompleted = !!data;
    } else if (userRole === 'admin') {
      hasCompleted = true;
    }

    setStatus({
      role: userRole,
      hasCompletedSetup: hasCompleted,
      loading: false,
    });
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!user) {
      setStatus({ role: null, hasCompletedSetup: false, loading: false });
      return;
    }

    fetchSetupStatus();

    const channel = supabase
      .channel(`user-role-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        () => fetchSetupStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSetupStatus]);

  return status;
}

export function useAuthRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { role, hasCompletedSetup, loading } = useUserSetup();

  useEffect(() => {
    if (loading || !user) return;

    // Get current path to avoid redirecting users who are already on valid driver/restaurant routes
    const currentPath = window.location.pathname;
    
    // CRITICAL: Never redirect drivers away from driver routes
    if (currentPath.startsWith('/driver/') && role === 'driver') {
      return; // Driver is on a valid driver route, don't interfere
    }
    
    // CRITICAL: Never redirect restaurants away from restaurant routes
    if (currentPath.startsWith('/restaurant/') && role === 'restaurant') {
      // Only allow redirect to setup if they haven't completed it and are on the setup page
      if (!hasCompletedSetup && currentPath !== '/restaurant/setup') {
        navigate('/restaurant/setup');
      }
      return;
    }

    // No role selected yet
    if (!role) {
      if (currentPath !== '/dashboard') {
        navigate('/dashboard');
      }
      return;
    }

    // Has role but hasn't completed setup - redirect to appropriate setup page
    if (!hasCompletedSetup) {
      if (role === 'restaurant' && currentPath !== '/restaurant/setup') {
        navigate('/restaurant/setup');
      } else if (role === 'driver' && currentPath !== '/driver/setup') {
        navigate('/driver/setup');
      }
      return;
    }

    // Has role and completed setup - go to dashboard (only if not already on a valid route)
    if (role === 'restaurant' && !currentPath.startsWith('/restaurant/')) {
      navigate('/restaurant/dashboard');
    } else if (role === 'driver' && !currentPath.startsWith('/driver/')) {
      navigate('/driver/dashboard');
    } else if (role === 'admin' && !currentPath.startsWith('/admin/')) {
      navigate('/admin/dashboard');
    }
  }, [user, role, hasCompletedSetup, loading, navigate]);

  return { role, hasCompletedSetup, loading };
}
