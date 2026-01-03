import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RATE_LIMIT_MINUTES = 60

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const payload = await req.json().catch(() => null) as {
    product_id: string
  } | null

  if (!payload?.product_id) {
    return new Response('Invalid payload', { status: 400 })
  }

  // Fetch product once to embed basic info in notification payload
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, price, image, image_full_url, quantity, brand_user_id, category_id, category')
    .eq('id', payload.product_id)
    .maybeSingle()

  if (productError) {
    console.error('Product fetch error', productError)
  }

  // If we don't know which brand/store owns this product, we cannot target followers
  if (!product?.brand_user_id) {
    return new Response('No brand for product', { status: 200 })
  }

  // 1) Get store/brand followers (store-level follow)
  const { data: followers, error: followersError } = await supabase
    .from('brand_follows')
    .select('user_id')
    .eq('brand_id', product.brand_user_id)

  if (followersError) {
    console.error('Followers error', followersError)
    return new Response('Followers error', { status: 500 })
  }

  if (!followers || followers.length === 0) {
    return new Response('No followers', { status: 200 })
  }

  const messages: Array<{ to: string; title: string; body: string; sound: string; data: any }> = []

  for (const f of followers) {
    const userId = f.user_id

    // preferences
    const { data: pref, error: prefError } = await supabase
      .from('notification_preferences')
      .select('restock')
      .eq('user_id', userId)
      .maybeSingle()

    if (prefError) {
      console.error('Pref error', userId, prefError)
      continue
    }

    if (!pref?.restock) continue

    // rate limit
    const { data: recent, error: rateError } = await supabase
      .from('notification_logs')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('type', 'restock')
      .eq('order_id', payload.product_id) // reuse column for product_id
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rateError) {
      console.error('Rate error', userId, rateError)
    } else if (recent) {
      const last = new Date(recent.created_at).getTime()
      const now = Date.now()
      const diffMin = (now - last) / 1000 / 60
      if (diffMin < RATE_LIMIT_MINUTES) {
        continue
      }
    }

    const { data: tokens, error: tokenError } = await supabase
      .from('user_devices')
      .select('expo_push_token')
      .eq('user_id', userId)

    if (tokenError) {
      console.error('Token error', userId, tokenError)
      continue
    }

    if (!tokens || tokens.length === 0) continue

    for (const t of tokens) {
      messages.push({
        to: t.expo_push_token,
        title: 'Back in stock!',
        body: '🔥 Item you wanted is back in stock!',
        sound: 'default',
        data: {
          productId: payload.product_id,
          // send minimal product snapshot so client can open details directly
          product,
        },
      })
    }

    // log notification
    const { error: logError } = await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        order_id: payload.product_id,
        type: 'restock'
      })

    if (logError) {
      console.error('Log error', userId, logError)
    }
  }

  if (messages.length === 0) {
    return new Response('No messages to send', { status: 200 })
  }

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

  return new Response('OK', { status: 200 })
})
