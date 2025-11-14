import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

console.log('Complete Delivery Function loaded')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { delivery_id, driver_id } = await req.json()
    
    console.log('Complete delivery request:', { delivery_id, driver_id, user_id: user.id })

    if (!delivery_id || !driver_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: delivery_id and driver_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UUID_REGEX.test(delivery_id) || !UUID_REGEX.test(driver_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid UUID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify driver ownership
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('user_id')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver || driver.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this driver account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify delivery is assigned to this driver and in picked_up status
    const { data: delivery, error: fetchError } = await supabaseClient
      .from('deliveries')
      .select('id, status, driver_id, restaurant_id, price')
      .eq('id', delivery_id)
      .single()

    if (fetchError || !delivery) {
      return new Response(
        JSON.stringify({ error: 'Entrega não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (delivery.driver_id !== driver_id) {
      return new Response(
        JSON.stringify({ error: 'Esta entrega não está atribuída a você' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (delivery.status !== 'picked_up') {
      return new Response(
        JSON.stringify({ error: 'A entrega não está no status correto para conclusão' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update delivery status to delivered
    const { data: updatedDelivery, error: updateError } = await supabaseClient
      .from('deliveries')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', delivery_id)
      .eq('status', 'picked_up')
      .eq('driver_id', driver_id)
      .select()
      .single()

    if (updateError || !updatedDelivery) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível atualizar o status da entrega' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate platform fee (20%) and driver earnings (80%)
    const platformFee = delivery.price * 0.20
    const driverEarnings = delivery.price * 0.80

    // Get current driver balance
    const { data: driverBalance } = await supabaseClient
      .from('drivers')
      .select('earnings_balance')
      .eq('id', driver_id)
      .single()

    // Update driver earnings balance
    const { error: driverBalanceError } = await supabaseClient
      .from('drivers')
      .update({
        earnings_balance: (driverBalance?.earnings_balance || 0) + driverEarnings
      })
      .eq('id', driver_id)

    if (driverBalanceError) {
      console.error('Error updating driver balance:', driverBalanceError)
    }

    // Get current restaurant balance
    const { data: restaurantBalance } = await supabaseClient
      .from('restaurants')
      .select('wallet_balance')
      .eq('id', delivery.restaurant_id)
      .single()

    // Deduct from restaurant wallet
    const { error: restaurantBalanceError } = await supabaseClient
      .from('restaurants')
      .update({
        wallet_balance: (restaurantBalance?.wallet_balance || 0) - delivery.price
      })
      .eq('id', delivery.restaurant_id)

    if (restaurantBalanceError) {
      console.error('Error updating restaurant balance:', restaurantBalanceError)
    }

    // Create transaction records
    const transactions = [
      {
        driver_id: driver_id,
        delivery_id: delivery_id,
        restaurant_id: delivery.restaurant_id,
        amount: delivery.price,
        driver_earnings: driverEarnings,
        platform_fee: platformFee,
        type: 'earning',
        description: 'Pagamento de entrega concluída'
      },
      {
        restaurant_id: delivery.restaurant_id,
        delivery_id: delivery_id,
        amount: -delivery.price,
        type: 'payment',
        description: 'Pagamento de entrega realizada'
      },
      {
        delivery_id: delivery_id,
        amount: platformFee,
        type: 'platform_fee',
        description: 'Taxa da plataforma (20%)'
      }
    ]

    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert(transactions)

    if (transactionError) {
      console.error('Error creating transactions:', transactionError)
    }

    // Update driver total deliveries count
    const { data: driverStats } = await supabaseClient
      .from('drivers')
      .select('total_deliveries')
      .eq('id', driver_id)
      .single()

    if (driverStats) {
      await supabaseClient
        .from('drivers')
        .update({ 
          total_deliveries: (driverStats.total_deliveries || 0) + 1
        })
        .eq('id', driver_id)
    }

    console.log('Delivery completed successfully:', updatedDelivery.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        delivery: updatedDelivery 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in complete-delivery function:', error)
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