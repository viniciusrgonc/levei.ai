/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim, skipWaiting } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

// Ativa imediatamente sem esperar todas as abas fecharem
skipWaiting()
clientsClaim()

// Faz cache de todos os assets gerados pelo Vite
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Cache de APIs e páginas navegadas
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages' })
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({ cacheName: 'images' })
)

// ── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data: {
    title?: string
    body?: string
    icon?: string
    badge?: string
    tag?: string
    vibrate?: number[]
    data?: { url?: string }
  } = {}

  try {
    data = event.data.json()
  } catch {
    data = { title: 'Levei', body: event.data.text() }
  }

  const options: NotificationOptions = {
    body: data.body || '',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'levei',
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || {},
    requireInteraction: false,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Levei', options)
  )
})

// ── NOTIFICATION CLICK ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Se já tem uma aba aberta, foca ela
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        // Senão abre uma nova aba
        return self.clients.openWindow(url)
      })
  )
})
