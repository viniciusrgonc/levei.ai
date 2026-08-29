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

// Values mirror the DB CHECK constraint on notification_campaigns.recipient_type
const VALID_TARGET_TYPES = ['all', 'all_drivers', 'all_restaurants', 'user'] as const
// Values mirror the DB CHECK constraint on notifications.type
const VALID_TYPES        = ['info', 'success', 'warning', 'error', 'system', 'security'] as const
// Values mirror the DB CHECK constraint on notifications.priority
const VALID_PRIORITIES   = ['normal', 'important', 'urgent'] as const

// Anti-abuse limits — server-side, no client override possible
const MAX_SPECIFIC_RECIPIENTS  = 100        // max target_ids when target_type = 'user'
const MAX_BROADCAST_RECIPIENTS = 5_000      // guard for unusually large tenants
const MAX_PAYLOAD_BYTES        = 50 * 1024  // 50 KB — rejects pathological payloads

interface SendNotificationBody {
  target_type:  string         // 'all' | 'all_drivers' | 'all_restaurants' | 'user'
  target_ids?:  string[]       // required when target_type = 'user'
  title:        string         // 1–100 chars, plain text
  message:      string         // 1–1000 chars, plain text
  type?:        string         // optional, defaults to 'info'
  priority?:    string         // optional, defaults to 'normal'
  expires_at?:  string | null  // ISO 8601 future timestamp
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function containsHTML(text: string): boolean {
  return /<[^>]*>/.test(text)
}

function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

// ── Recipient resolution ──────────────────────────────────────────────────────
// ALL recipient resolution happens server-side. The frontend never determines
// the final list — it only provides a target_type and optional target_ids hint.

async function getRecipientIds(
  supabase: ReturnType<typeof createClient>,
  targetType: string,
  targetIds?: string[]
): Promise<string[]> {

  if (targetType === 'user') {
    if (!targetIds || targetIds.length === 0) return []
    // Verify each ID against profiles — filters out non-existent users and
    // prevents IDOR probing (no information about whether an ID exists is leaked
    // to the caller beyond "no recipients found").
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .in('id', targetIds)
    return (data ?? []).map((r) => r.id as string)
  }

  if (targetType === 'all_drivers') {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'driver')
    return (data ?? []).map((r) => r.user_id as string)
  }

  if (targetType === 'all_restaurants') {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'restaurant')
    return (data ?? []).map((r) => r.user_id as string)
  }

  if (targetType === 'all') {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['driver', 'restaurant'])
    const ids = (data ?? []).map((r) => r.user_id as string)
    return [...new Set(ids)]  // deduplicate users with multiple roles
  }

  return []
}

// ── Entry point ───────────────────────────────────────────────────────────────

console.log('[Send-Notification] Function loaded')

