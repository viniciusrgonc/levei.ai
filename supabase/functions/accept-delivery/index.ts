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
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      console.error('Missing/invalid authorization header')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: missing token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // User-scoped client used ONLY for auth validation (relies on Authorization header)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service client for privileged DB ops
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

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

    // Use atomic database function to prevent race conditions
    const { data: result, error: acceptError } = await supabaseClient
      .rpc('accept_delivery_atomic', {
        p_delivery_id: delivery_id,
        p_driver_id: driver_id
      })

    if (acceptError) {
      console.error('Error calling accept_delivery_atomic:', acceptError)
      return new Response(
        JSON.stringify({ error: 'Erro ao aceitar entrega' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!result.success) {
      console.log('Delivery acceptance failed:', result.error)
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const updatedDelivery = result.delivery
    console.log('Delivery accepted successfully:', updatedDelivery.id)

    // Get restaurant info for notification
    const { data: restaurantData } = await supabaseClient
      .from('restaurants')
      .select('user_id')
      .eq('id', updatedDelivery.restaurant_id)
      .single()

    // Get driver info for notification
    const { data: driverData } = await supabaseClient
      .from('drivers')
      .select('user_id')
      .eq('id', driver_id)
      .single()

    if (driverData?.user_id && restaurantData?.user_id) {
      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', driverData.user_id)
        .single()

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