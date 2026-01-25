import React, { useEffect, useState, useMemo, useRef } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Clock, ShoppingBag, Search, Bell } from 'lucide-react-native';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const FILTERS = [
  { id: 'new', label: 'New' },
  { id: 'packing', label: 'Packing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
];

const getOrderImageUrl = (item, firstItem) => {
  const src = firstItem || {};
  const candidates = [
    src.image_full_url,
    src.image_thumb_url,
    src.image,
    src.image_url,
    item.image_full_url,
    item.image_thumb_url,
    item.image,
    item.image_url,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const url = candidates[i];
    if (typeof url === 'string' && url.length > 0) {
      return url;
    }
  }

  return null;
};

const BrandOrdersScreen = ({ navigation, route }) => {
  const authUserId = useStore((state) => state.authUserId);

  const highlightOrderId = route?.params?.highlightOrderId || null;

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('new');

  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [justAcceptedId, setJustAcceptedId] = useState(null);

  const listRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    const loadOrders = async () => {
      try {
        if (!authUserId) {
          setOrders([]);
          return;
        }

        // 1) Legacy orders that have brand_user_id directly on orders
        const { data: legacyOrders, error: legacyError } = await supabase
          .from('orders')
          .select('*')
          .eq('brand_user_id', authUserId)
          .order('placed_at', { ascending: false });

        if (legacyError) {
          console.warn(
            'Error loading legacy brand orders for BrandOrdersScreen:',
            legacyError.message || legacyError,
          );
        }

        // 2) New/bundle orders via order_items joined to orders (per-brand view)
        const { data: orderItemRows, error: itemsError } = await supabase
          .from('order_items')
          .select(
            `
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
          `,
          )
          .eq('brand_user_id', authUserId)
          .order('order_id', { ascending: false });

        if (itemsError) {
          console.warn(
            'Error loading brand order items for BrandOrdersScreen:',
            itemsError.message || itemsError,
          );
        }

        if (!isActive) return;

        // Seed map with legacy orders so older single orders are included
        const byOrderId = (legacyOrders || []).reduce((acc, row) => {
          const orderId = row.id;
          if (!acc[orderId]) {
            acc[orderId] = {
              id: orderId,
              items: Array.isArray(row.items) ? row.items : [],
              subtotal: Number(row.subtotal) || 0,
              shipping: Number(row.shipping) || 0,
              total: Number(row.total) || 0,
              status: row.status || 'pending',
              placed_at: row.placed_at || null,
              brand_user_id: row.brand_user_id,
              payment_method: row.payment_method || 'cash_on_delivery',
              delivery_address: row.delivery_address || '',
              shipping_method: row.shipping_method || null,
              promo_code: row.promo_code || null,
              customer_name: row.customer_name || null,
              customer_phone: row.customer_phone || null,
              customer_secondary_phone: row.customer_secondary_phone || null,
              brand_accepted_at: row.brand_accepted_at || null,
              on_the_way_at: row.on_the_way_at || null,
              delivered_at: row.delivered_at || null,
            };
          }
          return acc;
        }, {});

        // Merge in per-brand items from order_items so bundles and new orders are unified.
        // If legacy items already exist on the order, we replace them so that
        // the first item (used for image/name) comes from order_items.
        (orderItemRows || []).forEach((row) => {
          const o = row.orders;
          if (!o) return;

          const orderId = o.id;
          if (!byOrderId[orderId]) {
            byOrderId[orderId] = {
              id: orderId,
              items: [],
              subtotal: Number(o.subtotal) || 0,
              shipping: Number(o.shipping) || 0,
              total: Number(o.total) || 0,
              status: o.status || 'pending',
              placed_at: o.placed_at || null,
              brand_user_id: row.brand_user_id,
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

          let list = Array.isArray(byOrderId[orderId].items)
            ? byOrderId[orderId].items
            : [];

          // On first order_items row for this order, drop any legacy items so
          // that we only show the per-brand items (with proper image_url, etc.).
          if (!byOrderId[orderId].itemsFromOrderItems) {
            list = [];
            byOrderId[orderId].itemsFromOrderItems = true;
          }

          const imageUrl = row.image_url || null;

          list.push({
            id: row.product_id || row.id,
            name: row.name,
            quantity: row.quantity,
            price: row.unit_price,
            color: row.color,
            size: row.size,
            delivery_type: row.delivery_type,
            // Store the product image URL in several common fields so different
            // screens/components can pick it up consistently
            image_full_url: imageUrl,
            image_thumb_url: imageUrl,
            image: imageUrl,
            image_url: imageUrl,
          });

          byOrderId[orderId].items = list;
        });

        const mergedOrders = Object.values(byOrderId);
        setOrders(mergedOrders);
      } catch (e) {
        console.warn(
          'Unexpected error loading brand orders for BrandOrdersScreen:',
          e.message || e,
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      isActive = false;
    };
  }, [authUserId]);

  // Enable layout animations on Android
  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      const brandAcceptedAt = o.brand_accepted_at;
      const onTheWayAt = o.on_the_way_at;
      const deliveredAt = o.delivered_at;
      const status = o.status;

      const rawStatus = typeof status === 'string' ? status.toLowerCase().trim() : '';

      // Exclude declined / cancelled orders from all tabs
      if (rawStatus === 'declined' || rawStatus.startsWith('cancel')) {
        return false;
      }

      if (filter === 'new') {
        return !brandAcceptedAt && !onTheWayAt && !deliveredAt;
      }

      if (filter === 'packing') {
        return !!brandAcceptedAt && !onTheWayAt && !deliveredAt;
      }

      if (filter === 'shipped') {
        return !!onTheWayAt && !deliveredAt;
      }

      if (filter === 'delivered') {
        return !!deliveredAt;
      }

      return true;
    });
  }, [orders, filter]);

  // When navigated from a notification with a specific order, ensure we show the
  // "New" tab and try to scroll to / expand that order card.
  useEffect(() => {
    if (!highlightOrderId || !filteredOrders || filteredOrders.length === 0) {
      return;
    }

    // Ensure we're on the New tab so new incoming orders are visible.
    if (filter !== 'new') {
      setFilter('new');
    }

    const index = filteredOrders.findIndex((o) => o.id === highlightOrderId);
    if (index === -1) return;

    setExpandedOrderId(highlightOrderId);

    // Give FlatList a moment to render before attempting to scroll.
    setTimeout(() => {
      try {
        if (listRef.current && typeof listRef.current.scrollToIndex === 'function') {
          listRef.current.scrollToIndex({ index, animated: true });
        }
      } catch (e) {
        // If scrolling fails (e.g. out of range), we still have the card expanded.
      }
    }, 300);
  }, [highlightOrderId, filteredOrders, filter]);

  const handleAcceptOrder = async (orderId) => {
    if (!orderId) return;

    try {
      // Immediately reflect in UI that this order is accepted
      setJustAcceptedId(orderId);

      const acceptedAt = new Date().toISOString();
      const { error } = await supabase
        .from('orders')
        .update({ brand_accepted_at: acceptedAt, status: 'accepted' })
        .eq('id', orderId);

      if (error) {
        console.warn('BrandOrdersScreen: accept order error:', error.message || error);
        Alert.alert('Error', error.message || 'Could not accept this order.');
        return;
      }

      // Briefly show the "Accepted" label before animating the card to Packing
      setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOrders((prev) =>
          Array.isArray(prev)
            ? prev.map((o) =>
                o.id === orderId
                  ? { ...o, brand_accepted_at: acceptedAt, status: 'accepted' }
                  : o,
              )
            : prev,
        );
        setJustAcceptedId(null);
      }, 350);
    } catch (e) {
      console.warn('BrandOrdersScreen: exception accepting order:', e.message || e);
      Alert.alert('Error', 'Something went wrong while accepting this order.');
    }
  };

  const handleDeclineOrder = async (orderId) => {
    if (!orderId) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'declined', decline_reason: 'Declined by brand' })
        .eq('id', orderId);

      if (error) {
        console.warn('BrandOrdersScreen: decline order error:', error.message || error);
        Alert.alert('Error', error.message || 'Could not decline this order.');
        return;
      }

      // Animate list change and remove declined order from local list so it disappears
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOrders((prev) =>
        Array.isArray(prev) ? prev.filter((o) => o.id !== orderId) : prev,
      );
    } catch (e) {
      console.warn('BrandOrdersScreen: exception declining order:', e.message || e);
      Alert.alert('Error', 'Something went wrong while declining this order.');
    }
  };

  const renderOrderCard = ({ item }) => {
    const itemsArray = Array.isArray(item.items) ? item.items : [];
    const firstItem = itemsArray[0] || null;
    const productName = firstItem?.name || item.first_item_name || 'Order';
    const customerName = item.customer_name || '';
    const title = customerName ? `${productName} · ${customerName}` : productName;

    const amount = Number(item.total) || 0;
    const qty = itemsArray.length || item.quantity || 1;

    const brandAcceptedAt = item.brand_accepted_at;
    const onTheWayAt = item.on_the_way_at;
    const deliveredAt = item.delivered_at;

    let statusLabel = 'New';
    let statusTone = 'new';

    if (brandAcceptedAt && !onTheWayAt && !deliveredAt) {
      statusLabel = 'Packing';
      statusTone = 'packing';
    }

    if (onTheWayAt && !deliveredAt) {
      statusLabel = 'Shipped';
      statusTone = 'shipped';
    }

    if (deliveredAt) {
      statusLabel = 'Delivered';
      statusTone = 'delivered';
    }

    const imageUrl = getOrderImageUrl(item, firstItem);
    const isExpanded = expandedOrderId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          navigation.navigate('BrandOrderDetails', { order: item });
        }}
        style={styles.card}
      >
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.orderId}>Order #ORD-{String(item.id)}</Text>
            <Text style={styles.orderTimeLabel}>
              {item.placed_at
                ? new Date(item.placed_at).toLocaleDateString()
                : 'Recently'}
            </Text>
          </View>
          <View style={[styles.statusPill, styles[`statusPill_${statusTone}`]]}>
            <Text
              style={[
                styles.statusPillText,
                styles[`statusPillText_${statusTone}`],
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.cardMainRow}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Text style={styles.thumbnailPlaceholderText}>
                {productName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.cardInfo}>
            <Text style={styles.productTitle} numberOfLines={1}>
              {productName}
            </Text>
            <Text style={styles.productMeta} numberOfLines={1}>
              {qty} {qty === 1 ? 'item' : 'items'}
            </Text>
            {customerName ? (
              <Text style={styles.customerMeta} numberOfLines={1}>
                {customerName}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.cardFooterRow}>
          <View>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${amount.toFixed(2)}</Text>
          </View>

          {statusTone === 'new' && (
            <View style={styles.footerButtonsRow}>
              <TouchableOpacity
                style={[styles.secondaryButton]}
                onPress={() => {
                  handleDeclineOrder(item.id);
                }}
              >
                <Text style={styles.secondaryButtonText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, justAcceptedId === item.id && { opacity: 0.7 }]}
                disabled={justAcceptedId === item.id}
                onPress={() => {
                  if (!justAcceptedId) {
                    handleAcceptOrder(item.id);
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>
                  {justAcceptedId === item.id ? 'Accepted' : 'Accept'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {statusTone !== 'new' && (
            <TouchableOpacity
              style={styles.singleActionButton}
              onPress={() => {
                navigation.navigate('BrandOrderDetails', { order: item });
              }}
            >
              <Text style={styles.singleActionButtonText}>
                {statusTone === 'packing'
                  ? 'View Label'
                  : statusTone === 'shipped'
                  ? 'Print Label'
                  : 'View Details'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isExpanded && (
          <View style={styles.detailsSection}>
            {itemsArray.length > 0 && (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Items</Text>
                <View style={styles.detailsValueBlock}>
                  {itemsArray.map((it, index) => {
                    const itemName = it && it.name ? String(it.name) : 'Item';
                    const qty = it && typeof it.quantity === 'number' ? it.quantity : 1;
                    return (
                      <Text
                        key={index}
                        style={styles.detailsValueText}
                        numberOfLines={1}
                      >
                        - {itemName} x {qty}
                      </Text>
                    );
                  })}
                </View>
              </View>
            )}

            {customerName ? (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Customer</Text>
                <Text style={styles.detailsValueText}>{customerName}</Text>
              </View>
            ) : null}

            {item.customer_phone ? (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Phone</Text>
                <Text style={styles.detailsValueText}>
                  {item.customer_phone}
                </Text>
              </View>
            ) : null}

            {item.delivery_address ? (
              <View style={styles.detailsRow}>
                <Text style={styles.detailsLabel}>Address</Text>
                <Text
                  style={styles.detailsValueText}
                  numberOfLines={2}
                >
                  {item.delivery_address}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerIconsRow}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Search size={20} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconButton, { marginLeft: 8 }]}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={20} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={filteredOrders}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderOrderCard}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive,
                  ]}
                  onPress={() => setFilter(f.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            {loading ? (
              <ActivityIndicator size="small" color="#090966" />
            ) : (
              <>
                <Text style={styles.emptyTitle}>No orders yet</Text>
                <Text style={styles.emptySubtitle}>
                  New orders for your store will appear here.
                </Text>
              </>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    gap:12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    // paddingBottom: 5,
    
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  headerIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#EFEFF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    // paddingHorizontal: 16,
    // paddingVertical: 6,
    marginVertical: 14,
    alignItems: 'center',
  },
  filterChip: {
    minWidth: 110,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#090966',
  },
  filterChipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  orderTimeLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  orderTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 14,
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4B5563',
  },
  cardInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  productMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  statusPill: {
    minWidth: 76,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusPill_new: {
    borderColor: '#CBD5F5',
    backgroundColor: '#EEF2FF',
  },
  statusPill_accepted: {
    borderColor: '#F97316',
    backgroundColor: '#FFEDD5',
  },
  statusPill_shipped: {
    borderColor: '#3B82F6',
    backgroundColor: '#DBEAFE',
  },
  statusPill_delivered: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillText_new: {
    color: '#1D4ED8',
  },
  statusPillText_accepted: {
    color: '#C2410C',
  },
  statusPillText_shipped: {
    color: '#1D4ED8',
  },
  statusPillText_delivered: {
    color: '#047857',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  footerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  primaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#090966',
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  singleActionButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  singleActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  detailsSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    gap: 6,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 80,
  },
  detailsValueBlock: {
    flex: 1,
  },
  detailsValueText: {
    fontSize: 12,
    color: '#111827',
  },
});

export default BrandOrdersScreen;