Deno.serve(async (req) => {
  // CORS preflight — must respond before any other check
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only POST is accepted. Return 405 before touching auth or body.
  if (req.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { ...corsHeaders, Allow: 'POST, OPTIONS' },
    })
  }

  // Early payload size guard via Content-Length (when present)
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return errorResponse(
      ErrorCodes.INVALID_INPUT,
      'Payload excede o tamanho máximo permitido (50 KB)'
    )
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[Send-Notification] ${requestId} - New request received`)

  return safeHandler(async () => {

    // === 1. AUTHENTICATION ===
    // Token must come from the Authorization header — never from the request body.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      return errorResponse(ErrorCodes.AUTH_REQUIRED, 'Autenticação necessária')
    }

    const token = authHeader.replace(/^bearer\s+/i, '')
    if (!token || token.length < 10) {
      return errorResponse(ErrorCodes.INVALID_TOKEN, 'Token inválido')
    }

    // service_role client — used only server-side, never exposed to frontend
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
    // Do NOT trust role/is_admin from JWT app_metadata or the request body.
    // Always verify against the user_roles table directly.
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

    // === 3. BODY PARSING ===
    // Read as text first so we can enforce a size limit regardless of Content-Length.
    let rawBody: string
    try {
      rawBody = await req.text()
    } catch {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Erro ao ler o corpo da requisição')
    }

    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'Payload excede o tamanho máximo permitido (50 KB)'
      )
    }

    let body: SendNotificationBody
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Corpo da requisição inválido ou não é JSON')
    }

    // === 4. INPUT VALIDATION ===

    // Required fields
    if (!body.target_type || !body.title || !body.message) {
      return errorResponse(
        ErrorCodes.MISSING_FIELDS,
        'Campos obrigatórios: target_type, title, message'
      )
    }

    // target_type must be one of the allowed values
    if (!VALID_TARGET_TYPES.includes(body.target_type)) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        `target_type inválido. Valores aceitos: ${VALID_TARGET_TYPES.join(', ')}`
      )
    }

    // type: optional, default 'info'
    const notifType = body.type || 'info'
    if (!VALID_TYPES.includes(notifType)) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        `type inválido. Valores aceitos: ${VALID_TYPES.join(', ')}`
      )
    }

    // priority: optional, default 'normal'
    const priority = body.priority || 'normal'
    if (!VALID_PRIORITIES.includes(priority)) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        `priority inválida. Valores aceitos: ${VALID_PRIORITIES.join(', ')}`
      )
    }

    // target_ids validation — only required and validated for target_type = 'user'
    if (body.target_type === 'user') {
      if (!Array.isArray(body.target_ids) || body.target_ids.length === 0) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          'target_ids é obrigatório (array não-vazio de UUIDs) quando target_type = "user"'
        )
      }
      if (body.target_ids.length > MAX_SPECIFIC_RECIPIENTS) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          `target_ids excede o limite de ${MAX_SPECIFIC_RECIPIENTS} destinatários por chamada`
        )
      }
      for (const id of body.target_ids) {
        if (typeof id !== 'string' || !isValidUUID(id)) {
          return errorResponse(
            ErrorCodes.INVALID_INPUT,
            'target_ids contém um ou mais UUIDs inválidos'
          )
        }
      }
    }

    // HTML is not allowed — platform notifications must be plain text
    if (containsHTML(body.title) || containsHTML(body.message)) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'Notificações devem ser em texto puro, sem HTML'
      )
    }

    const title   = sanitizeText(body.title)
    const message = sanitizeText(body.message)

    if (title.length < 1 || title.length > 100) {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Título deve ter entre 1 e 100 caracteres')
    }
    if (message.length < 1 || message.length > 1000) {
      return errorResponse(ErrorCodes.INVALID_INPUT, 'Mensagem deve ter entre 1 e 1000 caracteres')
    }

    // expires_at: if provided, must be a valid ISO 8601 timestamp in the future
    let expiresAt: string | null = null
    if (body.expires_at) {
      const d = new Date(body.expires_at)
      if (isNaN(d.getTime()) || d <= new Date()) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          'expires_at deve ser uma data/hora futura válida no formato ISO 8601'
        )
      }
      expiresAt = d.toISOString()
    }

    // === 5. IDEMPOTENCY CHECK ===
    // No idempotency_key column exists in the current schema — using a content-based
    // 60-second window. Protects against double-click and frontend retries.
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()

    const { data: recentCampaign } = await supabaseClient
      .from('notification_campaigns')
      .select('id, recipients_count, created_at')
      .eq('sent_by',        user.id)
      .eq('recipient_type', body.target_type)  // target_type → recipient_type in DB
      .eq('title',          title)
      .eq('message',        message)
      .eq('type',           notifType)
      .eq('priority',       priority)
      .gte('created_at',    sixtySecondsAgo)
      .limit(1)
      .maybeSingle()

    if (recentCampaign) {
      console.log(
        `[Send-Notification] ${requestId} - Idempotent: campaign ${recentCampaign.id} already sent recently`
      )
      return successResponse(
        {
          campaign_id:      recentCampaign.id,
          recipients_count: recentCampaign.recipients_count,
          idempotent:       true,
        },
        'Notificação já enviada recentemente'
      )
    }

    // === 6. RESOLVE RECIPIENTS (server-side only) ===
    // The final recipient list is ALWAYS determined server-side.
    // For 'user': target_ids is cross-checked against profiles (IDOR protection).
    // For broadcast types: queried from user_roles.
    const recipientIds = await getRecipientIds(
      supabaseClient,
      body.target_type,
      body.target_ids
    )

    if (recipientIds.length === 0) {
      console.log(
        `[Send-Notification] ${requestId} - No recipients for target_type: ${body.target_type}`
      )
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'Nenhum destinatário encontrado para o critério selecionado'
      )
    }

    // Broadcast safety ceiling — prevents accidental sends in unexpectedly large tenants
    if (recipientIds.length > MAX_BROADCAST_RECIPIENTS) {
      console.error(
        `[Send-Notification] ${requestId} - Recipient count ${recipientIds.length} exceeds limit`
      )
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        `Número de destinatários (${recipientIds.length}) excede o limite operacional de ` +
        `${MAX_BROADCAST_RECIPIENTS}. Divida o envio por segmento.`
      )
    }

    console.log(
      `[Send-Notification] ${requestId} - Recipients resolved: ` +
      `${recipientIds.length} (target_type: ${body.target_type})`
    )

    // === 7. BATCH INSERT NOTIFICATIONS (atomic) ===
    // Single INSERT statement for all recipients — atomic at the Postgres level.
    // Trigger protect_notification_columns is BEFORE UPDATE only (not INSERT).
    // service_role context → auth.uid() = NULL → trusted path for future UPDATEs.
    // sent_by is ALWAYS derived from the verified admin identity, never from body.
    const notificationRows = recipientIds.map((userId) => ({
      user_id:    userId,
      title,
      message,
      type:       notifType,
      priority,
      sent_by:    user.id,    // ← from authenticated session — never from request body
      expires_at: expiresAt,
      is_read:    false,
    }))

    const { error: notifError } = await supabaseClient
      .from('notifications')
      .insert(notificationRows)

    if (notifError) {
      console.error(
        `[Send-Notification] ${requestId} - Notification insert error:`, notifError.message
      )
      return errorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Erro ao criar notificações. Tente novamente.'
      )
    }

    // === 8. CAMPAIGN AUDIT RECORD ===
    // Inserted after notifications — a failure here is non-fatal (notifications exist).
    // recipient_user_id stores the target UUID only when exactly one user is targeted.
    const recipientUserIdForDb =
      body.target_type === 'user' && body.target_ids?.length === 1
        ? body.target_ids[0]
        : null

    const { data: campaign, error: campaignError } = await supabaseClient
      .from('notification_campaigns')
      .insert({
        sent_by:           user.id,
        recipient_type:    body.target_type,  // API target_type → DB recipient_type
        recipient_user_id: recipientUserIdForDb,
        title,
        message,
        type:              notifType,
        priority,
        recipients_count:  recipientIds.length,
      })
      .select('id')
      .single()

    if (campaignError) {
      console.error(
        `[Send-Notification] ${requestId} - Campaign audit error (non-fatal):`,
        campaignError.message
      )
    }

    const campaignId = campaign?.id ?? null
    console.log(
      `[Send-Notification] ${requestId} - ✅ Admin ${user.id} sent ${recipientIds.length}` +
      ` notifications (target_type: ${body.target_type}, campaign: ${campaignId})`
    )

    // === 9. PUSH DELIVERY (decoupled — future) ===
    // Notification creation is intentionally decoupled from push delivery.
    // Currently, Supabase Realtime delivers notifications to connected clients.
    // To enable push: iterate recipientIds and invoke send-push per user (non-blocking).
    // This step must never block or fail the HTTP response.

    // === 10. RESPONSE ===
    return successResponse(
      {
        campaign_id:      campaignId,
        recipients_count: recipientIds.length,
        idempotent:       false,
      },
      `Notificação enviada para ${recipientIds.length}` +
      ` destinatário${recipientIds.length !== 1 ? 's' : ''}`
    )
  })
})
