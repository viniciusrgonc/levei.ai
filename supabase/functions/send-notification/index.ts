// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import {
  successResponse,
  errorResponse,
  safeHandler,
  ErrorCodes,
  isValidUUID,
} from '../_shared/response.ts'

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_RECIPIENT_TYPES = ['all', 'all_drivers', 'all_restaurants', 'user'] as const
const VALID_TYPES           = ['info', 'success', 'warning', 'error', 'system', 'security'] as const
const VALID_PRIORITIES      = ['normal', 'important', 'urgent'] as const

type RecipientType = typeof VALID_RECIPIENT_TYPES[number]
type NotifType     = typeof VALID_TYPES[number]
type Priority      = typeof VALID_PRIORITIES[number]

interface SendNotificationBody {
  recipient_type:    RecipientType
  recipient_user_id?: string
  title:             string
  message:           string
  type:              NotifType
  priority:          Priority
  expires_at?:       string   // ISO 8601 — must be future date
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function containsHTML(text: string): boolean {
  return /<[^>]*>/.test(text)
}

function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

// ── Recipient resolution ──────────────────────────────────────────────────────

async function getRecipientIds(
  supabase: ReturnType<typeof createClient>,
  recipientType: RecipientType,
  recipientUserId?: string
): Promise<string[]> {

  if (recipientType === 'user') {
    if (!recipientUserId) return []
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', recipientUserId)
      .maybeSingle()
    return data ? [data.id as string] : []
  }

  if (recipientType === 'all_drivers') {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'driver')
    return (data ?? []).map((r) => r.user_id as string)
  }

  if (recipientType === 'all_restaurants') {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'restaurant')
    return (data ?? []).map((r) => r.user_id as string)
  }

  if (recipientType === 'all') {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['driver', 'restaurant'])
    // Deduplica caso um usuário tenha múltiplas roles
    const ids = (data ?? []).map((r) => r.user_id as string)
    return [...new Set(ids)]
  }

  return []
}

// ── Entry point ───────────────────────────────────────────────────────────────

