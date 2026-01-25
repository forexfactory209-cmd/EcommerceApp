import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(url, serviceKey);

serve(async () => {
  // 1. Load unprocessed queue items
  const { data: queue, error } = await supabase
    .from("notification_queue")
    .select("id, user_id, title, body, data")
    .is("processed_at", null)
    .limit(100);

  if (error) {
    console.error("Queue read error", error);
    return new Response("error", { status: 500 });
  }

  if (!queue || queue.length === 0) {
    return new Response("no_queue_items", { status: 200 });
  }

  // 2. Insert into Supabase Notification Center table
  //    Adjust table/columns to match your actual Notification Center schema.
  const { error: insertError } = await supabase
    .from("notifications") // Supabase NC table (with internal trigger)
    .insert(
      queue.map((q) => ({
        user_id: q.user_id,
        title: q.title,
        body: q.body,
        data: q.data ?? {},
      }))
    );

  if (insertError) {
    console.error("NC insert error", insertError);
    // mark all as errored
    await supabase
      .from("notification_queue")
      .update({ error: insertError.message })
      .in("id", queue.map((q) => q.id));
    return new Response("error", { status: 500 });
  }

  // 3. Mark queue rows as processed
  const { error: updateError } = await supabase
    .from("notification_queue")
    .update({ processed_at: new Date().toISOString(), error: null })
    .in("id", queue.map((q) => q.id));

  if (updateError) {
    console.error("Queue mark error", updateError);
    return new Response("error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
