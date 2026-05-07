import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Gift, Users, HelpCircle, Settings,
  LogOut, Star, ChevronRight, Trophy, ShoppingBag,
} from 'lucide-react';

interface DriverProfile {
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  points: number;
  referralCode: string | null;
  totalDeliveries: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  profile: DriverProfile;
}

const menuItems = [
  { icon: Trophy,      label: 'Recompensas',       path: '/driver/rewards',     color: 'text-amber-600',  bg: 'bg-amber-50',  badge: 'Novo' },
  { icon: ShoppingBag, label: 'Loja de Pontos',    path: '/driver/store',       color: 'text-green-600',  bg: 'bg-green-50'  },
  { icon: Users,       label: 'Indique um amigo',  path: '/driver/referral',    color: 'text-blue-600',   bg: 'bg-blue-50'  },
  { icon: HelpCircle,  label: 'Central de ajuda',  path: '/driver/help',        color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { icon: Settings,    label: 'Preferências',       path: '/driver/settings',    color: 'text-gray-600',   bg: 'bg-gray-100'  },
];

export function DriverDrawer({ open, onClose, profile }: Props) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleNavigate = (path: string) => {
    onClose();
    setTimeout(() => navigate(path), 280);
  };

  const handleLogout = async () => {
    onClose();
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const initials = profile.name
    ? profile.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={handleBackdropClick}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 left-0 bottom-0 z-[60] w-[300px] bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* ── Perfil ── */}
        <div className="px-5 pt-8 pb-5 bg-gradient-to-br from-primary to-primary/80">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/40 flex items-center justify-center mb-3">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xl font-bold">{initials}</span>
            )}
          </div>

          {/* Nome */}
          <p className="text-white font-bold text-lg leading-tight">{profile.name || 'Motoboy'}</p>

          {/* Rating */}
          {profile.rating && (
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5"
                  fill={i < Math.round(profile.rating!) ? '#fbbf24' : 'transparent'}
                  stroke={i < Math.round(profile.rating!) ? '#fbbf24' : 'rgba(255,255,255,0.4)'}
                />
              ))}
              <span className="text-white/80 text-xs ml-1">{Number(profile.rating).toFixed(1)}</span>
            </div>
          )}

          {/* Points pill */}
          <div
            className="mt-3 inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 cursor-pointer"
            onClick={() => handleNavigate('/driver/rewards')}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-white text-xs font-semibold">{profile.points} pontos</span>
            <ChevronRight className="h-3 w-3 text-white/60" />
          </div>
        </div>

        {/* ── Menu items ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigate(item.path)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left mb-0.5"
            >
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                <item.icon className={`h-4.5 w-4.5 ${item.color}`} style={{ width: 18, height: 18 }} />
              </div>
              <span className="flex-1 text-gray-800 font-medium text-sm">{item.label}</span>
              {item.badge && (
                <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          ))}
        </nav>

        {/* ── Sair ── */}
        <div className="px-3 pb-4 border-t border-gray-100 pt-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <LogOut className="h-4.5 w-4.5 text-red-500" style={{ width: 18, height: 18 }} />
            </div>
            <span className="font-medium text-sm">Sair da conta</span>
          </button>
        </div>
      </div>
    </>
  );
}
