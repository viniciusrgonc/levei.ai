import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Error codes for structured responses
const ErrorCodes = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_INPUT: 'INVALID_INPUT',
  DRIVER_NOT_FOUND: 'DRIVER_NOT_FOUND',
  UNAUTHORIZED_DRIVER: 'UNAUTHORIZED_DRIVER',
  DELIVERY_NOT_FOUND: 'DELIVERY_NOT_FOUND',
  DELIVERY_ALREADY_ACCEPTED: 'DELIVERY_ALREADY_ACCEPTED',
  DELIVERY_UNAVAILABLE: 'DELIVERY_UNAVAILABLE',
  DRIVER_HAS_ACTIVE_DELIVERY: 'DRIVER_HAS_ACTIVE_DELIVERY',
  OUT_OF_RADIUS: 'OUT_OF_RADIUS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

// Helper to create error response
function errorResponse(
  code: string, 
  message: string, 
  status: number,
  details?: Record<string, unknown>
) {
  console.error(`[accept-delivery] Error: ${code} - ${message}`, details || '')
  return new Response(
    JSON.stringify({ 
      success: false,
      error: { code, message, ...(details && { details }) }
    }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Helper to create success response
function successResponse(data: Record<string, unknown>, status = 200) {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

console.log('Accept Delivery Function loaded')

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[${requestId}] Accept delivery request started`)

  try {
    // === 1. AUTHENTICATION ===
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return errorResponse(
        ErrorCodes.AUTH_REQUIRED,
        'Você precisa estar autenticado para aceitar entregas',
        401
      )
    }

    const token = authHeader.replace(/^bearer\s+/i, '')
    if (!token || token.length < 10) {
      return errorResponse(
        ErrorCodes.INVALID_TOKEN,
        'Token de autenticação inválido',
        401
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Use service role client for all operations (we validate token manually)
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Validate user token using getUser with token
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !userData?.user) {
      console.error(`[${requestId}] Auth validation failed:`, authError?.message || 'No user')
      return errorResponse(
        ErrorCodes.INVALID_TOKEN,
        'Sessão expirada. Faça login novamente.',
        401
      )
    }

    const user = userData.user
    console.log(`[${requestId}] User authenticated: ${user.id}`)

    // === 2. INPUT VALIDATION ===
    let body: { delivery_id?: string; driver_id?: string }
    try {
      body = await req.json()
    } catch {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'Dados da requisição inválidos',
        400
      )
    }

    const { delivery_id, driver_id } = body

    if (!delivery_id || !driver_id) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'ID da entrega e do motorista são obrigatórios',
        400,
        { missing: !delivery_id ? 'delivery_id' : 'driver_id' }
      )
    }

    if (!UUID_REGEX.test(delivery_id)) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'ID da entrega inválido',
        400
      )
    }

    if (!UUID_REGEX.test(driver_id)) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        'ID do motorista inválido',
        400
      )
    }

    console.log(`[${requestId}] Validating: delivery=${delivery_id}, driver=${driver_id}`)

    // === 3. DRIVER AUTHORIZATION ===
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('id, user_id, is_available, latitude, longitude, vehicle_type')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      return errorResponse(
        ErrorCodes.DRIVER_NOT_FOUND,
        'Conta de motorista não encontrada',
        404
      )
    }

    // Verify the authenticated user owns this driver account
    if (driver.user_id !== user.id) {
      console.error(`[${requestId}] Unauthorized: user ${user.id} tried to use driver ${driver_id}`)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED_DRIVER,
        'Você não tem permissão para aceitar entregas com esta conta',
        403
      )
    }

    // === 4. FETCH DELIVERY ===
    const { data: delivery, error: deliveryError } = await supabaseClient
      .from('deliveries')
      .select('id, status, driver_id, pickup_latitude, pickup_longitude, vehicle_category, restaurant_id')
      .eq('id', delivery_id)
      .single()

    if (deliveryError || !delivery) {
      return errorResponse(
        ErrorCodes.DELIVERY_NOT_FOUND,
        'Entrega não encontrada',
        404
      )
    }

    console.log(`[${requestId}] Delivery status: ${delivery.status}, driver_id: ${delivery.driver_id}`)

    // === 5. IDEMPOTENCY CHECK ===
    // If this driver already has this delivery, return success (idempotent)
    if (delivery.driver_id === driver_id && delivery.status === 'accepted') {
      console.log(`[${requestId}] Idempotent: driver already has this delivery`)
      return successResponse({ 
        delivery: { id: delivery_id },
        message: 'Você já aceitou esta entrega'
      })
    }

    // === 6. DELIVERY STATUS VALIDATION ===
    if (delivery.status !== 'pending') {
      if (delivery.driver_id && delivery.driver_id !== driver_id) {
        return errorResponse(
          ErrorCodes.DELIVERY_ALREADY_ACCEPTED,
          'Esta entrega já foi aceita por outro entregador',
          409
        )
      }
      return errorResponse(
        ErrorCodes.DELIVERY_UNAVAILABLE,
        'Esta entrega não está mais disponível',
        409,
        { current_status: delivery.status }
      )
    }

    // === 7. CHECK DRIVER ACTIVE DELIVERIES ===
    const { data: activeDeliveries, error: activeError } = await supabaseClient
      .from('deliveries')
      .select('id, status')
      .eq('driver_id', driver_id)
      .in('status', ['accepted', 'picked_up'])

    if (activeError) {
      console.error(`[${requestId}] Failed to check active deliveries:`, activeError)
    } else if (activeDeliveries && activeDeliveries.length > 0) {
      // Allow batch deliveries from same restaurant, block otherwise
      // For now, simple check - has any active delivery
      console.log(`[${requestId}] Driver has ${activeDeliveries.length} active deliveries`)
      // We could block here, but for batch delivery support, we'll allow
      // The atomic function will handle proper validation
    }

    // === 8. RADIUS CHECK ===
    if (driver.latitude && driver.longitude && delivery.pickup_latitude && delivery.pickup_longitude) {
      const distance = calculateDistance(
        driver.latitude,
        driver.longitude,
        delivery.pickup_latitude,
        delivery.pickup_longitude
      )

      // Get max radius from settings
      const { data: radiusSettings } = await supabaseClient
        .from('delivery_radius_settings')
        .select('max_radius_km')
        .eq('vehicle_type', driver.vehicle_type)
        .eq('is_active', true)
        .single()

      const maxRadius = radiusSettings?.max_radius_km || 10 // Default 10km

      if (distance > maxRadius) {
        console.log(`[${requestId}] Out of radius: ${distance.toFixed(2)}km > ${maxRadius}km`)
        return errorResponse(
          ErrorCodes.OUT_OF_RADIUS,
          `Você está fora do raio permitido (${distance.toFixed(1)}km de distância, máximo ${maxRadius}km)`,
          403,
          { distance_km: Number(distance.toFixed(2)), max_radius_km: maxRadius }
        )
      }

      console.log(`[${requestId}] Distance check passed: ${distance.toFixed(2)}km <= ${maxRadius}km`)
    }

    // === 9. ATOMIC ACCEPT (handles race conditions) ===
    const { data: result, error: acceptError } = await supabaseClient
      .rpc('accept_delivery_atomic', {
        p_delivery_id: delivery_id,
        p_driver_id: driver_id
      })

    if (acceptError) {
      console.error(`[${requestId}] Atomic accept failed:`, acceptError)
      return errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'Erro ao processar aceitação. Tente novamente.',
        500
      )
    }

    if (!result?.success) {
      const errorMsg = result?.error || 'Falha ao aceitar entrega'
      console.log(`[${requestId}] Atomic accept returned error: ${errorMsg}`)
      
      // Map atomic function errors to appropriate codes
      if (errorMsg.includes('já aceita') || errorMsg.includes('already')) {
        return errorResponse(ErrorCodes.DELIVERY_ALREADY_ACCEPTED, 'Esta entrega já foi aceita por outro entregador', 409)
      }
      if (errorMsg.includes('não disponível') || errorMsg.includes('not available')) {
        return errorResponse(ErrorCodes.DELIVERY_UNAVAILABLE, 'Esta entrega não está mais disponível', 409)
      }
      
      return errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg, 400)
    }

    const updatedDelivery = result.delivery
    console.log(`[${requestId}] Delivery accepted successfully: ${updatedDelivery?.id || delivery_id}`)

    // === 10. SEND NOTIFICATION (non-blocking) ===
    try {
      const { data: restaurantData } = await supabaseClient
        .from('restaurants')
        .select('user_id')
        .eq('id', delivery.restaurant_id)
        .single()

      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      if (restaurantData?.user_id) {
        const driverName = profileData?.full_name || 'Entregador'
        await supabaseClient.rpc('create_notification', {
          p_user_id: restaurantData.user_id,
          p_title: 'Entrega Aceita',
          p_message: `O entregador ${driverName} aceitou sua entrega!`,
          p_type: 'delivery_accepted',
          p_delivery_id: delivery_id
        })
        console.log(`[${requestId}] Notification sent to restaurant`)
      }
    } catch (notifError) {
      console.error(`[${requestId}] Failed to send notification:`, notifError)
      // Don't fail the request for notification errors
    }

    return successResponse({ 
      delivery: updatedDelivery || { id: delivery_id },
      message: 'Entrega aceita com sucesso!'
    })

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error)
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Erro interno. Tente novamente em alguns instantes.',
      500
    )
  }
})
