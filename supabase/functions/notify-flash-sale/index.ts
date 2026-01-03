import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RATE_LIMIT_MINUTES = 30

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const payload = await req.json().catch(() => null) as {
    brand_id: string
    title?: string
    message?: string
    sale_id?: string
    sale_type?: 'flash_sale' | 'discount' | 'collection' | string
  } | null

  if (!payload?.brand_id) {
    return new Response('Invalid payload', { status: 400 })
  }

  // Fetch brand snapshot for notification context
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, user_id, name, logo_url, discount_percentage')
    .eq('id', payload.brand_id)
    .maybeSingle()

  if (brandError) {
    console.error('Brand fetch error', brandError)
  }

  const effectiveTitle =
    payload.title || (brand?.name ? `${brand.name} - Special Offer` : 'Special offer')
  const effectiveMessage =
    payload.message ||
    (payload.sale_type === 'flash_sale'
      ? '⚡ Flash sale is live at your favorite store!'
      : payload.sale_type === 'discount'
      ? '🔥 New discount available from a store you follow!'
      : '✨ New collection or promotion from a store you follow!')

  // 1) Get followers of this brand (store)
  const { data: followers, error: followersError } = await supabase
    .from('brand_follows')
    .select('user_id')
    .eq('brand_id', payload.brand_id)

  if (followersError) {
    console.error('FlashSale followers error', followersError)
    return new Response('Followers error', { status: 500 })
  }

  if (!followers || followers.length === 0) {
    return new Response('No followers', { status: 200 })
  }

  const now = Date.now()
  const windowMs = RATE_LIMIT_MINUTES * 60 * 1000

  const messages: Array<{ to: string; title: string; body: string; sound: string; data: any }> = []

  for (const f of followers) {
    const userId = f.user_id

    // Simple rate limit: avoid spamming same user+brand+sale_type too often
    const { data: last, error: lastError } = await supabase
      .from('notification_logs')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('order_id', payload.brand_id) // reuse column for brand id
      .eq('type', 'flash_sale')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastError && last) {
      const lastTs = new Date(last.created_at).getTime()
      if (now - lastTs < windowMs) {
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
        title: effectiveTitle,
        body: effectiveMessage,
        sound: 'default',
        data: {
          brandId: payload.brand_id,
          brand,
          saleId: payload.sale_id,
          saleType: payload.sale_type,
        },
      })
    }

    // Log one entry per user to enforce rate limiting
    const { error: logError } = await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        order_id: payload.brand_id,
        type: 'flash_sale',
      })

    if (logError) {
      console.error('FlashSale log error', userId, logError)
    }
  }

  if (messages.length === 0) {
    return new Response('No messages to send', { status: 200 })
  }

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  })

  if (!expoRes.ok) {
    const text = await expoRes.text()
    console.error('Expo error (flash-sale)', text)
    return new Response('Expo error', { status: 502 })
  }

  return new Response('OK', { status: 200 })
})
