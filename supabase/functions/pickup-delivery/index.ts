import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { 
  successResponse, 
  errorResponse, 
  safeHandler, 
  ErrorCodes, 
  isValidUUID 
} from '../_shared/response.ts'

console.log('[Pickup-Delivery] Function loaded')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[Pickup-Delivery] ${requestId} - New request received`)

  // Wrap entire logic in safe handler - guaranteed HTTP 200
  return safeHandler(async () => {
    // === 1. AUTHENTICATION ===
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return errorResponse(
        ErrorCodes.AUTH_REQUIRED,
        'Você precisa estar autenticado para coletar entregas'
      )
    }

    const token = authHeader.replace(/^bearer\s+/i, '')
    if (!token || token.length < 10) {
      return errorResponse(
        ErrorCodes.INVALID_TOKEN,
        'Token de autenticação inválido'
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      console.error(`[Pickup-Delivery] ${requestId} - Auth error:`, authError)
      return errorResponse(
        ErrorCodes.SESSION_EXPIRED,
        'Sua sessão expirou. Faça login novamente.'
      )
    }

    console.log(`[Pickup-Delivery] ${requestId} - User authenticated:`, user.id)

    // === 2. INPUT VALIDATION ===
    let body: { delivery_id?: string; driver_id?: string }
    try {
      body = await req.json()
    } catch {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'Dados da requisição inválidos'
      )
    }

    const { delivery_id, driver_id } = body
    
    console.log(`[Pickup-Delivery] ${requestId} - Request params:`, { delivery_id, driver_id })

    if (!delivery_id || !driver_id) {
      return errorResponse(
        ErrorCodes.MISSING_FIELDS,
        'ID da entrega e do motorista são obrigatórios'
      )
    }

    if (!isValidUUID(delivery_id) || !isValidUUID(driver_id)) {
      return errorResponse(
        ErrorCodes.INVALID_UUID,
        'Formato de ID inválido'
      )
    }

    // === 3. DRIVER VERIFICATION ===
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('user_id')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      return errorResponse(
        ErrorCodes.DRIVER_NOT_FOUND,
        'Conta de motorista não encontrada'
      )
    }

    if (driver.user_id !== user.id) {
      return errorResponse(
        ErrorCodes.UNAUTHORIZED_DRIVER,
        'Você não tem permissão para coletar entregas com esta conta'
      )
    }

    // === 4. CHECK DELIVERY STATUS ===
    const { data: delivery, error: fetchError } = await supabaseClient
      .from('deliveries')
      .select('id, status, driver_id, restaurant_id')
      .eq('id', delivery_id)
      .single()

    if (fetchError || !delivery) {
      return errorResponse(
        ErrorCodes.DELIVERY_NOT_FOUND,
        'Entrega não encontrada'
      )
    }

    // Check if assigned to this driver
    if (delivery.driver_id !== driver_id) {
      return errorResponse(
        ErrorCodes.DELIVERY_NOT_ASSIGNED,
        'Esta entrega não está atribuída a você'
      )
    }

    // Idempotency: if already picked up, return success silently
    if (delivery.status === 'picked_up') {
      console.log(`[Pickup-Delivery] ${requestId} - Idempotent: delivery already picked up`)
      return successResponse(
        { delivery, already_picked_up: true },
        'Coleta já foi confirmada'
      )
    }

    // Check valid status for pickup
    if (delivery.status !== 'accepted') {
      if (delivery.status === 'delivered') {
        return successResponse(
          { delivery, already_completed: true },
          'Esta entrega já foi finalizada'
        )
      }
      return errorResponse(
        ErrorCodes.DELIVERY_WRONG_STATUS,
        'A entrega não está no status correto para coleta',
        { current_status: delivery.status }
      )
    }

    // === 5. UPDATE DELIVERY STATUS ===
    const { data: updatedDelivery, error: updateError } = await supabaseClient
      .from('deliveries')
      .update({
        status: 'picked_up',
        picked_up_at: new Date().toISOString()
      })
      .eq('id', delivery_id)
      .eq('status', 'accepted')
      .eq('driver_id', driver_id)
      .select()
      .single()

    if (updateError || !updatedDelivery) {
      console.error(`[Pickup-Delivery] ${requestId} - Update error:`, updateError)
      
      // Check if status changed (race condition)
      const { data: checkDelivery } = await supabaseClient
        .from('deliveries')
        .select('status')
        .eq('id', delivery_id)
        .single()
      
      if (checkDelivery?.status === 'picked_up') {
        return successResponse(
          { delivery: checkDelivery, already_picked_up: true },
          'Coleta já foi confirmada'
        )
      }
      
      return errorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Não foi possível atualizar o status da entrega'
      )
    }

    console.log(`[Pickup-Delivery] ${requestId} - ✅ Delivery picked up successfully`)

    // === 6. SUCCESS RESPONSE ===
    return successResponse(
      { delivery: updatedDelivery },
      'Coleta confirmada! Siga para o destino.'
    )
  })
})
