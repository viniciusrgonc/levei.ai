import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

console.log('Accept Delivery Function loaded')

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    // Get request body
    const { delivery_id, driver_id } = await req.json()
    
    console.log('Accept delivery request:', { delivery_id, driver_id })

    if (!delivery_id || !driver_id) {
      return new Response(
        JSON.stringify({ error: 'delivery_id and driver_id are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Start transaction-like operation by checking current status
    const { data: delivery, error: fetchError } = await supabaseClient
      .from('deliveries')
      .select('id, status, restaurant_id, driver_id, pickup_address')
      .eq('id', delivery_id)
      .single()

    if (fetchError || !delivery) {
      console.error('Delivery not found:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Entrega não encontrada' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if delivery is still pending
    if (delivery.status !== 'pending') {
      console.log('Delivery already assigned:', delivery.status)
      return new Response(
        JSON.stringify({ error: 'Esta entrega já foi aceita por outro motorista' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Update delivery with driver assignment
    const { data: updatedDelivery, error: updateError } = await supabaseClient
      .from('deliveries')
      .update({
        driver_id: driver_id,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', delivery_id)
      .eq('status', 'pending') // Double-check status hasn't changed
      .select()
      .single()

    if (updateError || !updatedDelivery) {
      console.error('Failed to update delivery:', updateError)
      return new Response(
        JSON.stringify({ error: 'Esta entrega já foi aceita por outro motorista' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Delivery accepted successfully:', updatedDelivery.id)

    // Get driver info for notification
    const { data: driverData } = await supabaseClient
      .from('drivers')
      .select('user_id')
      .eq('id', driver_id)
      .single()

    if (driverData?.user_id) {
      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', driverData.user_id)
        .single()

      // Notify restaurant about acceptance
      const { data: restaurantData } = await supabaseClient
        .from('restaurants')
        .select('user_id')
        .eq('id', delivery.restaurant_id)
        .single()

      if (restaurantData?.user_id) {
        const driverName = profileData?.full_name || 'Motorista'
        await supabaseClient.rpc('create_notification', {
          p_user_id: restaurantData.user_id,
          p_title: 'Entrega Aceita',
          p_message: `O motorista ${driverName} aceitou sua entrega!`,
          p_type: 'delivery_accepted',
          p_delivery_id: delivery_id
        })
        console.log('Notification sent to restaurant')
      }
    }

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
    console.error('Error in accept-delivery function:', error)
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
