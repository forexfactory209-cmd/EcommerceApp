import { supabase } from '../lib/supabase';

export async function fetchProductsFromSupabase() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching products from Supabase:', error.message);
    throw error;
  }

  const rows = data || [];

  // Normalize fields so all screens can use them directly
  return rows.map((p) => {
    const images = Array.isArray(p.images)
      ? p.images
      : p.image
      ? [p.image]
      : [];

    const colors = Array.isArray(p.colors) ? p.colors : [];
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];

    const deliveryOptions = Array.isArray(p.delivery_options)
      ? p.delivery_options
      : Array.isArray(p.deliveryOptions)
      ? p.deliveryOptions
      : [];

    return {
      ...p,
      images,
      colors,
      sizes,
      deliveryOptions,
    };
  });
}
