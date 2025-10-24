import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

console.log('Pickup Delivery Function loaded')

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
    
    console.log('Pickup delivery request:', { delivery_id, driver_id, user_id: user.id })

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

    // Verify delivery is assigned to this driver and in accepted status
    const { data: delivery, error: fetchError } = await supabaseClient
      .from('deliveries')
      .select('id, status, driver_id, restaurant_id')
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

    if (delivery.status !== 'accepted') {
      return new Response(
        JSON.stringify({ error: 'A entrega não está no status correto para coleta' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update delivery status to picked_up
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
      return new Response(
        JSON.stringify({ error: 'Não foi possível atualizar o status da entrega' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Delivery picked up successfully:', updatedDelivery.id)

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
    console.error('Error in pickup-delivery function:', error)
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