import { supabase } from '../lib/supabase';

export function subscribeToNotifications(userId, onNew) {
  const channel = supabase
    .channel('notifications-realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNew(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchNotificationsForUser(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      brands:brand_id (id, name, logo_url)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
