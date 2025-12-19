import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

const COLORS = {
  background: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#F973B6',
  primarySoft: '#FDF2F8',
  divider: '#E5E7EB',
};

const STATUS_STEPS = ['Order Placed', 'On the Way', 'Delivered'];

const mapOrderStatusToStepIndex = (status) => {
  const v = (status || '').toLowerCase();
  if (v === 'delivered') return 2;
  if (v === 'shipped' || v === 'out for delivery' || v === 'confirmed') return 1;
  // pending or anything else
  return 0;
};

const SimpleOrderTrackingScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { orderId } = route.params || {};
  const authUserId = useStore((state) => state.authUserId);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);

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
        .select('id, status, customer_confirmed')
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
        customerConfirmed: !!data.customer_confirmed,
      };

      setOrder(mapped);
      setHasConfirmed(mapped.customerConfirmed);
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

        {/* Confirm delivered button (only on delivered step).
            Before confirmation: tappable primary button.
            After confirmation: static black "CONFIRMED" button without any action. */}
        {currentStepIndex === 2 && (
          hasConfirmed ? (
            <View style={styles.confirmedPill}>
              <Text style={styles.confirmedPillText}>CONFIRMED</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={async () => {
                if (!orderId || !authUserId) return;

                setHasConfirmed(true);

                // Persist confirmation server-side so it stays confirmed across sessions
                try {
                  await supabase
                    .from('orders')
                    .update({ customer_confirmed: true })
                    .eq('id', orderId)
                    .eq('customer_user_id', authUserId);
                } catch (e) {
                  // Ignore update errors for now; UI already reflects confirmation
                }

                navigation.navigate('OrderDeliveredSuccess', { orderId });
              }}
            >
              <Text style={styles.confirmButtonText}>CONFIRM DELIVERY</Text>
            </TouchableOpacity>
          )
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
