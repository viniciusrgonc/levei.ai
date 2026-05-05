import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

const VAPID_PUBLIC_KEY = 'BAvJH6j_XDch9Wr4BkA0j4sCdMeVCsjoVmgsRtN0MX2XUUFyHtya7CF5OkE1FzzVq2Nnco-YjptYaaO3Eyy5f_Q'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function usePushSubscription(userId: string | undefined) {
  const subscribed = useRef(false)

  useEffect(() => {
    if (!userId || subscribed.current) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    async function subscribe() {
      try {
        const registration = await navigator.serviceWorker.ready

        // Verifica se já tem subscription ativa
        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          await saveSubscription(existing, userId!)
          subscribed.current = true
          return
        }

        // Pede permissão e cria subscription
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          console.log('[usePushSubscription] Permissão negada')
          return
        }

        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })

        await saveSubscription(sub, userId!)
        subscribed.current = true
        console.log('[usePushSubscription] Inscrito com sucesso')
      } catch (err) {
        console.error('[usePushSubscription] Erro ao subscrever:', err)
      }
    }

    subscribe()
  }, [userId])
}

async function saveSubscription(sub: PushSubscription, userId: string) {
  const json = sub.toJSON()
  const endpoint = sub.endpoint
  const p256dh = json.keys?.p256dh ?? ''
  const auth = json.keys?.auth ?? ''

  if (!p256dh || !auth) return

  // Upsert via endpoint (evita duplicatas)
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh, auth },
    { onConflict: 'user_id,endpoint' }
  )

  if (error) {
    console.error('[usePushSubscription] Erro ao salvar subscription:', error.message)
  }
}
