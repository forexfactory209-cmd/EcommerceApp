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
