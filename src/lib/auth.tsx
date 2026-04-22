import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export type UserRole = 'admin' | 'restaurant' | 'driver' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: UserRole;
  roleLoading: boolean;
  hasCompletedSetup: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshUserSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'admin@admin.com';

const getPrimaryRole = (roles: Array<{ role: string }>): UserRole => {
  if (roles.some(({ role }) => role === 'admin')) return 'admin';
  if (roles.some(({ role }) => role === 'restaurant')) return 'restaurant';
  if (roles.some(({ role }) => role === 'driver')) return 'driver';
  return null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  const roleRequestIdRef = useRef(0);

  const resolveUserSetup = useCallback(async (currentUser: User | null) => {
    const requestId = ++roleRequestIdRef.current;

    if (!currentUser) {
      console.log('[auth] USER:', null);
      setRole(null);
      setHasCompletedSetup(false);
      setRoleLoading(false);
      return;
    }

    setRoleLoading(true);

    console.log('[auth] USER:', {
      id: currentUser.id,
      email: currentUser.email ?? null,
    });

    const fetchRole = async (): Promise<UserRole> => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);

      console.log('[auth] ROLE RESULT:', { data, error });

      return getPrimaryRole(data ?? []);
    };

    let resolvedRole = await fetchRole();

    if (currentUser.email?.toLowerCase() === ADMIN_EMAIL && resolvedRole !== 'admin') {
      const { data, error } = await (supabase as any).rpc('ensure_admin_user');
      console.log('[auth] ENSURE ADMIN RESULT:', { data, error });
      resolvedRole = await fetchRole();
    }

    console.log('[auth] ROLE FOUND:', resolvedRole);

    if (requestId !== roleRequestIdRef.current) {
      return;
    }

    if (!resolvedRole) {
      setRole(null);
      setHasCompletedSetup(false);
      setRoleLoading(false);
      return;
    }

    let completedSetup = resolvedRole === 'admin';

    if (resolvedRole === 'restaurant') {
      const { data } = await supabase
        .from('restaurants')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      completedSetup = !!data;
    }

    if (resolvedRole === 'driver') {
      const { data } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      completedSetup = !!data;
    }

    if (requestId !== roleRequestIdRef.current) {
      return;
    }

    setRole(resolvedRole);
    setHasCompletedSetup(completedSetup);
    setRoleLoading(false);
  }, []);

  const refreshUserSetup = useCallback(async () => {
    await resolveUserSetup(session?.user ?? user);
  }, [resolveUserSetup, session?.user, user]);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setLoading(false);
        void resolveUserSetup(nextSession?.user ?? null);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
      void resolveUserSetup(existingSession?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [resolveUserSetup]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel = supabase
      .channel(`auth-user-setup-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        () => {
          void resolveUserSetup(user);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurants', filter: `user_id=eq.${user.id}` },
        () => {
          void resolveUserSetup(user);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers', filter: `user_id=eq.${user.id}` },
        () => {
          void resolveUserSetup(user);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolveUserSetup, user]);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          phone: phone
        }
      }
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        roleLoading,
        hasCompletedSetup,
        signUp,
        signIn,
        signOut,
        refreshUserSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Protected Route Component
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
}