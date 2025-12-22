import { supabase } from '../lib/supabase';

const PAGE_SIZE = 10;

export async function fetchProductReviews({
  productId,
  page = 1,
  ratingFilter,
  withPhotos,
  withSizeInfo,
  sortBy = 'recent', // 'recent' | 'helpful'
}) {
  if (!productId) return { items: [], hasMore: false };

  let query = supabase
    .from('product_reviews')
    .select('*', { count: 'exact' })
    .eq('product_id', productId);

  if (ratingFilter) {
    query = query.eq('rating', ratingFilter);
  }
  if (withPhotos) {
    query = query.not('photos', 'eq', '{}');
  }
  if (withSizeInfo) {
    query = query.not('size_feedback', 'is', null);
  }

  if (sortBy === 'helpful') {
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.warn('Error fetching product reviews', error.message || error);
    throw error;
  }

  const items = data || [];
  const total = typeof count === 'number' ? count : items.length;
  const hasMore = to + 1 < total;

  return { items, hasMore };
}

export async function createProductReview({
  productId,
  userId,
  userDisplayName,
  rating,
  text,
  sizeFeedback,
  tags,
  photos,
  countryCode,
  deviceLang,
}) {
  if (!productId || !userId) return null;

  const value = Math.max(1, Math.min(5, Number(rating) || 0));
  if (!value || !text) return null;

  const payload = {
    product_id: productId,
    user_id: userId,
    user_display_name: userDisplayName || null,
    rating: value,
    text,
    size_feedback: sizeFeedback || null,
    tags: Array.isArray(tags) ? tags : [],
    photos: Array.isArray(photos) ? photos.slice(0, 5) : [],
    country_code: countryCode || null,
    device_lang: deviceLang || null,
  };

  const { data, error } = await supabase
    .from('product_reviews')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.warn('Error creating product review', error.message || error);
    throw error;
  }

  return data;
}

export async function addReviewReply({ reviewId, userId, text, isBrandOwner }) {
  if (!reviewId || !userId || !text) return null;

  const { data, error } = await supabase
    .from('product_review_replies')
    .insert({
      review_id: reviewId,
      user_id: userId,
      text,
      is_brand_owner: !!isBrandOwner,
    })
    .select('*')
    .single();

  if (error) {
    console.warn('Error adding review reply', error.message || error);
    throw error;
  }

  return data;
}

export async function fetchReviewReplies(reviewIds) {
  const uniqueIds = Array.from(new Set(reviewIds || [])).filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('product_review_replies')
    .select('*')
    .in('review_id', uniqueIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Error fetching review replies', error.message || error);
    throw error;
  }

  const map = {};
  (data || []).forEach((row) => {
    const id = row.review_id;
    if (!map[id]) map[id] = [];
    map[id].push(row);
  });

  return map;
}

export async function updateReviewReply({ replyId, userId, text }) {
  if (!replyId || !userId || !text) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('product_review_replies')
    .update({ text: trimmed })
    .eq('id', replyId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    console.warn('Error updating review reply', error.message || error);
    throw error;
  }

  return data;
}

export async function deleteReviewReply({ replyId, userId }) {
  if (!replyId || !userId) return;

  const { error } = await supabase
    .from('product_review_replies')
    .delete()
    .eq('id', replyId)
    .eq('user_id', userId);

  if (error) {
    console.warn('Error deleting review reply', error.message || error);
    throw error;
  }
}

export async function updateProductReview({
  reviewId,
  userId,
  rating,
  text,
  sizeFeedback,
  tags,
  photos,
}) {
  if (!reviewId || !userId) return null;

  const value = rating != null ? Math.max(1, Math.min(5, Number(rating) || 0)) : null;

  const patch = {
    text,
    size_feedback: sizeFeedback || null,
    tags: Array.isArray(tags) ? tags : undefined,
    photos: Array.isArray(photos) ? photos.slice(0, 5) : undefined,
  };

  if (value) {
    patch.rating = value;
  }

  const { data, error } = await supabase
    .from('product_reviews')
    .update(patch)
    .eq('id', reviewId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    console.warn('Error updating product review', error.message || error);
    throw error;
  }

  return data;
}

export async function deleteProductReview({ reviewId, userId }) {
  if (!reviewId || !userId) return;

  const { error } = await supabase
    .from('product_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId);

  if (error) {
    console.warn('Error deleting product review', error.message || error);
    throw error;
  }
}
