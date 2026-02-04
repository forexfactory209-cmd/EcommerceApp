import { supabase } from '../lib/supabase';

export async function fetchApprovedBrandsFromSupabase() {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('status', 'approved')
    .order('name', { ascending: true });

  if (error) {
    console.warn('Error fetching brands from Supabase:', error.message);
    throw error;
  }

  return data || [];
}

export async function fetchApprovedBrandsPageFromSupabase({ page = 1, pageSize = 20 } = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('status', 'approved')
    .order('name', { ascending: true })
    .range(from, to);

  if (error) {
    console.warn('Error fetching paged brands from Supabase:', error.message);
    throw error;
  }

  return data || [];
}