console.log('[Send-Notification] Function loaded')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[Send-Notification] ${requestId} - New request received`)

  return safeHandler(async () => {

    // === 1. AUTHENTICATION ===
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return errorResponse(ErrorCodes.AUTH_REQUIRED, 'Autenticação necessária')
    }

    const token = authHeader.replace(/^bearer\s+/i, '')
    if (!token || token.length < 10) {
      return errorResponse(ErrorCodes.INVALID_TOKEN, 'Token inválido')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      console.error(`[Send-Notification] ${requestId} - Auth failed:`, authError?.message)
      return errorResponse(ErrorCodes.SESSION_EXPIRED, 'Sessão expirada. Faça login novamente.')
    }

    console.log(`[Send-Notification] ${requestId} - User authenticated: ${user.id}`)

    // === 2. ADMIN AUTHORIZATION ===
    // Não confiamos em JWT claims. Verificamos a tabela user_roles diretamente.
    const { data: adminRole, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError) {
      console.error(`[Send-Notification] ${requestId} - Role check error:`, roleError.message)
      return errorResponse(ErrorCodes.DATABASE_ERROR, 'Erro ao verificar permissões')
    }

    if (!adminRole) {
      console.error(`[Send-Notification] ${requestId} - Non-admin attempt: ${user.id}`)
      return errorResponse(ErrorCodes.UNAUTHORIZED, 'Acesso restrito a administradores')
    }

    console.log(`[Send-Notification] ${requestId} - Admin verified: ${user.id}`)

    // === 3. INPUT VALIDATION ===
    let body: SendNotificationBody
    try {
      body = await req.json()
    } catch {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Corpo da requisição inválido')
    }

    if (!body.recipient_type || !body.title || !body.message || !body.type || !body.priority) {
      return errorResponse(
        ErrorCodes.MISSING_FIELDS,
        'Campos obrigatórios: recipient_type, title, message, type, priority'
      )
    }

    if (!VALID_RECIPIENT_TYPES.includes(body.recipient_type)) {
      return errorResponse(ErrorCodes.INVALID_INPUT, `recipient_type inválido. Valores aceitos: ${VALID_RECIPIENT_TYPES.join(', ')}`)
    }
    if (!VALID_TYPES.includes(body.type)) {
      return errorResponse(ErrorCodes.INVALID_INPUT, `type inválido. Valores aceitos: ${VALID_TYPES.join(', ')}`)
    }
    if (!VALID_PRIORITIES.includes(body.priority)) {
      return errorResponse(ErrorCodes.INVALID_INPUT, `priority inválida. Valores aceitos: ${VALID_PRIORITIES.join(', ')}`)
    }

    if (body.recipient_type === 'user') {
      if (!body.recipient_user_id || !isValidUUID(body.recipient_user_id)) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          'recipient_user_id é obrigatório e deve ser um UUID válido quando recipient_type = "user"'
        )
      }
    }

    // Política de texto puro: HTML não é permitido
    if (containsHTML(body.title) || containsHTML(body.message)) {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Notificações devem ser em texto puro, sem HTML')
    }

    const title   = sanitizeText(body.title)
    const message = sanitizeText(body.message)

    if (title.length < 1 || title.length > 100) {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Título deve ter entre 1 e 100 caracteres')
    }
    if (message.length < 1 || message.length > 1000) {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Mensagem deve ter entre 1 e 1000 caracteres')
    }

    let expiresAt: string | null = null
    if (body.expires_at) {
      const d = new Date(body.expires_at)
      if (isNaN(d.getTime()) || d <= new Date()) {
        return errorResponse(ErrorCodes.INVALID_INPUT, 'expires_at deve ser uma data futura válida')
      }
      expiresAt = d.toISOString()
    }

    // === 4. IDEMPOTÊNCIA ===
    // Impede reenvio duplicado: mesmo admin + mesmo conteúdo + mesma campanha nos últimos 60s.
    // Protege contra duplo-clique ou retry do frontend sem coordenação do cliente.
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()

    const { data: recentCampaign } = await supabaseClient
      .from('notification_campaigns')
      .select('id, recipients_count, created_at')
      .eq('sent_by',        user.id)
      .eq('recipient_type', body.recipient_type)
      .eq('title',          title)
      .eq('message',        message)
      .eq('type',           body.type)
      .eq('priority',       body.priority)
      .gte('created_at',    sixtySecondsAgo)
      .limit(1)
      .maybeSingle()

    if (recentCampaign) {
      console.log(`[Send-Notification] ${requestId} - Idempotent: campaign ${recentCampaign.id} already sent recently`)
      return successResponse(
        {
          campaign_id:      recentCampaign.id,
          recipients_count: recentCampaign.recipients_count,
          idempotent:       true,
        },
        'Notificação já enviada recentemente'
      )
    }

    // === 5. DESTINATÁRIOS ===
    const recipientIds = await getRecipientIds(supabaseClient, body.recipient_type, body.recipient_user_id)

    if (recipientIds.length === 0) {
      console.log(`[Send-Notification] ${requestId} - No recipients for type: ${body.recipient_type}`)
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'Nenhum destinatário encontrado para o critério selecionado'
      )
    }

    console.log(`[Send-Notification] ${requestId} - Recipients: ${recipientIds.length}`)

    // === 6. INSERT NOTIFICAÇÕES (batch) ===
    // Insere todos os registros em uma única operação.
    // O trigger protect_notification_columns não dispara aqui porque
    // service_role tem auth.uid() = NULL → caminho trusted.
    const notificationRows = recipientIds.map((userId) => ({
      user_id:    userId,
      title,
      message,
      type:       body.type,
      priority:   body.priority,
      sent_by:    user.id,
      expires_at: expiresAt,
      is_read:    false,
    }))

    const { error: notifError } = await supabaseClient
      .from('notifications')
      .insert(notificationRows)

    if (notifError) {
      console.error(`[Send-Notification] ${requestId} - Notification insert error:`, notifError.message)
      return errorResponse(ErrorCodes.DATABASE_ERROR, 'Erro ao criar notificações. Tente novamente.')
    }

    // === 7. INSERT CAMPANHA (auditoria) ===
    // Criado após as notificações — não bloqueia o sucesso mesmo se falhar.
    const { data: campaign, error: campaignError } = await supabaseClient
      .from('notification_campaigns')
      .insert({
        sent_by:           user.id,
        recipient_type:    body.recipient_type,
        recipient_user_id: body.recipient_type === 'user' ? body.recipient_user_id : null,
        title,
        message,
        type:              body.type,
        priority:          body.priority,
        recipients_count:  recipientIds.length,
      })
      .select('id')
      .single()

    if (campaignError) {
      // Notificações já foram criadas — erro no log é não-fatal
      console.error(`[Send-Notification] ${requestId} - Campaign log error (non-fatal):`, campaignError.message)
    }

    const campaignId = campaign?.id ?? null
    console.log(`[Send-Notification] ${requestId} - ✅ Sent ${recipientIds.length} notifications. Campaign: ${campaignId}`)

    // === 8. PUSH (separado e preparado para uso futuro) ===
    // A criação da notificação no banco está desacoplada da entrega via push.
    // Para ativar: iterar recipientIds e invocar a função send-push por usuário.
    // Neste momento, Supabase Realtime entrega as notificações em tempo real.
    // Não há acoplamento entre este passo e os anteriores.

    // === 9. RESPOSTA ===
    return successResponse(
      {
        campaign_id:      campaignId,
        recipients_count: recipientIds.length,
        idempotent:       false,
      },
      `Notificação enviada para ${recipientIds.length} destinatário${recipientIds.length !== 1 ? 's' : ''}`
    )
  })
})
