import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

console.log('Accept Delivery Function loaded')

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get auth header and validate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing authorization header')
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

    // Verify user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { delivery_id, driver_id } = await req.json()
    
    console.log('Accept delivery request:', { delivery_id, driver_id, user_id: user.id })

    // Input validation: Check for required fields
    if (!delivery_id || !driver_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: delivery_id and driver_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Input validation: Validate UUID format
    if (!UUID_REGEX.test(delivery_id)) {
      console.error('Invalid delivery_id format:', delivery_id)
      return new Response(
        JSON.stringify({ error: 'Invalid delivery ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UUID_REGEX.test(driver_id)) {
      console.error('Invalid driver_id format:', driver_id)
      return new Response(
        JSON.stringify({ error: 'Invalid driver ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authorization: Verify driver ownership
    const { data: driver, error: driverError } = await supabaseClient
      .from('drivers')
      .select('user_id')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      console.error('Driver lookup error:', driverError)
      return new Response(
        JSON.stringify({ error: 'Driver not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the authenticated user owns this driver account
    if (driver.user_id !== user.id) {
      console.error('Authorization failed: user', user.id, 'attempted to accept delivery as driver', driver_id)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this driver account' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if delivery is still pending
    if (delivery.status !== 'pending') {
      console.log('Delivery already assigned:', delivery.status)
      return new Response(
        JSON.stringify({ error: 'Esta entrega já foi aceita por outro motorista' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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