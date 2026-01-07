import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This function starts a Sifalo Pay payment.
// It mirrors the existing `start-payment` Dpay function but calls
// https://api.sifalopay.com/gateway/ instead.
//
// IMPORTANT: You *must* adjust the payload and response handling
// to match the official Sifalo Pay documentation.

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sifaloApiKey = Deno.env.get("SIFALOPAY_API_KEY") || "";
    const sifaloMerchantId = Deno.env.get("SIFALOPAY_MERCHANT_ID") || "";

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!sifaloApiKey || !sifaloMerchantId) {
      return new Response(
        JSON.stringify({ error: "Missing Sifalo Pay env (SIFALOPAY_API_KEY / SIFALOPAY_MERCHANT_ID)" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } },
      );
    }

    const { user_id, total_amount, currency, payment_method, phone_number, brand_user_id } = await req.json();

    if (!total_amount || !payment_method || !phone_number) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 1) Create order row
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

    // 2) Create payment row (provider = sifalopay)
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        provider: "sifalopay",
        method: payment_method,
        phone_number,
        amount: total_amount,
        currency,
        // Store seller (brand owner) user id so webhook can credit the right wallet
        brand_user_id,
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // 3) Call Sifalo Pay gateway
    // NOTE: This payload and response are EXAMPLES.
    // Replace keys/values with the official Sifalo Pay spec.
    const callbackUrl = `${supabaseUrl.replace(".co", ".functions.supabase.co")}/sifalopay-webhook`;

    const sifaloResponse = await fetch("https://api.sifalopay.com/gateway/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sifaloApiKey}`,
      },
      body: JSON.stringify({
        merchant_id: sifaloMerchantId,
        amount: total_amount,
        currency,
        phone_number,
        payment_method, // e.g. "zaad" | "edahab" depending on Sifalo docs
        callback_url: callbackUrl,
        reference: `order_${order.id}`,
      }),
    });

    const sifaloData = await sifaloResponse.json().catch(() => ({}));

    if (!sifaloResponse.ok) {
      console.error("Sifalo Pay error", sifaloResponse.status, sifaloData);
      throw new Error(sifaloData.message || "Failed to initiate payment with Sifalo Pay");
    }

    // Example: assume Sifalo Pay returns transaction_id
    const transactionId = sifaloData.transaction_id || sifaloData.id || null;

    const { error: updateError } = await supabase
      .from("payments")
      .update({
        gateway_reference: transactionId,
        raw_response: sifaloData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        payment_id: payment.id,
        gateway_reference: transactionId,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in sifalopay-start:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
