import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    
    // Extract transaction details from Dpay webhook
    const transactionId = payload.transaction_id || payload.id;
    const status = (payload.status || "").toLowerCase();

    if (!transactionId || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update payment status
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .update({
        status,
        updated_at: new Date().toISOString(),
        raw_response: payload
      })
      .eq("dpay_reference", transactionId)
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Update order status if payment succeeded
    if (status === "success" && payment?.order_id) {
      await supabase
        .from("orders")
        .update({ 
          status: "paid",
          updated_at: new Date().toISOString()
        })
        .eq("id", payment.order_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Webhook processing failed",
        details: error.details
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});