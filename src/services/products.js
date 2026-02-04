import { supabase } from '../lib/supabase';

export async function fetchProductsFromSupabase({ page = 1, pageSize = 20 } = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('products')
    .select(
      [
        'id',
        'name',
        'description',
        'price',
        'flash_price',
        'flash_start_at',
        'flash_end_at',
        'flash_quantity',
        'flash_sold',
        'image',
        'image_thumb_url',
        'image_full_url',
        'brand',
        'brand_user_id',
        'category',
        'audience',
        'quantity',
        'images',
        'colors',
        'sizes',
        'delivery_options',
        'product_discount_percentage',
        'product_discount_active',
        'created_at',
        'is_deleted',
        'code',
      ].join(',')
    )
    .or('is_deleted.is.null,is_deleted.eq.false')
    .order('created_at', { ascending: false })
    .range(from, to);

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
