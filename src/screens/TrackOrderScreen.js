import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

const COLORS = {
  light: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
  },
  // Stylish order list rows (used as styles, not theme)
  orderListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  orderListTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderListMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  orderListHint: {
    fontSize: 11,
    marginTop: 4,
    color: '#9CA3AF',
  },
  orderListStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  orderListStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  orderListAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  primary: '#246BFD',
  status: {
    Delivered: ['#22C55E', '#16A34A'],
    CustomerConfirmed: ['#090966', '#090966'],
    'Out for Delivery': ['#A855F7', '#7C3AED'],
    Shipped: ['#3B82F6', '#1D4ED8'],
    Confirmed: ['#6366F1', '#4F46E5'],
    Pending: ['#FACC15', '#EAB308'],
    Canceled: ['#F97373', '#EF4444'],
  },
};

const mapStatusToPill = (status) => {
  const key = status || 'Pending';
  const gradient =
    COLORS.status[key] || COLORS.status.Pending;
  return { label: key, gradient };
};

const TrackOrderScreen = () => {
  const navigation = useNavigation();
  const authUserId = useStore((state) => state.authUserId);

  const palette = COLORS.light;

  const [ordersList, setOrdersList] = useState([]);
  const [ordersListLoading, setOrdersListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Delivered');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const headerAnim = useRef(new Animated.Value(0)).current;

  const loadOrdersList = useCallback(async () => {
    if (!authUserId) return;
    try {
      setOrdersListLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, total, placed_at, items, shipping_method')
        .eq('customer_user_id', authUserId)
        .order('placed_at', { ascending: false });

      if (error) {
        console.warn('TrackOrder: error loading orders list', error.message || error);
        setOrdersList([]);
        return;
      }

      const mapped = Array.isArray(data)
        ? data.map((row) => {
            const raw = (row.status || 'pending').toLowerCase();

            // Normalize backend statuses into the three buckets used by the UI
            let normalizedStatus = 'Pending';
            if (raw === 'delivered' || raw === 'customer_confirmed') {
              normalizedStatus = 'Delivered';
            } else if (raw === 'declined' || raw === 'canceled' || raw === 'cancelled') {
              normalizedStatus = 'Canceled';
            }

            return {
              id: row.id,
              status: normalizedStatus,
              rawStatus: raw,
              total: Number(row.total) || 0,
              placedAt: row.placed_at ? new Date(row.placed_at).toLocaleDateString() : '',
              items: Array.isArray(row.items) ? row.items : [],
              trackingNumber: null,
              sellerName: null,
              shippingMethod: row.shipping_method || null,
            };
          })
        : [];

      setOrdersList(mapped);
    } catch (e) {
      console.warn('TrackOrder: exception loading orders list', e.message || e);
      setOrdersList([]);
    } finally {
      setOrdersListLoading(false);
    }
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      loadOrdersList();
    }, [loadOrdersList]),
  );

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return [];

    if (statusFilter === 'Pending') {
      // Treat anything that is not Delivered or Canceled as pending / in-progress
      return ordersList.filter(
        (o) => o.status !== 'Delivered' && o.status !== 'Canceled',
      );
    }

    return ordersList.filter((o) => (o.status || 'Pending') === statusFilter);
  }, [ordersList, statusFilter]);

  const mostRecentOrderId = useMemo(() => {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return null;
    // ordersList is already sorted with most recent first from Supabase
    return ordersList[0]?.id ?? null;
  }, [ordersList]);

  const renderOrderListRow = ({ item }) => {
    const isCustomerConfirmed = (item.rawStatus || '').toLowerCase() === 'customer_confirmed';
    const pill = mapStatusToPill(
      isCustomerConfirmed ? 'CustomerConfirmed' : item.status || 'Pending',
    );
    const itemCount = Array.isArray(item.items) ? item.items.length : 0;
    const firstItems = Array.isArray(item.items) ? item.items.slice(0, 2) : [];
    const isMostRecent = item.id === mostRecentOrderId;
    const isSelected = item.id === selectedOrderId;
    const highlight = isMostRecent || isSelected;

    return (
      <TouchableOpacity
        style={[
          styles.orderListRow,
          {
            borderColor: COLORS.primary + '15',
            backgroundColor: highlight ? '#EEF2FF' : '#FFFFFF',
          },
        ]}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedOrderId(item.id);
          navigation.navigate('SimpleOrderTracking', { orderId: item.id });
        }}
      >
        <View style={styles.orderListLeft}>
          <Text style={[styles.orderListTitle, { color: palette.textPrimary }]}>Order #{item.id}</Text>
          <Text style={[styles.orderListMeta, { color: palette.textMuted }]}>{item.placedAt}</Text>

          {/* Items preview */}
          {firstItems.length > 0 && (
            <View style={styles.orderItemsList}>
              {firstItems.map((prod, idx) => (
                <Text key={idx} style={styles.orderItemLine}>
                  {prod.quantity || 1}x {prod.name || 'Item'}
                </Text>
              ))}
              {itemCount > 2 && (
                <Text style={styles.orderItemMore}>+{itemCount - 2} more</Text>
              )}
            </View>
          )}

          {/* Seller & shipping */}
          {item.sellerName && (
            <Text style={[styles.orderListMeta, { color: palette.textSecondary }]}>
              Seller: {item.sellerName}
            </Text>
          )}
          {item.shippingMethod && (
            <Text style={[styles.orderListHint, { color: palette.textMuted }]}>
              {item.shippingMethod}
            </Text>
          )}

          {/* Tracking */}
          {item.trackingNumber ? (
            <Text style={[styles.orderListHint, { color: COLORS.primary }]}>
              Tracking: {item.trackingNumber}
            </Text>
          ) : (
            <Text style={styles.orderListHint}>Tap to see tracking</Text>
          )}
        </View>

        <View style={styles.orderListRight}>
          <View
            style={[styles.orderListStatusPill, { backgroundColor: pill.gradient[0] }]}
          >
            <Text style={styles.orderListStatusText}>{pill.label}</Text>
          </View>
          <Text style={[styles.orderListAmount, { color: palette.textPrimary }]}>${item.total.toFixed(2)}</Text>
          <Text style={styles.orderListChevron}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTimelineStep = ({ item, index }) => {
    const isCompleted = item.isCompleted;
    const isCurrent = item.isCurrent;
    const isLast = index === timelineData.length - 1;

    const circleStyle = [
      styles.timelineCircle,
      {
        borderColor: isCompleted || isCurrent ? COLORS.primary : palette.border,
        backgroundColor: isCompleted ? COLORS.primary : isCurrent ? '#EEF2FF' : palette.card,
      },
    ];

    const circleContent = (
      <View style={circleStyle}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: isCompleted ? '#FFFFFF' : isCurrent ? COLORS.primary : palette.border,
          }}
        />
      </View>
    );

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.timelineRow}
        onPress={() => {
          // Placeholder for expanding with more details (driver, notes, etc.)
        }}
      >
        <View style={styles.timelineLeftColumn}>
          {isCurrent ? (
            <Animated.View style={{ transform: [{ scale: currentStepPulse }] }}>
              {circleContent}
            </Animated.View>
          ) : (
            circleContent
          )}
          {!isLast && (
            <View
              style={[
                styles.timelineConnector,
                {
                  backgroundColor: isCompleted ? COLORS.primary : palette.border,
                },
              ]}
            />
          )}
        </View>
        <View style={styles.timelineContent}>
          <Text
            style={[
              styles.timelineTitle,
              { color: isCompleted || isCurrent ? palette.textPrimary : palette.textSecondary },
            ]}
          >
            {item.label}
          </Text>
          <Text style={[styles.timelineTimestamp, { color: palette.textMuted }]}>
            {item.timestamp}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const Header = () => (
    <Animated.View
      style={[
        styles.headerRow,
        {
          backgroundColor: palette.background,
          shadowColor: '#000',
          opacity: headerAnim,
          transform: [
            {
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.backButton, { backgroundColor: '#E5E7EB' }]}
        onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
      >
        <Text style={[styles.backIcon, { color: '#111827' }]}>←</Text>
        <Text style={[styles.backText, { color: '#111827' }]}>Profile</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Track Orders</Text>
    </Animated.View>
  );

  const SummaryCard = () => (
    <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={styles.summaryLeft}>
        <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>Order ID</Text>
        <Text style={[styles.summaryValue, { color: palette.textPrimary }]}>#{order?.code}</Text>
        <Text style={[styles.summaryMeta, { color: palette.textMuted }]}>
          Placed {order?.placedAt ? order.placedAt.toLocaleString() : '—'}
        </Text>
      </View>
      <View style={styles.summaryRight}>
        <View
          style={[
            styles.statusPillContainer,
            {
              backgroundColor: statusPill.gradient[0],
            },
          ]}
        >
          <Text style={styles.statusPillText}>{statusPill.label}</Text>
        </View>
        <Text style={[styles.summaryAmountLabel, { color: palette.textSecondary }]}>Total</Text>
        <Text style={[styles.summaryAmountValue, { color: palette.textPrimary }]}>${order?.total.toFixed(2)}</Text>
      </View>
    </View>
  );

  const ShippingCard = () => (
    <View style={[styles.infoCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={styles.infoColumn}>
        <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>Tracking No.</Text>
        <Text style={[styles.infoValue, { color: palette.textPrimary }]}>{order?.trackingNumber}</Text>
      </View>
      <View style={styles.infoColumn}>
        <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>Shipping Method</Text>
        <Text style={[styles.infoValue, { color: palette.textPrimary }]}>
          {order?.shippingMethod}
        </Text>
      </View>
      <View style={styles.infoColumn}>
        <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>Package</Text>
        <Text style={[styles.infoValue, { color: palette.textPrimary }]}>
          {order?.packageWeight}
        </Text>
      </View>
    </View>
  );

  const PartiesCard = () => (
    <View style={[styles.infoCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={styles.infoColumnFull}>
        <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>Courier</Text>
        <Text style={[styles.infoValue, { color: palette.textPrimary }]}>{order?.courier}</Text>
      </View>
      {order?.sellerName ? (
        <View style={styles.infoColumnFull}>
          <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>Seller</Text>
          <Text style={[styles.infoValue, { color: palette.textPrimary }]}>
            {order.sellerName}
          </Text>
        </View>
      ) : null}
      {order?.deliveryAddress ? (
        <View style={styles.infoColumnFull}>
          <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>Delivery Address</Text>
          <Text
            style={[styles.infoValue, { color: palette.textPrimary }]}
            numberOfLines={2}
          >
            {order.deliveryAddress}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const MapCard = () => (
    <View style={[styles.mapCard, { backgroundColor: palette.card, borderColor: palette.border }]}
    >
      <View style={styles.mapHeaderRow}>
        <Text style={[styles.mapTitle, { color: palette.textPrimary }]}>Live Tracking</Text>
        <Text style={[styles.mapSubtitle, { color: palette.textMuted }]}>Map coming soon</Text>
      </View>
      <View style={styles.mapPlaceholder}>
        <Text style={{ color: palette.textMuted }}>Map integration placeholder</Text>
      </View>
    </View>
  );

  const ActionsBar = () => (
    <View style={styles.actionsRow}>
      <TouchableOpacity
        style={[styles.actionButton, styles.actionButtonSecondary]}
        onPress={() => {}}
      >
        <Text style={styles.actionButtonSecondaryText}>Contact Support</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionButton, styles.actionButtonPrimary]}
        onPress={() => {}}
      >
        <Text style={styles.actionButtonPrimaryText}>Download Invoice</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}
    >
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>My Orders</Text>

          <View style={styles.statusTabsRow}>
            {[
              { id: 'Delivered', label: 'Delivered' },
              { id: 'Pending', label: 'Pending' },
              { id: 'Canceled', label: 'Cancelled' },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.statusTabButton,
                    {
                      backgroundColor: active ? COLORS.primary : '#F3F4F6',
                    },
                  ]}
                  onPress={() => setStatusFilter(tab.id)}
                  activeOpacity={0.9}
                >
                  <Text
                    style={[
                      styles.statusTabLabel,
                      { color: active ? '#FFFFFF' : '#6B7280' },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {ordersListLoading && ordersList.length === 0 ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : filteredOrders.length === 0 ? (
            <Text style={{ color: palette.textMuted, fontSize: 13 }}>No orders in this status yet.</Text>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderOrderListRow}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrackOrderScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#F9FBFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    zIndex: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  backIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingWrapperFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  summaryMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  statusPillContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  summaryAmountLabel: {
    fontSize: 11,
  },
  summaryAmountValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoColumn: {
    width: '33%',
    marginBottom: 8,
  },
  infoColumnFull: {
    width: '100%',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  mapCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  mapSubtitle: {
    fontSize: 12,
  },
  mapPlaceholder: {
    height: 140,
    borderRadius: 14,
    backgroundColor: '#E5E7EB33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  statusTabButton: {
    flex: 1,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  statusTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusTabLabelActive: {
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timelineLeftColumn: {
    width: 30,
    alignItems: 'center',
  },
  timelineCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB33',
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineTimestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  actionButtonPrimary: {
    marginLeft: 8,
    backgroundColor: COLORS.primary,
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  orderListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  orderListLeft: {
    flex: 1,
  },
  orderListRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  orderListTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderListMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  orderListStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
  },
  orderListStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  orderListAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  orderListChevron: {
    fontSize: 16,
    marginTop: 4,
    color: '#9CA3AF',
  },
  orderItemsList: {
    marginTop: 8,
  },
  orderItemLine: {
    fontSize: 13,
    color: '#4B5563',
  },
  orderItemMore: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});

