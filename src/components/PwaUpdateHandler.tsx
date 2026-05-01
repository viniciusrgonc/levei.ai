import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Escuta o ciclo de vida do Service Worker.
 * Com skipWaiting: true no workbox, o novo SW assume imediatamente.
 * Este componente apenas faz a página recarregar quando o SW sinalizou
 * que há uma atualização disponível — garantindo que o bundle antigo
 * (com toasts velhos, layout antigo, etc.) nunca fique cacheado.
 */
export function PwaUpdateHandler() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      // Verifica atualização a cada 60 s
      if (r) {
        setInterval(() => r.update(), 60_000);
      }
    },
    onRegisterError(error) {
      console.warn('[SW] Falha ao registrar:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      // Aplica atualização e recarrega
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
