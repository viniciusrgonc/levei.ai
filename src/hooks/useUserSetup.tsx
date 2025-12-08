import { useEffect, useState } from 'react';
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
  const navigate = useNavigate();
  const [status, setStatus] = useState<UserSetupStatus>({
    role: null,
    hasCompletedSetup: false,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setStatus({ role: null, hasCompletedSetup: false, loading: false });
      return;
    }

    const checkSetup = async () => {
      // Special handling for admin@admin.com - automatically assign admin role
      if (user.email === 'admin@admin.com') {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        // If admin role doesn't exist, create it
        if (!existingRole) {
          await supabase
            .from('user_roles')
            .insert({ user_id: user.id, role: 'admin' });
        }

        setStatus({
          role: 'admin',
          hasCompletedSetup: true,
          loading: false,
        });
        return;
      }

      // Check user role for non-admin users
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const userRole = roleData?.role as UserRole || null;

      if (!userRole) {
        setStatus({ role: null, hasCompletedSetup: false, loading: false });
        return;
      }

      // Check if setup is complete based on role
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
        hasCompleted = true; // Admins don't need setup
      }

      setStatus({
        role: userRole,
        hasCompletedSetup: hasCompleted,
        loading: false,
      });
    };

    checkSetup();
  }, [user]);

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
