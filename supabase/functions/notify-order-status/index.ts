import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'Your order was received',
  accepted: 'Your order has been accepted',
  preparing: 'Your order is being prepared',
  shipped: 'Your order is on the way 🚚',
  delivered: 'Order delivered 🎉',
  cancelled: 'Order cancelled'
}

// simple rate limit window in minutes
const RATE_LIMIT_MINUTES = 2

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const payload = await req.json().catch(() => null) as {
    order_id: string
    status: string
    customer_id: string
    vendor_id: string
  } | null

  if (!payload?.order_id || !payload?.status || !payload?.customer_id) {
    return new Response('Invalid payload', { status: 400 })
  }

  const message = STATUS_MESSAGES[payload.status] ?? 'Order update'

  // 1) Check customer preferences
  const { data: pref, error: prefError } = await supabase
    .from('notification_preferences')
    .select('order_status')
    .eq('user_id', payload.customer_id)
    .maybeSingle()

  if (prefError) {
    console.error('Pref error', prefError)
    return new Response('Pref error', { status: 500 })
  }

  if (!pref?.order_status) {
    return new Response('Order status notifications disabled', { status: 200 })
  }

  // 2) Rate limiting: last send within last RATE_LIMIT_MINUTES?
  const { data: recent, error: rateError } = await supabase
    .from('notification_logs')
    .select('id, created_at')
    .eq('user_id', payload.customer_id)
    .eq('order_id', payload.order_id)
    .eq('type', 'order_status')
    .eq('status', payload.status)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (rateError) {
    console.error('Rate check error', rateError)
  } else if (recent) {
    const last = new Date(recent.created_at).getTime()
    const now = Date.now()
    const diffMin = (now - last) / 1000 / 60
    if (diffMin < RATE_LIMIT_MINUTES) {
      return new Response('Rate limited', { status: 200 })
    }
  }

  // 3) Get tokens from user_devices (where mobile app saves Expo tokens)
  const { data: tokens, error: tokenError } = await supabase
    .from('user_devices')
    .select('expo_push_token')
    .eq('user_id', payload.customer_id)

  if (tokenError) {
    console.error('Token error', tokenError)
    return new Response('Token error', { status: 500 })
  }

  if (!tokens || tokens.length === 0) {
    return new Response('No tokens', { status: 200 })
  }

  // 4) Batch push to Expo
  const messages = tokens.map((t) => ({
    to: t.expo_push_token,
    title: 'Order Update',
    body: message,
    sound: 'default',
    data: { orderId: payload.order_id }
  }))

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages)
  })

  if (!expoRes.ok) {
    const text = await expoRes.text()
    console.error('Expo error', text)
    return new Response('Expo error', { status: 502 })
  }

  // 5) Log notification for rate limiting
  const { error: logError } = await supabase
    .from('notification_logs')
    .insert({
      user_id: payload.customer_id,
      order_id: payload.order_id,
      type: 'order_status',
      status: payload.status
    })

  if (logError) {
    console.error('Log error', logError)
  }

  return new Response('OK', { status: 200 })
})
