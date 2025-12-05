import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    const dpayApiKey = Deno.env.get("DPAY_API_KEY") || "";

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { user_id, total_amount, currency, payment_method, phone_number } = await req.json();

    // Validate required fields
    if (!total_amount || !payment_method || !phone_number) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create order record
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id,
        total_amount,
        currency,
        status: "pending",
        payment_method,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        provider: "dpay",
        method: payment_method,
        phone_number,
        amount: total_amount,
        currency,
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Call Dpay API
    const dpayResponse = await fetch("https://api.dpay.example.com/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${dpayApiKey}`, // Add authorization header
      },
      body: JSON.stringify({
        amount: total_amount,
        currency: currency,
        phone_number: phone_number,
        payment_method: payment_method,
        callback_url: `https://aeivheqhwlifhancoswz.functions.supabase.co/dpay-webhook`,
        reference: `order_${order.id}`,
      }),
    });

    const dpayData = await dpayResponse.json();

    if (!dpayResponse.ok) {
      throw new Error(dpayData.message || "Failed to initiate payment with Dpay");
    }

    // Update payment with Dpay reference
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        dpay_reference: dpayData.transaction_id,
        raw_response: dpayData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        payment_id: payment.id,
        dpay_reference: dpayData.transaction_id,
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in start-payment:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Internal server error" 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
});