import { supabase } from '../lib/supabase';

export async function fetchUserProductRating(productId, userId) {
  if (!productId || !userId) return null;

  const { data, error } = await supabase
    .from('product_ratings')
    .select('rating')
    .eq('product_id', productId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.warn('Error fetching product rating', error.message || error);
    throw error;
  }

  return data?.rating ?? null;
}

export async function upsertUserProductRating(productId, userId, rating) {
  if (!productId || !userId) return;

  const value = Math.max(1, Math.min(5, Number(rating) || 0));
  if (!value) return;

  const { error } = await supabase
    .from('product_ratings')
    .upsert(
      { product_id: productId, user_id: userId, rating: value },
      { onConflict: 'product_id,user_id' },
    );

  if (error) {
    console.warn('Error saving product rating', error.message || error);
    throw error;
  }
}

export async function fetchProductRatingSummary(productId) {
  if (!productId) return { avg: null, count: 0 };

  const { data, error } = await supabase
    .from('product_ratings')
    .select('rating')
    .eq('product_id', productId);

  if (error) {
    console.warn('Error fetching product rating summary', error.message || error);
    throw error;
  }

  const rows = data || [];
  if (rows.length === 0) {
    return { avg: null, count: 0 };
  }

  const sum = rows.reduce((acc, row) => acc + (Number(row.rating) || 0), 0);
  const count = rows.length;
  const avg = count > 0 ? sum / count : null;

  return { avg, count };
}

export async function fetchManyProductRatingSummaries(productIds) {
  const uniqueIds = Array.from(new Set(productIds || [])).filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('product_ratings')
    .select('product_id, rating')
    .in('product_id', uniqueIds);

  if (error) {
    console.warn('Error fetching rating summaries', error.message || error);
    throw error;
  }

  const statsMap = {};

  (data || []).forEach((row) => {
    const id = row.product_id;
    const value = Number(row.rating) || 0;
    if (!id || !value) return;

    if (!statsMap[id]) {
      statsMap[id] = { sum: 0, count: 0 };
    }
    statsMap[id].sum += value;
    statsMap[id].count += 1;
  });

  const result = {};
  Object.entries(statsMap).forEach(([id, { sum, count }]) => {
    result[id] = {
      avg: count > 0 ? sum / count : null,
      count,
    };
  });

  return result;
}
