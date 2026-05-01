import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  delivery_id: string | null;
  created_at: string;
}

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  console.log('[Notifications] Hook initialized:', {
    userId: user?.id,
    notificationCount: notifications.length,
    unreadCount,
    connectionStatus,
    timestamp: new Date().toISOString(),
  });

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      console.log('[Notifications] No user, skipping fetch');
      setLoading(false);
      return;
    }

    console.log('[Notifications] Fetching notifications for user:', user.id);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Aumentado de 20 para 50

      if (error) {
        console.error('[Notifications] Error fetching:', error);
      } else if (data) {
        console.log('[Notifications] ✅ Fetched', data.length, 'notifications');
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch (error) {
      console.error('[Notifications] Exception:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    console.log('[Notifications] Marking as read:', notificationId);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('[Notifications] Error marking as read:', error);
        return;
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      console.log('[Notifications] ✅ Marked as read');
    } catch (error) {
      console.error('[Notifications] Exception marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    console.log('[Notifications] Marking all as read for user:', user.id);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('[Notifications] Error marking all as read:', error);
        return;
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      console.log('[Notifications] ✅ All marked as read');
    } catch (error) {
      console.error('[Notifications] Exception marking all as read:', error);
    }
  };

  const setupChannel = useCallback(() => {
    if (!user) {
      console.log('[Notifications] No user, skipping channel setup');
      return null;
    }

    console.log('[Notifications] Setting up realtime channel...', {
      userId: user.id,
      attempt: reconnectAttemptsRef.current + 1,
      timestamp: new Date().toISOString(),
    });

    setConnectionStatus('CONNECTING');

    const channelName = `user-notifications-${user.id}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Notifications] 🔔 New notification received:', {
            id: payload.new.id,
            title: payload.new.title,
            timestamp: new Date().toISOString(),
          });

          const newNotification = payload.new as Notification;
          
          setNotifications((prev) => {
            // Evitar duplicatas
            if (prev.some(n => n.id === newNotification.id)) {
              return prev;
            }
            return [newNotification, ...prev];
          });
          
          setUnreadCount((prev) => prev + 1);

          // Browser notification
          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              try {
                new Notification(newNotification.title, {
                  body: newNotification.message,
                  icon: '/favicon.ico',
                  badge: '/favicon.ico',
                  tag: newNotification.id,
                });
                console.log('[Notifications] ✅ Browser notification shown');
              } catch (error) {
                console.error('[Notifications] Error showing browser notification:', error);
              }
            } else if (Notification.permission === 'default') {
              console.log('[Notifications] Requesting notification permission...');
              Notification.requestPermission().then(permission => {
                console.log('[Notifications] Permission result:', permission);
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Notifications] Notification updated:', payload.new.id);
          const updatedNotification = payload.new as Notification;
          
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
          );

          // Recalcular unread count
          setNotifications((current) => {
            setUnreadCount(current.filter((n) => !n.is_read).length);
            return current;
          });
        }
      )
      .subscribe((status, error) => {
        console.log('[Notifications] Subscription status:', {
          status,
          error,
          channelName,
          timestamp: new Date().toISOString(),
        });

        if (status === 'SUBSCRIBED') {
          setConnectionStatus('CONNECTED');
          reconnectAttemptsRef.current = 0;
          console.log('[Notifications] ✅ Successfully subscribed');
        } else if (status === 'CLOSED') {
          setConnectionStatus('DISCONNECTED');
          console.log('[Notifications] ⚠️ Channel closed, attempting reconnect...');
          attemptReconnect();
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('ERROR');
          console.error('[Notifications] ❌ Channel error:', error);
          attemptReconnect();
        }
      });

    return channel;
  }, [user]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Notifications] ❌ Max reconnection attempts reached');
      setConnectionStatus('ERROR');
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`[Notifications] 🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = setupChannel();
    }, RECONNECT_DELAY);
  }, [setupChannel]);

  const cleanup = useCallback(() => {
    console.log('[Notifications] 🧹 Cleaning up...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionStatus('DISCONNECTED');
  }, []);

  useEffect(() => {
    if (!user) {
      cleanup();
      return;
    }

    fetchNotifications();
    channelRef.current = setupChannel();

    return cleanup;
  }, [user, fetchNotifications, setupChannel, cleanup]);

  return {
    notifications,
    unreadCount,
    loading,
    connectionStatus,
    isConnected: connectionStatus === 'CONNECTED',
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
