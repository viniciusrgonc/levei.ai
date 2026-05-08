import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

type UserRole = 'admin' | 'restaurant' | 'driver' | null;

interface UserSetupStatus {
  role: UserRole;
  hasCompletedSetup: boolean;
  driverPendingApproval: boolean; // driver criou registro mas ainda não aprovado (pending ou rejected)
  driverBlocked: boolean;         // driver bloqueado pelo admin
  loading: boolean;
}

/**
 * Busca e cacheia o papel do usuário usando React Query.
 * staleTime: 5 minutos → uma só query por sessão de navegação,
 * sem repetição a cada troca de rota.
 */
async function fetchUserSetup(userId: string): Promise<{ role: UserRole; hasCompletedSetup: boolean; driverPendingApproval: boolean; driverBlocked: boolean }> {
  // 1. Busca o papel na tabela user_roles
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  const userRole = (roleData?.role as UserRole) ?? null;

  if (!userRole) {
    return { role: null, hasCompletedSetup: false, driverPendingApproval: false, driverBlocked: false };
  }

  // 2. Verifica se o cadastro complementar está completo
  let hasCompleted = false;
  let pendingApproval = false;
  let blocked = false;

  if (userRole === 'restaurant') {
    const { data } = await supabase
      .from('restaurants')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    hasCompleted = !!data;
  } else if (userRole === 'driver') {
    const { data } = await supabase
      .from('drivers')
      .select('id, is_approved, driver_status')
      .eq('user_id', userId)
      .maybeSingle();
    const status = data?.driver_status ?? (data?.is_approved ? 'approved' : 'pending');
    hasCompleted    = status === 'approved';
    pendingApproval = !!data && (status === 'pending' || status === 'rejected');
    blocked         = status === 'blocked';
  } else if (userRole === 'admin') {
    hasCompleted = true;
  }

  return { role: userRole, hasCompletedSetup: hasCompleted, driverPendingApproval: pendingApproval, driverBlocked: blocked };
}

export function useUserSetup(): UserSetupStatus {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['user-setup', user?.id],
    queryFn: () => fetchUserSetup(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,   // 5 minutos — não refaz a query ao navegar
    gcTime: 10 * 60 * 1000,     // 10 minutos em memória
    retry: 2,
  });

  return {
    role: data?.role ?? null,
    hasCompletedSetup: data?.hasCompletedSetup ?? false,
    driverPendingApproval: data?.driverPendingApproval ?? false,
    driverBlocked: data?.driverBlocked ?? false,
    loading: isLoading,
  };
}

export function useAuthRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { role, hasCompletedSetup, loading } = useUserSetup();

  useEffect(() => {
    if (loading || !user) return;

    const currentPath = window.location.pathname;

    // Nunca redireciona quem já está na rota correta
    if (currentPath.startsWith('/driver/') && role === 'driver') return;

    if (currentPath.startsWith('/restaurant/') && role === 'restaurant') {
      if (!hasCompletedSetup && currentPath !== '/restaurant/setup') {
        navigate('/restaurant/setup');
      }
      return;
    }

    if (!role) {
      if (currentPath !== '/dashboard') navigate('/dashboard');
      return;
    }

    if (!hasCompletedSetup) {
      if (role === 'restaurant' && currentPath !== '/restaurant/setup') navigate('/restaurant/setup');
      else if (role === 'driver') {
        if (driverPendingApproval && currentPath !== '/driver/pending-approval') {
          navigate('/driver/pending-approval');
        } else if (!driverPendingApproval && currentPath !== '/driver/setup') {
          navigate('/driver/setup');
        }
      }
      return;
    }

    if (role === 'restaurant' && !currentPath.startsWith('/restaurant/')) navigate('/restaurant/dashboard');
    else if (role === 'driver' && !currentPath.startsWith('/driver/')) navigate('/driver/dashboard');
    else if (role === 'admin' && !currentPath.startsWith('/admin/')) navigate('/admin/dashboard');
  }, [user, role, hasCompletedSetup, loading, navigate]);

  return { role, hasCompletedSetup, loading };
}
