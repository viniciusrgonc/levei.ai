import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { 
  successResponse, 
  errorResponse, 
  safeHandler, 
  ErrorCodes, 
  isValidUUID 
} from '../_shared/response.ts'

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

console.log('[Accept-Delivery] Function loaded')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[Accept-Delivery] ${requestId} - New request received`)

  // Wrap entire logic in safe handler - guaranteed HTTP 200
  return safeHandler(async () => {
    // === 1. AUTHENTICATION ===
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return errorResponse(
        ErrorCodes.AUTH_REQUIRED,
        'Você precisa estar autenticado para aceitar entregas'
      )
    }

    const token = authHeader.replace(/^bearer\s+/i, '')
    if (!token || token.length < 10) {
      return errorResponse(
        ErrorCodes.INVALID_TOKEN,
        'Token de autenticação inválido'
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !userData?.user) {
      console.error(`[Accept-Delivery] ${requestId} - Auth validation failed:`, authError?.message)
      return errorResponse(
        ErrorCodes.SESSION_EXPIRED,
        'Sua sessão expirou. Faça login novamente.'
      )
    }

    const user = userData.user
    console.log(`[Accept-Delivery] ${requestId} - User authenticated: ${user.id}`)

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

    console.log(`[Accept-Delivery] ${requestId} - Validating: delivery=${delivery_id}, driver=${driver_id}`)

    // === 3. DRIVER AUTHORIZATION ===
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('id, user_id, is_available, latitude, longitude, vehicle_type')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      return errorResponse(
        ErrorCodes.DRIVER_NOT_FOUND,
        'Conta de motorista não encontrada'
      )
    }

    if (driver.user_id !== user.id) {
      console.error(`[Accept-Delivery] ${requestId} - Unauthorized: user ${user.id} tried to use driver ${driver_id}`)
      return errorResponse(
        ErrorCodes.UNAUTHORIZED_DRIVER,
        'Você não tem permissão para aceitar entregas com esta conta'
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
        'Entrega não encontrada'
      )
    }

    console.log(`[Accept-Delivery] ${requestId} - Delivery status: ${delivery.status}, driver_id: ${delivery.driver_id}`)

    // === 5. IDEMPOTENCY CHECK ===
    if (delivery.driver_id === driver_id && delivery.status === 'accepted') {
      console.log(`[Accept-Delivery] ${requestId} - Idempotent: driver already has this delivery`)
      return successResponse(
        { delivery: { id: delivery_id } },
        'Você já aceitou esta entrega'
      )
    }

    // === 6. DELIVERY STATUS VALIDATION ===
    if (delivery.status !== 'pending') {
      if (delivery.driver_id && delivery.driver_id !== driver_id) {
        return errorResponse(
          ErrorCodes.DELIVERY_ALREADY_ACCEPTED,
          'Esta entrega já foi aceita por outro entregador'
        )
      }
      return errorResponse(
        ErrorCodes.DELIVERY_UNAVAILABLE,
        'Esta entrega não está mais disponível',
        { current_status: delivery.status }
      )
    }

    // === 7. RADIUS CHECK ===
    if (driver.latitude && driver.longitude && delivery.pickup_latitude && delivery.pickup_longitude) {
      const distance = calculateDistance(
        driver.latitude,
        driver.longitude,
        delivery.pickup_latitude,
        delivery.pickup_longitude
      )

      const { data: radiusSettings } = await supabaseClient
        .from('delivery_radius_settings')
        .select('max_radius_km')
        .eq('vehicle_type', driver.vehicle_type)
        .eq('is_active', true)
        .single()

      const maxRadius = radiusSettings?.max_radius_km || 10

      if (distance > maxRadius) {
        console.log(`[Accept-Delivery] ${requestId} - Out of radius: ${distance.toFixed(2)}km > ${maxRadius}km`)
        return errorResponse(
          ErrorCodes.OUT_OF_RADIUS,
          `Você está fora do raio permitido (${distance.toFixed(1)}km, máximo ${maxRadius}km)`,
          { distance_km: Number(distance.toFixed(2)), max_radius_km: maxRadius }
        )
      }

      console.log(`[Accept-Delivery] ${requestId} - Distance check passed: ${distance.toFixed(2)}km <= ${maxRadius}km`)
    }

    // === 8. ATOMIC ACCEPT ===
    const { data: result, error: acceptError } = await supabaseClient
      .rpc('accept_delivery_atomic', {
        p_delivery_id: delivery_id,
        p_driver_id: driver_id
      })

    if (acceptError) {
      console.error(`[Accept-Delivery] ${requestId} - Atomic accept failed:`, acceptError)
      return errorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Erro ao processar aceitação. Tente novamente.'
      )
    }

    if (!result?.success) {
      const errorMsg = result?.error || ''
      console.log(`[Accept-Delivery] ${requestId} - Atomic accept returned error: ${errorMsg}`)
      
      if (errorMsg.includes('já aceita') || errorMsg.includes('already')) {
        return errorResponse(
          ErrorCodes.DELIVERY_ALREADY_ACCEPTED,
          'Esta entrega já foi aceita por outro entregador'
        )
      }
      if (errorMsg.includes('não disponível') || errorMsg.includes('not available')) {
        return errorResponse(
          ErrorCodes.DELIVERY_UNAVAILABLE,
          'Esta entrega não está mais disponível'
        )
      }
      
      return errorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Não foi possível aceitar a entrega'
      )
    }

    const updatedDelivery = result.delivery
    console.log(`[Accept-Delivery] ${requestId} - ✅ Delivery accepted successfully`)

    // === 9. SEND NOTIFICATION (non-blocking) ===
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
        console.log(`[Accept-Delivery] ${requestId} - Notification sent`)
      }
    } catch (notifError) {
      console.error(`[Accept-Delivery] ${requestId} - Notification error:`, notifError)
    }

    // === 10. SUCCESS RESPONSE ===
    return successResponse(
      { delivery: updatedDelivery || { id: delivery_id } },
      'Entrega aceita com sucesso!'
    )
  })
})
