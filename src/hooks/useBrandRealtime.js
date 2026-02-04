import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

// Centralized realtime subscriptions for brand users.
// Focus: keep the brand's orders list in the global store live so that
// Home, Brand Orders, Profile, Wallet, Transactions, etc. immediately
// reflect new/updated orders without manual refresh.
export default function useBrandRealtime() {
  const authUserId = useStore((state) => state.authUserId);
  const authRole = useStore((state) => state.authRole);
  const setOrders = useStore((state) => state.setOrders);
  const loadUnreadNotifications = useStore((state) => state.loadUnreadNotifications);
  const markBrandDisputesDirty = useStore((state) => state.markBrandDisputesDirty);

  useEffect(() => {
    if (!authUserId || authRole !== 'brand') return;

    const reloadBrandOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            id,
            order_id,
            product_id,
            brand_user_id,
            name,
            quantity,
            unit_price,
            color,
            size,
            delivery_type,
            image_url,
            orders:orders (
              id,
              subtotal,
              shipping,
              total,
              status,
              placed_at,
              payment_method,
              delivery_address,
              shipping_method,
              promo_code,
              customer_name,
              customer_phone,
              customer_secondary_phone,
              brand_accepted_at,
              on_the_way_at,
              delivered_at
            )
          `)
          .eq('brand_user_id', authUserId)
          .order('order_id', { ascending: false });

        if (error) {
          console.warn('[useBrandRealtime] failed to reload brand orders', error.message || error);
          return;
        }

        const byOrderId = (data || []).reduce((acc, row) => {
          const o = row.orders;
          if (!o) return acc;

          const orderId = o.id;
          if (!acc[orderId]) {
            acc[orderId] = {
              id: orderId,
              items: [],
              subtotal: Number(o.subtotal) || 0,
              shipping: Number(o.shipping) || 0,
              total: Number(o.total) || 0,
              status: o.status || 'Pending',
              date: o.placed_at ? new Date(o.placed_at).toLocaleDateString() : '',
              brand_user_id: authUserId,
              payment_method: o.payment_method || 'cash_on_delivery',
              delivery_address: o.delivery_address || '',
              shipping_method: o.shipping_method || null,
              promo_code: o.promo_code || null,
              customer_name: o.customer_name || null,
              customer_phone: o.customer_phone || null,
              customer_secondary_phone: o.customer_secondary_phone || null,
              brand_accepted_at: o.brand_accepted_at || null,
              on_the_way_at: o.on_the_way_at || null,
              delivered_at: o.delivered_at || null,
            };
          }

          acc[orderId].items.push({
            id: row.product_id || row.id,
            name: row.name,
            quantity: row.quantity,
            price: row.unit_price,
            color: row.color,
            size: row.size,
            delivery_type: row.delivery_type,
            image: row.image_url,
          });

          return acc;
        }, {});

        const mappedOrders = Object.values(byOrderId);
        setOrders(mappedOrders);
      } catch (e) {
        console.warn('[useBrandRealtime] unexpected error reloading brand orders', e.message || e);
      }
    };

    // Initial load to ensure orders are present when the brand logs in
    reloadBrandOrders();
    // Initial load of unread notifications for this brand user
    loadUnreadNotifications();

    // Subscribe to order_items changes for this brand and reload on any change
    const ordersChannel = supabase
      .channel(`brand-orders-${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `brand_user_id=eq.${authUserId}`,
        },
        () => {
          reloadBrandOrders();
        },
      )
      .subscribe();

    // Subscribe to support_tickets changes and mark disputes as dirty so
    // BrandDisputesScreen and brand recent-activity loaders can reload.
    const disputesChannel = supabase
      .channel(`brand-disputes-${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        () => {
          markBrandDisputesDirty();
        },
      )
      .subscribe();

    // Subscribe to notifications table for this brand user and reload unread count
    const notificationsChannel = supabase
      .channel(`brand-notifications-${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${authUserId}`,
        },
        () => {
          loadUnreadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(disputesChannel);
    };
  }, [authUserId, authRole, setOrders, loadUnreadNotifications, markBrandDisputesDirty]);
}
