import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Package, Star, AlertCircle, MessageSquare, CheckCircle2, X, BellOff } from 'lucide-react';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Notification type → icon + color ─────────────────────────────────────────
function notifMeta(type: string) {
  if (type.includes('new_delivery') || type.includes('delivery_request'))
    return { icon: Package,       bg: 'bg-blue-100',   color: 'text-blue-600'   };
  if (type.includes('accepted'))
    return { icon: CheckCircle2,  bg: 'bg-green-100',  color: 'text-green-600'  };
  if (type.includes('completed') || type.includes('delivered'))
    return { icon: Star,          bg: 'bg-amber-100',  color: 'text-amber-600'  };
  if (type.includes('cancelled'))
    return { icon: X,             bg: 'bg-red-100',    color: 'text-red-500'    };
  if (type.includes('chat') || type.includes('message'))
    return { icon: MessageSquare, bg: 'bg-purple-100', color: 'text-purple-600' };
  return   { icon: Bell,          bg: 'bg-gray-100',   color: 'text-gray-500'   };
}

// ── Navigate helper: detect role from current path ───────────────────────────
function useNotifNavigate() {
  const navigate = useNavigate();
  const location = useLocation();

  return (notification: AppNotification) => {
    if (!notification.delivery_id) return;
    const path = location.pathname;
    if (path.startsWith('/driver')) {
      if (['accepted', 'picking_up'].some(s => notification.type.includes(s)))
        navigate(`/driver/pickup/${notification.delivery_id}`);
      else
        navigate(`/driver/delivery/${notification.delivery_id}`);
    } else if (path.startsWith('/admin')) {
      navigate('/admin/deliveries');
    } else {
      navigate(`/restaurant/delivery/${notification.delivery_id}`);
    }
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const navigateToDelivery = useNotifNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Register push subscription
  usePushSubscription(user?.id);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (n: AppNotification) => {
    markAsRead(n.id);
    setOpen(false);
    navigateToDelivery(n);
  };

  return (
    // Wrapper with overflow-visible so badge never gets clipped by parents
    <div className="relative" style={{ overflow: 'visible' }}>
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-white/10 active:scale-90"
        style={{ overflow: 'visible' }}
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5 text-white" />

        {/* Badge — positioned outside button via absolute on wrapper */}
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center bg-red-500 text-white font-bold rounded-full leading-none pointer-events-none"
            style={{
              top: -4, right: -4,
              minWidth: 18, height: 18,
              fontSize: 10,
              paddingLeft: unreadCount > 9 ? 4 : 0,
              paddingRight: unreadCount > 9 ? 4 : 0,
              zIndex: 9999,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ zIndex: 9999, top: '100%' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-700" />
              <span className="font-bold text-gray-900 text-sm">Notificações</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Marcar todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5 pt-1">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <BellOff className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-gray-600 font-semibold text-sm">Tudo em dia!</p>
                <p className="text-gray-400 text-xs mt-1">Nenhuma notificação por enquanto</p>
              </div>
            ) : (
              notifications.map((n, idx) => {
                const meta = notifMeta(n.type);
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 ${
                      idx > 0 ? 'border-t border-gray-50' : ''
                    } ${!n.is_read ? 'bg-primary/[0.03]' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-sm leading-snug ${n.is_read ? 'text-gray-700 font-medium' : 'text-gray-900 font-bold'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-center">
              <p className="text-xs text-gray-400">
                {notifications.length} notificação{notifications.length !== 1 ? 'ões' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
