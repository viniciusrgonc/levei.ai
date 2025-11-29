import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

console.log('[Complete-Delivery] Function loaded')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  console.log(`[Complete-Delivery] ${requestId} - New request received`)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error(`[Complete-Delivery] ${requestId} - Missing authorization header`)
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      console.error(`[Complete-Delivery] ${requestId} - Auth error:`, authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Complete-Delivery] ${requestId} - User authenticated:`, user.id)

    const { delivery_id, driver_id } = await req.json()
    
    console.log(`[Complete-Delivery] ${requestId} - Request params:`, { 
      delivery_id, 
      driver_id, 
      user_id: user.id 
    })

    // Input validation
    if (!delivery_id || !driver_id) {
      console.error(`[Complete-Delivery] ${requestId} - Missing required fields`)
      return new Response(
        JSON.stringify({ error: 'Missing required fields: delivery_id and driver_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UUID_REGEX.test(delivery_id) || !UUID_REGEX.test(driver_id)) {
      console.error(`[Complete-Delivery] ${requestId} - Invalid UUID format`)
      return new Response(
        JSON.stringify({ error: 'Invalid UUID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify driver ownership
    console.log(`[Complete-Delivery] ${requestId} - Verifying driver ownership`)
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('user_id, earnings_balance')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver || driver.user_id !== user.id) {
      console.error(`[Complete-Delivery] ${requestId} - Driver ownership verification failed:`, driverError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this driver account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Complete-Delivery] ${requestId} - Driver verified. Current balance: R$${driver.earnings_balance}`)

    // Call atomic database function to finalize delivery
    console.log(`[Complete-Delivery] ${requestId} - Calling finalize_delivery_transaction function`)
    const { data: result, error: finalizeError } = await supabaseClient
      .rpc('finalize_delivery_transaction', {
        p_delivery_id: delivery_id,
        p_driver_id: driver_id
      })

    if (finalizeError) {
      console.error(`[Complete-Delivery] ${requestId} - Error calling finalize function:`, finalizeError)
      return new Response(
        JSON.stringify({ error: 'Erro ao processar entrega' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[Complete-Delivery] ${requestId} - Function result:`, result)

    if (!result.success) {
      console.error(`[Complete-Delivery] ${requestId} - Transaction failed:`, result.error)
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log successful transaction details
    console.log(`[Complete-Delivery] ${requestId} - ✅ Transaction completed successfully:`)
    console.log(`  - Delivery ID: ${result.delivery_id}`)
    console.log(`  - Total Amount: R$${result.total_amount}`)
    console.log(`  - Driver Earnings (80%): R$${result.driver_earnings}`)
    console.log(`  - Platform Fee (20%): R$${result.platform_fee}`)
    console.log(`  - Restaurant Balance: R$${result.restaurant_balance_before} → R$${result.restaurant_balance_after}`)
    console.log(`  - Driver Balance: R$${result.driver_balance_before} → R$${result.driver_balance_after}`)

    // Get updated delivery
    const { data: updatedDelivery } = await supabaseClient
      .from('deliveries')
      .select('*')
      .eq('id', delivery_id)
      .single()

    // Send notifications
    const { data: restaurantData } = await supabaseClient
      .from('restaurants')
      .select('user_id')
      .eq('id', updatedDelivery.restaurant_id)
      .single()

    if (restaurantData?.user_id) {
      console.log(`[Complete-Delivery] ${requestId} - Sending notification to restaurant`)
      await supabaseClient.rpc('create_notification', {
        p_user_id: restaurantData.user_id,
        p_title: 'Entrega Concluída! ✅',
        p_message: `Entrega finalizada com sucesso. R$${result.total_amount.toFixed(2)} debitado da carteira.`,
        p_type: 'delivery_completed',
        p_delivery_id: delivery_id
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        delivery: updatedDelivery,
        transaction: {
          total_amount: result.total_amount,
          driver_earnings: result.driver_earnings,
          platform_fee: result.platform_fee,
          new_driver_balance: result.driver_balance_after
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error(`[Complete-Delivery] ${requestId} - Unexpected error:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
