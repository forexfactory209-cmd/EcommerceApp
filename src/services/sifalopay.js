import { supabase } from "../lib/supabase";

// Start a Sifalo Pay payment by invoking the `sifalopay-start` edge function.
// This is similar to how you could use the existing `start-payment` (Dpay) function.

export async function startSifaloPayPayment({
  user_id,
  total_amount,
  currency,
  payment_method,
  phone_number,
  brand_user_id,
}) {
  const { data, error } = await supabase.functions.invoke("sifalopay-start", {
    body: { user_id, total_amount, currency, payment_method, phone_number, brand_user_id },
  });

  if (error) {
    throw new Error(error.message || "Failed to start Sifalo Pay payment");
  }

  return data;
}

// You can also add helpers for checking payment status if you expose
// a REST endpoint or another edge function that reads from the payments table.
