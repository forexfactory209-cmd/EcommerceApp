import { supabase } from '../lib/supabase';

const PAGE_SIZE = 10;

export async function fetchProductQuestions({ productId, page = 1 }) {
  if (!productId) return { items: [], hasMore: false };

  let query = supabase
    .from('product_questions')
    .select('*', { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.warn('Error fetching product questions', error.message || error);
    throw error;
  }

  const items = data || [];
  const total = typeof count === 'number' ? count : items.length;
  const hasMore = to + 1 < total;

  return { items, hasMore };
}

export async function createProductQuestion({
  productId,
  userId,
  text,
  countryCode,
  deviceLang,
}) {
  if (!productId || !userId || !text) return null;

  const payload = {
    product_id: productId,
    user_id: userId,
    text,
    country_code: countryCode || null,
    device_lang: deviceLang || null,
  };

  const { data, error } = await supabase
    .from('product_questions')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    console.warn('Error creating product question', error.message || error);
    throw error;
  }

  return data;
}

export async function fetchAnswersForQuestions(questionIds) {
  const uniqueIds = Array.from(new Set(questionIds || [])).filter(Boolean);
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('product_answers')
    .select('*')
    .in('question_id', uniqueIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Error fetching product answers', error.message || error);
    throw error;
  }

  const map = {};
  (data || []).forEach((row) => {
    const id = row.question_id;
    if (!map[id]) map[id] = [];
    map[id].push(row);
  });

  return map;
}

export async function createProductAnswer({
  questionId,
  userId,
  text,
  isBrandOwner,
}) {
  if (!questionId || !userId || !text) return null;

  const { data, error } = await supabase
    .from('product_answers')
    .insert({
      question_id: questionId,
      user_id: userId,
      text,
      is_brand_owner: !!isBrandOwner,
    })
    .select('*')
    .single();

  if (error) {
    console.warn('Error creating product answer', error.message || error);
    throw error;
  }

  return data;
}
