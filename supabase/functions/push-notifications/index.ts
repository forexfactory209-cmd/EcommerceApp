import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_PUSH_SECRET");

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req) => {
  const secret = req.headers.get("x-internal-secret");

  if (!INTERNAL_SECRET || !secret || secret !== INTERNAL_SECRET) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, type, data, push_sent')
    .eq('push_sent', false)
    .limit(100);

  if (error) {
    console.error('Error fetching notifications', error);
    return new Response('error', { status: 500 });
  }

  if (!notifications || notifications.length === 0) {
    return new Response('no_notifications', { status: 200 });
  }

  for (const n of notifications) {
    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', n.user_id);

    if (tokenError) {
      console.error('Error fetching tokens', tokenError);
      continue;
    }

    if (!tokens || tokens.length === 0) {
      await supabase
        .from('notifications')
        .update({ push_sent: true, push_status: 'no_token' })
        .eq('id', n.id);
      continue;
    }

    let lastStatus = 'ok';

    for (const t of tokens) {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: t.expo_push_token,
          title: n.title,
          body: n.message,
          data: {
            type: n.type,
            ...n.data,
          },
        }),
      });

      if (!res.ok) {
        lastStatus = `error: ${res.status}`;
        console.error('Expo push error', await res.text());
      }
    }

    await supabase
      .from('notifications')
      .update({
        push_sent: true,
        push_status: lastStatus,
      })
      .eq('id', n.id);
  }

  return new Response('ok', { status: 200 });
});
