import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { 
  successResponse, 
  errorResponse, 
  safeHandler, 
  ErrorCodes, 
  isValidUUID 
} from '../_shared/response.ts'

console.log('[Complete-Delivery] Function loaded')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8)
  console.log(`[Complete-Delivery] ${requestId} - New request received`)

  // Wrap entire logic in safe handler - guaranteed HTTP 200
  return safeHandler(async () => {
    // === 1. AUTHENTICATION ===
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return errorResponse(
        ErrorCodes.AUTH_REQUIRED,
        'Você precisa estar autenticado para finalizar entregas'
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
      console.error(`[Complete-Delivery] ${requestId} - Auth error:`, authError)
      return errorResponse(
        ErrorCodes.SESSION_EXPIRED,
        'Sua sessão expirou. Faça login novamente.'
      )
    }

    console.log(`[Complete-Delivery] ${requestId} - User authenticated:`, user.id)

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
    
    console.log(`[Complete-Delivery] ${requestId} - Request params:`, { 
      delivery_id, 
      driver_id, 
      user_id: user.id 
    })

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
    console.log(`[Complete-Delivery] ${requestId} - Verifying driver ownership`)
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('user_id, earnings_balance')
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
        'Você não tem permissão para finalizar entregas com esta conta'
      )
    }

    console.log(`[Complete-Delivery] ${requestId} - Driver verified. Current balance: R$${driver.earnings_balance}`)

    // === 4. CHECK DELIVERY STATUS (for idempotency) ===
    const { data: currentDelivery } = await supabaseClient
      .from('deliveries')
      .select('id, status, driver_id, delivered_at')
      .eq('id', delivery_id)
      .single()

    if (!currentDelivery) {
      return errorResponse(
        ErrorCodes.DELIVERY_NOT_FOUND,
        'Entrega não encontrada'
      )
    }

    // Idempotency: if already delivered by this driver, return success silently
    if (currentDelivery.status === 'delivered' && currentDelivery.driver_id === driver_id) {
      console.log(`[Complete-Delivery] ${requestId} - Idempotent: delivery already completed by this driver`)
      return successResponse(
        { delivery: currentDelivery, already_completed: true },
        'Entrega já foi finalizada'
      )
    }

    // Check if delivery is assigned to this driver
    if (currentDelivery.driver_id !== driver_id) {
      return errorResponse(
        ErrorCodes.DELIVERY_NOT_ASSIGNED,
        'Esta entrega não está atribuída a você'
      )
    }

    // Check valid status — 'picked_up' (normal), 'returning' (com retorno) e 'delivering' (compatibilidade)
    const VALID_COMPLETE_STATUSES = ['picked_up', 'returning', 'delivering']

    console.log(`[Complete-Delivery] ${requestId} - Current status: ${currentDelivery.status}`)

    if (!VALID_COMPLETE_STATUSES.includes(currentDelivery.status)) {
      if (currentDelivery.status === 'delivered') {
        return successResponse(
          { delivery: currentDelivery, already_completed: true },
          'Entrega já foi finalizada'
        )
      }
      console.error(`[Complete-Delivery] ${requestId} - Invalid status: ${currentDelivery.status}`)
      return errorResponse(
        ErrorCodes.DELIVERY_WRONG_STATUS,
        `A entrega está no status "${currentDelivery.status}" e não pode ser finalizada agora.`,
        { current_status: currentDelivery.status, valid_statuses: VALID_COMPLETE_STATUSES }
      )
    }

    // === 5. CALL ATOMIC TRANSACTION ===
    console.log(`[Complete-Delivery] ${requestId} - Calling finalize_delivery_transaction function`)
    const { data: result, error: finalizeError } = await supabaseClient
      .rpc('finalize_delivery_transaction', {
        p_delivery_id: delivery_id,
        p_driver_id: driver_id
      })

    if (finalizeError) {
      console.error(`[Complete-Delivery] ${requestId} - Error calling finalize function:`, finalizeError)
      return errorResponse(
        ErrorCodes.DATABASE_ERROR,
        'Erro ao processar transação. Tente novamente.'
      )
    }

    console.log(`[Complete-Delivery] ${requestId} - Function result:`, result)

    if (!result.success) {
      console.error(`[Complete-Delivery] ${requestId} - Transaction failed:`, result.error)
      
      // Map known errors
      const errorMsg = result.error || ''
      if (errorMsg.includes('insufficient') || errorMsg.includes('insuficiente')) {
        return errorResponse(
          ErrorCodes.INSUFFICIENT_BALANCE,
          'Saldo insuficiente para processar a entrega'
        )
      }
      if (errorMsg.includes('already') || errorMsg.includes('já')) {
        return successResponse(
          { delivery: currentDelivery, already_completed: true },
          'Entrega já foi finalizada'
        )
      }
      
      return errorResponse(
        ErrorCodes.TRANSACTION_FAILED,
        'Não foi possível processar a transação'
      )
    }

    // === 6. LOG SUCCESS ===
    console.log(`[Complete-Delivery] ${requestId} - ✅ Transaction completed successfully:`)
    console.log(`  - Delivery ID: ${result.delivery_id}`)
    console.log(`  - Total Amount: R$${result.total_amount}`)
    console.log(`  - Driver Earnings (80%): R$${result.driver_earnings}`)
    console.log(`  - Platform Fee (20%): R$${result.platform_fee}`)
    console.log(`  - Is Last Delivery: ${result.is_last_delivery}`)

    // === 6b. INCREMENT DRIVER POINTS (+10 per delivery, non-blocking) ===
    supabaseClient
      .rpc('increment_driver_points', { p_driver_id: driver_id, p_points: 10 })
      .then(({ error: pointsError }) => {
        if (pointsError) {
          console.error(`[Complete-Delivery] ${requestId} - Points increment error:`, pointsError.message)
        } else {
          console.log(`[Complete-Delivery] ${requestId} - +10 points awarded to driver ${driver_id}`)
        }
      })

    // === 7. GET UPDATED DELIVERY ===
    const { data: updatedDelivery } = await supabaseClient
      .from('deliveries')
      .select('*')
      .eq('id', delivery_id)
      .single()

    // === 8. SEND NOTIFICATION (non-blocking) ===
    try {
      const { data: restaurantData } = await supabaseClient
        .from('restaurants')
        .select('user_id')
        .eq('id', updatedDelivery?.restaurant_id)
        .single()

      if (restaurantData?.user_id) {
        console.log(`[Complete-Delivery] ${requestId} - Sending notification to restaurant`)
        const notifTitle = 'Entrega Concluída! ✅'
        const notifMessage = `Entrega finalizada com sucesso. R$${result.total_amount.toFixed(2)} debitado.`

        await supabaseClient.rpc('create_notification', {
          p_user_id: restaurantData.user_id,
          p_title: notifTitle,
          p_message: notifMessage,
          p_type: 'delivery_completed',
          p_delivery_id: delivery_id
        })

        // Envia push notification (non-blocking)
        supabaseClient.functions.invoke('send-push', {
          body: {
            user_id: restaurantData.user_id,
            title: notifTitle,
            message: notifMessage,
            url: `/restaurant/delivery/${delivery_id}`,
          },
        }).catch((e: Error) => console.error(`[Complete-Delivery] ${requestId} - Push error:`, e?.message))
      }
    } catch (notifError) {
      console.error(`[Complete-Delivery] ${requestId} - Notification error:`, notifError)
      // Don't fail for notification errors
    }

    // === 9. SUCCESS RESPONSE ===
    return successResponse({
      delivery: updatedDelivery,
      transaction: {
        total_amount: result.total_amount,
        driver_earnings: result.driver_earnings,
        platform_fee: result.platform_fee,
        is_last_delivery: result.is_last_delivery,
        total_route_earnings: result.total_route_earnings,
        new_driver_balance: result.driver_balance_after
      }
    }, result.is_last_delivery 
      ? `Rota concluída! R$${result.total_route_earnings?.toFixed(2) || result.driver_earnings.toFixed(2)} creditado.`
      : 'Entrega finalizada! Continue para a próxima.'
    )
  })
})
