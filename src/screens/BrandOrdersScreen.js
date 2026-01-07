import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Clock, ShoppingBag } from 'lucide-react-native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'ready_to_ship', label: 'Ready to Ship' },
  { id: 'completed', label: 'Completed' },
];

const getOrderImageUrl = (item, firstItem) => {
  const src = firstItem || {};
  const candidates = [
    src.image_full_url,
    src.image_thumb_url,
    src.image,
    item.image_full_url,
    item.image_thumb_url,
    item.image,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const url = candidates[i];
    if (typeof url === 'string' && url.length > 0) {
      return url;
    }
  }

  return null;
};

const BrandOrdersScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadOrders = async () => {
      try {
        if (!authUserId) {
          setOrders([]);
          return;
        }

        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('brand_user_id', authUserId)
          .order('placed_at', { ascending: false });

        if (error) {
          console.warn(
            'Error loading brand orders for BrandOrdersScreen:',
            error.message || error,
          );
          return;
        }

        if (isActive) {
          setOrders(Array.isArray(data) ? data : []);
        }
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

  const filteredOrders = useMemo(() => {
    return (orders || []).filter((o) => {
      if (filter === 'all') return true;

      const brandAcceptedAt = o.brand_accepted_at;
      const onTheWayAt = o.on_the_way_at;
      const deliveredAt = o.delivered_at;

      if (filter === 'pending') {
        return !brandAcceptedAt && !onTheWayAt && !deliveredAt;
      }

      if (filter === 'ready_to_ship') {
        return !!brandAcceptedAt && !onTheWayAt && !deliveredAt;
      }

      if (filter === 'completed') {
        return !!deliveredAt;
      }

      return true;
    });
  }, [orders, filter]);

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

    let statusLabel = 'Pending';
    let statusTone = 'pending';

    if (brandAcceptedAt && !onTheWayAt && !deliveredAt) {
      statusLabel = 'Ready to Ship';
      statusTone = 'ready';
    } else if (deliveredAt) {
      statusLabel = 'Completed';
      statusTone = 'completed';
    }

    const imageUrl = getOrderImageUrl(item, firstItem);
    const isExpanded = expandedOrderId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.orderId}>ID #{item.id}</Text>
          <View style={styles.orderTimeWrapper}>
            <Clock size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
            <Text style={styles.orderTimeLabel}>
              {item.placed_at
                ? new Date(item.placed_at).toLocaleDateString()
                : ''}
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
              {title}
            </Text>
            <Text style={styles.productMeta} numberOfLines={1}>
              Qty: {qty}
            </Text>

            <View style={styles.amountRow}>
              <View>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>${amount.toFixed(2)}</Text>
              </View>
              <View style={[styles.statusPill, styles[`statusPill_${statusTone}`]]}>
                <Text
                  style={[
                    styles.statusPillText,
                    styles[`statusPillText_${statusTone}`],
                  ]}
                >
                  {statusLabel.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {statusTone === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryCta, styles.primaryCtaAccept]}
              onPress={() => {
                navigation.navigate('VendorOrders', {
                  orderId: item.id,
                  action: 'accept',
                });
              }}
            >
              <View style={styles.primaryCtaContentRow}>
                <ShoppingBag size={14} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.primaryCtaText}>Accept</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryCta, styles.primaryCtaReject]}
              onPress={() => {
                navigation.navigate('VendorOrders', {
                  orderId: item.id,
                  action: 'reject',
                });
              }}
            >
              <View style={styles.primaryCtaContentRow}>
                <ShoppingBag size={14} color="#111827" style={{ marginRight: 6 }} />
                <Text style={[styles.primaryCtaText, { color: '#111827' }]}>
                  Reject
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {statusTone !== 'pending' && (
          <TouchableOpacity
            style={[styles.primaryCta, styles.primaryCtaSingle]}
            onPress={() => {
              setExpandedOrderId(isExpanded ? null : item.id);
            }}
          >
            <View style={styles.primaryCtaContentRow}>
              <ShoppingBag size={14} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.primaryCtaText}>View Details</Text>
            </View>
          </TouchableOpacity>
        )}

        {statusTone === 'pending' && (
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => {
              setExpandedOrderId(isExpanded ? null : item.id);
            }}
          >
            <Text style={styles.viewDetailsText}>
              {isExpanded ? 'Hide details' : 'View details'}
            </Text>
          </TouchableOpacity>
        )}

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
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity style={styles.filterIconButton}>
          <Text style={styles.filterIconText}>⚙️</Text>
        </TouchableOpacity>
      </View>

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

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#090966" />
        </View>
      )}

      {!loading && filteredOrders.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>
            New orders for your store will appear here.
          </Text>
        </View>
      )}

      {!loading && filteredOrders.length > 0 && (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderCard}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  filterIconButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  filterIconText: {
    fontSize: 16,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
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
  statusPill_pending: {
    borderColor: '#F97316',
    backgroundColor: '#FFEDD5',
  },
  statusPill_ready: {
    borderColor: '#3B82F6',
    backgroundColor: '#DBEAFE',
  },
  statusPill_completed: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillText_pending: {
    color: '#C2410C',
  },
  statusPillText_ready: {
    color: '#1D4ED8',
  },
  statusPillText_completed: {
    color: '#047857',
  },
  primaryCta: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  primaryCtaText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryCtaAccept: {
    backgroundColor: '#090966',
    marginRight: 8,
  },
  primaryCtaReject: {
    backgroundColor: '#E5E7EB',
  },
  primaryCtaSingle: {
    backgroundColor: '#090966',
    marginTop: 10,
  },
  primaryCtaContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  viewDetailsButton: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
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