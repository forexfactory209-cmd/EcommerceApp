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
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const COLORS = {
  light: {
    background: '#F3F4F6',
    card: '#FFFFFF',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
  },
  dark: {
    background: '#0B1120',
    card: '#020617',
    border: '#1F2937',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textMuted: '#6B7280',
  },
  primary: '#246BFD',
  status: {
    Delivered: ['#22C55E', '#16A34A'],
    'Out for Delivery': ['#A855F7', '#7C3AED'],
    Shipped: ['#3B82F6', '#1D4ED8'],
    Confirmed: ['#6366F1', '#4F46E5'],
    Pending: ['#FACC15', '#EAB308'],
    Canceled: ['#F97373', '#EF4444'],
  },
};

const STATUS_PHASES = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];

const mapOrderStatusToPhaseIndex = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'delivered':
      return 4;
    case 'out for delivery':
      return 3;
    case 'shipped':
      return 2;
    case 'confirmed':
      return 1;
    case 'pending':
    default:
      return 0;
  }
};

const mapStatusToPill = (status) => {
  const key = status || 'Pending';
  const gradient = COLORS.status[key] || COLORS.status.Pending;
  return { label: key, gradient };
};

const TrackOrderDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params || {};

  const palette = COLORS.dark;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const currentStepPulse = useRef(new Animated.Value(1)).current;

  const currentPhaseIndex = useMemo(
    () => mapOrderStatusToPhaseIndex(order?.status),
    [order?.status],
  );

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (dbError) {
        console.warn('TrackOrderDetails: error loading order', dbError.message || dbError);
        setError('Could not load order details.');
        setOrder(null);
        return;
      }

      if (!data) {
        setError('Order not found.');
        setOrder(null);
        return;
      }

      const mapped = {
        id: data.id,
        code: data.code || `ORD-${data.id}`,
        items: Array.isArray(data.items) ? data.items : [],
        subtotal: Number(data.subtotal) || 0,
        shipping: Number(data.shipping) || 0,
        total: Number(data.total) || 0,
        status: data.status || 'Pending',
        placedAt: data.placed_at ? new Date(data.placed_at) : null,
        paymentMethod: data.payment_method || 'cash_on_delivery',
        deliveryAddress: data.delivery_address || '',
        trackingNumber: data.tracking_number || 'TRK-' + String(data.id).slice(-6),
        courier: data.courier || 'Standard Courier',
        shippingMethod: data.shipping_method || 'Standard Shipping',
        packageWeight: data.package_weight || 'N/A',
        sellerName: data.seller_name || null,
      };

      setOrder(mapped);
    } catch (e) {
      console.warn('TrackOrderDetails: exception loading order', e.message || e);
      setError('Something went wrong while loading tracking.');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(currentStepPulse, {
          toValue: 1.08,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(currentStepPulse, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [currentStepPulse]);

  const timelineData = useMemo(() => {
    const base = order?.placedAt || new Date();
    const steps = STATUS_PHASES.map((label, index) => {
      const isCompleted = index <= currentPhaseIndex;
      const isCurrent = index === currentPhaseIndex;
      const ts = new Date(base.getTime() + index * 60 * 60 * 1000);
      return {
        key: label,
        label,
        timestamp: ts.toLocaleString(),
        isCompleted,
        isCurrent,
      };
    });
    return steps;
  }, [order?.placedAt, currentPhaseIndex]);

  const renderItemRow = ({ item }) => (
    <View style={[styles.itemRow, { borderColor: palette.border }]}>
      <View style={styles.itemThumbPlaceholder} />
      <View style={styles.itemTextBlock}>
        <Text
          style={[styles.itemTitle, { color: palette.textPrimary }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text style={[styles.itemMeta, { color: palette.textSecondary }]}>Qty: {item.quantity || 1}</Text>
        {item.variant ? (
          <Text style={[styles.itemMeta, { color: palette.textMuted }]}>{item.variant}</Text>
        ) : null}
      </View>
    </View>
  );

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
        onPress={() => {}}
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

  const statusPill = mapStatusToPill(order?.status || 'Pending');

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
        style={[styles.backButton, { backgroundColor: '#111827' }]}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.backIcon, { color: '#FFFFFF' }]}>←</Text>
        <Text style={[styles.backText, { color: '#FFFFFF' }]}>Track Orders</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: palette.textPrimary }]}>Order Details</Text>
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

  if (loading && !order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}
      >
        <Header />
        <View style={styles.loadingWrapperFull}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}
      >
        <Header />
        <View style={styles.loadingWrapperFull}>
          <Text style={{ color: palette.textSecondary, marginBottom: 8 }}>{error}</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={loadOrder}
          >
            <Text style={styles.actionButtonPrimaryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}
    >
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {order && <SummaryCard />}
        {order && <ShippingCard />}
        {order && <PartiesCard />}
        <MapCard />

        {order && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Items</Text>
            {order.items.length === 0 ? (
              <Text style={{ color: palette.textMuted, fontSize: 13 }}>No items found for this order.</Text>
            ) : (
              <FlatList
                data={order.items}
                keyExtractor={(item, idx) => `${item.id || 'item'}-${idx}`}
                renderItem={renderItemRow}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 12 }}
              />
            )}
          </View>
        )}

        {order && (
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Order Status</Text>
            <FlatList
              data={timelineData}
              keyExtractor={(item) => item.key}
              renderItem={renderTimelineStep}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          </View>
        )}

        {order && <ActionsBar />}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrackOrderDetailsScreen;

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
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  itemThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  itemTextBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 12,
    marginTop: 2,
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
});

