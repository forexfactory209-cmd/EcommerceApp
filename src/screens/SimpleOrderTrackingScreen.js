import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const COLORS = {
  background: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#090966',
  primarySoft: '#FDF2F8',
  divider: '#E5E7EB',
};

const STATUS_STEPS = ['Order Placed', 'On the Way', 'Delivered'];

const mapOrderStatusToStepIndex = (status) => {
  const v = (status || '').toLowerCase();
  if (v === 'delivered' || v === 'customer_confirmed') return 2;
  if (v === 'on_the_way' || v === 'shipped' || v === 'out for delivery' || v === 'confirmed') return 1;
  // pending or anything else
  return 0;
};

const SimpleOrderTrackingScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params || {};

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentStepIndex = useMemo(
    () => mapOrderStatusToStepIndex(order?.status),
    [order?.status],
  );

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .from('orders')
        .select('id, status, decline_reason, items, total, shipping_method, delivery_address')
        .eq('id', orderId)
        .maybeSingle();

      if (dbError) {
        console.warn('SimpleOrderTracking: error loading order', dbError.message || dbError);
        setError('Could not load order.');
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
        // derive a human-friendly code on the client since orders.code does not exist
        code: `ORD-${data.id}`,
        status: data.status || 'Pending',
        declineReason: data.decline_reason || null,
        items: Array.isArray(data.items) ? data.items : [],
        total: typeof data.total === 'number' ? data.total : Number(data.total) || 0,
        shippingMethod: data.shipping_method || null,
        deliveryAddress: data.delivery_address || null,
      };

      setOrder(mapped);
    } catch (e) {
      console.warn('SimpleOrderTracking: exception loading order', e.message || e);
      setError('Something went wrong while loading order.');
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

  const currentTitle = useMemo(() => {
    const idx = currentStepIndex;
    if (idx === 2) return 'DELIVERED';
    if (idx === 1) return 'ON THE WAY';
    return 'ORDER PLACED';
  }, [currentStepIndex]);

  const currentSubtitle = useMemo(() => {
    const idx = currentStepIndex;
    if (idx === 2) return 'Your order has been delivered successfully.';
    if (idx === 1) return 'Your order is on the way. Our courier will deliver it soon.';
    return 'Your order is placed successfully. We are preparing it for shipment.';
  }, [currentStepIndex]);

  const estimatedText = useMemo(() => {
    const idx = currentStepIndex;
    if (idx === 2) return 'Estimated time: Delivered';
    if (idx === 1) return 'Estimated time: 1–24 Hours';
    return 'Estimated time: 1–24 Hours';
  }, [currentStepIndex]);

  if (loading && !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerWrapper}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerWrapper}>
          <Text style={[styles.errorText]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadOrder}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackTouch}>
          <Text style={styles.headerBackIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          {order?.code ? <Text style={styles.headerSubtitle}>#{order.code}</Text> : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Step indicator */}
        <View style={styles.stepsRow}>
          {STATUS_STEPS.map((label, index) => {
            const completed = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      completed && styles.stepCircleCompleted,
                      isCurrent && !completed && styles.stepCircleCurrent,
                    ]}
                  >
                    {completed ? (
                      <Text style={styles.stepCircleCheck}>✓</Text>
                    ) : (
                      <Text style={styles.stepCircleNumber}>{index + 1}</Text>
                    )}
                  </View>
                  <Text style={styles.stepLabel}>{label}</Text>
                </View>
                {index < STATUS_STEPS.length - 1 && (
                  <View
                    style={[
                      styles.stepConnector,
                      index < currentStepIndex && styles.stepConnectorActive,
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Illustration placeholder */}
        <View style={styles.illustrationWrapper}>
          <View style={styles.illustrationCircle}>
            <Text style={styles.illustrationEmoji}>
              {currentStepIndex === 0 ? '🎁' : currentStepIndex === 1 ? '🚚' : '✅'}
            </Text>
          </View>
        </View>

        {/* Status text */}
        <View style={styles.textBlock}>
          <Text style={styles.statusTitle}>{currentTitle}</Text>
          <Text style={styles.statusSubtitle}>{currentSubtitle}</Text>
          <Text style={styles.statusEstimate}>{estimatedText}</Text>
        </View>

        {/* Order items summary */}
        {Array.isArray(order?.items) && order.items.length > 0 && (
          <View style={styles.itemsCard}>
            <Text style={styles.itemsTitle}>Items in this order</Text>
            {order.items.map((prod, idx) => {
              const details = [];
              if (prod.color) details.push(`Color: ${prod.color}`);
              if (prod.size) details.push(`Size: ${prod.size}`);
              if (prod.delivery_type) details.push(`Delivery: ${prod.delivery_type}`);

              return (
                <View key={`${prod.id || idx}`} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>
                      {prod.quantity || 1}x {prod.name || 'Item'}
                    </Text>
                    {details.length > 0 && (
                      <Text style={styles.itemDetails}>{details.join(' · ')}</Text>
                    )}
                  </View>
                  {typeof prod.price === 'number' && (
                    <Text style={styles.itemPrice}>${(prod.price * (prod.quantity || 1)).toFixed(2)}</Text>
                  )}
                </View>
              );
            })}
            <View style={styles.itemsFooterRow}>
              <Text style={styles.itemsFooterLabel}>Order total</Text>
              <Text style={styles.itemsFooterValue}>${order.total.toFixed(2)}</Text>
            </View>
            {order.shippingMethod ? (
              <Text style={styles.itemsMeta}>Delivery type: {order.shippingMethod}</Text>
            ) : null}
            {order.deliveryAddress ? (
              <Text style={styles.itemsMeta} numberOfLines={2}>
                Address: {order.deliveryAddress}
              </Text>
            ) : null}
          </View>
        )}

        {/* Confirm delivered button (only on delivered step).
            Before confirmation: tappable primary button.
            After confirmation: static black "CONFIRMED" button without any action. */}
        {currentStepIndex === 2 && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => {
              if (!order?.id) return;
              navigation.navigate('ReportProblem', { orderId: order.id });
            }}
          >
            <Text style={styles.confirmButtonText}>REPORT A PROBLEM</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

export default SimpleOrderTrackingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerBackTouch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerBackIcon: {
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepCircleCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepCircleCurrent: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  stepCircleNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stepCircleCheck: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  stepConnector: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.divider,
    marginHorizontal: 4,
  },
  stepConnectorActive: {
    backgroundColor: COLORS.primary,
  },
  illustrationWrapper: {
    marginTop: 48,
    alignItems: 'center',
  },
  illustrationCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: {
    fontSize: 64,
  },
  textBlock: {
    marginTop: 32,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusSubtitle: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },
  statusEstimate: {
    marginTop: 16,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  itemsCard: {
    marginTop: 24,
    marginHorizontal: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: '#F9FAFB',
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  itemDetails: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  itemsFooterRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: 8,
  },
  itemsFooterLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemsFooterValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemsMeta: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  confirmButton: {
    marginTop: 40,
    marginBottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  confirmedPill: {
    marginTop: 40,
    marginBottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  confirmedPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
