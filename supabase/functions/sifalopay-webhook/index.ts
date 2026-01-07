import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Webhook handler for Sifalo Pay
// Adjust the payload parsing and any signature verification
// according to the official Sifalo Pay webhook documentation.

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const sifaloWebhookSecret = Deno.env.get("SIFALOPAY_WEBHOOK_SECRET") || "";

    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();

    // TODO: verify signature if Sifalo Pay sends one (recommended)
    // Example if they send an HMAC signature header:
    // const signature = req.headers.get("x-sifalopay-signature") ?? "";
    // verify with sifaloWebhookSecret here.

    // Example payload fields – replace with real keys from Sifalo docs
    const transactionId = payload.transaction_id || payload.id;
    const status = (payload.status || "").toLowerCase();
    const reference = payload.reference || payload.order_ref || "";

    if (!transactionId || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update payment row for Sifalo Pay only
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .update({
        status,
        updated_at: new Date().toISOString(),
        raw_response: payload,
      })
      .eq("provider", "sifalopay")
      .eq("gateway_reference", transactionId)
      .select()
      .single();

    if (paymentError) throw paymentError;

    // If success, mark the order as paid and credit seller wallet
    if (status === "success" && payment?.order_id) {
      // 1) Mark order as paid
      await supabase
        .from("orders")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.order_id);

      // 2) Credit seller wallet using brand_user_id on the payment
      if (payment.brand_user_id) {
        // Find or create wallet for this seller (brand_user_id)
        const { data: existingWallet, error: walletSelectError } = await supabase
          .from("wallets")
          .select("id, balance, currency")
          .eq("brand_user_id", payment.brand_user_id)
          .maybeSingle();

        if (walletSelectError) {
          console.error("Error loading wallet", walletSelectError);
        } else {
          let walletId = existingWallet?.id;
          const currency = existingWallet?.currency || payment.currency || "USD";

          // If no wallet, create one
          if (!walletId) {
            const { data: newWallet, error: walletInsertError } = await supabase
              .from("wallets")
              .insert({
                brand_user_id: payment.brand_user_id,
                balance: 0,
                currency,
              })
              .select("id")
              .single();

            if (walletInsertError) {
              console.error("Error creating wallet", walletInsertError);
            } else {
              walletId = newWallet.id;
            }
          }

          if (walletId) {
            const amount = Number(payment.amount || payload.amount || 0);

            // 3) Increase wallet balance
            const { error: walletUpdateError } = await supabase.rpc(
              "increment_wallet_balance",
              {
                p_wallet_id: walletId,
                p_amount: amount,
              },
            );

            if (walletUpdateError) {
              console.error("Error updating wallet balance", walletUpdateError);
            }

            // 4) Insert wallet transaction log
            const { error: txError } = await supabase
              .from("wallet_transactions")
              .insert({
                wallet_id: walletId,
                payment_id: payment.id,
                amount,
                type: "credit",
                description: `Order ${payment.order_id} via Sifalo Pay`,
              });

            if (txError) {
              console.error("Error inserting wallet transaction", txError);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SifaloPay webhook error:", error);
    return new Response(
      JSON.stringify({
        error: (error as Error).message || "Webhook processing failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
