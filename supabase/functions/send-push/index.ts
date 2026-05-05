// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = 'mailto:suporte@levei.ai'

// Web Push usando a Web Crypto API nativa do Deno (sem dependência externa)
async function sendWebPush(subscription: {
  endpoint: string
  p256dh: string
  auth: string
}, payload: string): Promise<boolean> {
  try {
    const { endpoint, p256dh, auth } = subscription

    // Importa web-push via npm
    const webpush = await import('npm:web-push@3.6.7')
    webpush.default.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    await webpush.default.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      payload,
      { urgency: 'high' }
    )
    return true
  } catch (err: any) {
    // 410 Gone = subscription expirou, deve ser removida
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      console.log('[send-push] Subscription expirada:', err.statusCode)
      return false
    }
    console.error('[send-push] Erro ao enviar push:', err?.message)
    return true // mantém a subscription mesmo com outros erros
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { user_id, title, message, url } = await req.json()

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: 'user_id e title são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Busca todas as subscriptions do usuário
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (error || !subscriptions?.length) {
      console.log('[send-push] Sem subscriptions para', user_id)
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({
      title,
      body: message || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `levei-${Date.now()}`,
      data: { url: url || '/' },
      vibrate: [200, 100, 200],
    })

    let sent = 0
    const toDelete: string[] = []

    await Promise.all(
      subscriptions.map(async (sub) => {
        const ok = await sendWebPush(sub, payload)
        if (ok) {
          sent++
        } else {
          toDelete.push(sub.id)
        }
      })
    )

    // Remove subscriptions expiradas
    if (toDelete.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', toDelete)
      console.log('[send-push] Removidas', toDelete.length, 'subscriptions expiradas')
    }

    console.log(`[send-push] Enviadas ${sent}/${subscriptions.length} notificações para ${user_id}`)

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[send-push] Erro:', err?.message)
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
