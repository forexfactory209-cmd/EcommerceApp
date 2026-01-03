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
  Linking,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
  const { orderId, brandDecisionMode } = route.params || {};

  const palette = COLORS.dark;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [supportVisible, setSupportVisible] = useState(false);
  const [decisionVisible, setDecisionVisible] = useState(false);
  const [declineStep, setDeclineStep] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

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
        sellerEmail: data.seller_email || null,
        sellerPhone: data.seller_phone || null,
      };

  const handleAcceptOrder = async () => {
    if (!orderId) return;
    try {
      await supabase
        .from('orders')
        .update({ status: 'accepted' })
        .eq('id', orderId);
      setDecisionVisible(false);
      setDeclineStep(false);
      setDeclineReason('');
      await loadOrder();
    } catch (e) {
      console.warn('TrackOrderDetails: failed to accept order', e.message || e);
    }
  };

  const handleSelectDecline = () => {
    setDeclineStep(true);
  };

  const handleDeclineWithReason = async (reason) => {
    if (!orderId) return;
    try {
      await supabase
        .from('orders')
        .update({ status: 'declined', decline_reason: reason })
        .eq('id', orderId);
      setDeclineReason(reason);
      setDecisionVisible(false);
      setDeclineStep(false);
      // Simple thank-you message via navigation param or alert; here we just reload order
      await loadOrder();
    } catch (e) {
      console.warn('TrackOrderDetails: failed to decline order', e.message || e);
    }
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
      if (brandDecisionMode) {
        setDecisionVisible(true);
      }
    }, [loadOrder]),
  );

  useEffect(() => {
    if (!orderId) return undefined;

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const next = payload?.new;
          if (!next) return;

          setOrder((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: next.status || prev.status,
            };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

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

  const VendorActions = () => {
    if (!brandDecisionMode || !order) return null;

    const rawStatus = (order.status || '').toLowerCase();

    if (rawStatus === 'pending') {
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => handleSetStatus('accepted')}
          >
            <Text style={styles.actionButtonPrimaryText}>Accept order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => {
              Alert.alert(
                'Decline order',
                'Select a reason for declining this order',
                [
                  {
                    text: 'Out of stock',
                    onPress: () => handleSetStatus('declined', { decline_reason: 'Out of stock' }),
                  },
                  {
                    text: 'Cannot deliver to this area',
                    onPress: () =>
                      handleSetStatus('declined', { decline_reason: 'Cannot deliver to this area' }),
                  },
                  {
                    text: 'Other',
                    onPress: () => handleSetStatus('declined', { decline_reason: 'Other' }),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ],
              );
            }}
          >
            <Text style={styles.actionButtonSecondaryText}>Decline</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (rawStatus === 'accepted') {
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() =>
              handleSetStatus('on_the_way', { on_the_way_at: new Date().toISOString() })
            }
          >
            <Text style={styles.actionButtonPrimaryText}>Mark as on the way</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (rawStatus === 'on_the_way') {
      return (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() =>
              handleSetStatus('delivered', { delivered_at: new Date().toISOString() })
            }
          >
            <Text style={styles.actionButtonPrimaryText}>Mark as delivered</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
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

  const handleSetStatus = async (newStatus, extraFields = {}) => {
    if (!orderId) return;
    try {
      await supabase
        .from('orders')
        .update({ status: newStatus, ...extraFields })
        .eq('id', orderId);
      await loadOrder();
    } catch (e) {
      console.warn('TrackOrderDetails: failed to update status', e.message || e);
    }
  };

  const handleOpenSupport = () => {
    setSupportVisible(true);
  };

  const handleCloseSupport = () => {
    setSupportVisible(false);
  };

  const handleCallSeller = () => {
    if (!order?.sellerPhone) return;
    const phone = String(order.sellerPhone).replace(/\s+/g, '');
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const handleEmailSeller = () => {
    if (!order?.sellerEmail) return;
    const subject = encodeURIComponent(`Order #${order.code} support`);
    const body = encodeURIComponent('Hi, I need help with my order.');
    Linking.openURL(`mailto:${order.sellerEmail}?subject=${subject}&body=${body}`).catch(() => {});
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;

    try {
      const itemsRows = Array.isArray(order.items)
        ? order.items
            .map((item, index) => {
              const name = item.name || `Item ${index + 1}`;
              const qty = item.quantity || 1;
              const price = Number(item.price) || 0;
              const lineTotal = price * qty;
              return `
                <tr>
                  <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB;">${name}</td>
                  <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; text-align: center;">${qty}</td>
                  <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; text-align: right;">${price ? `$${price.toFixed(2)}` : '-'}</td>
                  <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; text-align: right;">${lineTotal ? `$${lineTotal.toFixed(2)}` : '-'}</td>
                </tr>
              `;
            })
            .join('')
        : '';

      const placedAtText = order.placedAt ? order.placedAt.toLocaleString() : '';

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Invoice ${order.code}</title>
            <style>
              :root {
                --primary: #246BFD;
                --text-main: #0F172A;
                --muted: #6B7280;
                --border: #E5E7EB;
                --bg-soft: #F9FAFB;
              }

              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                padding: 0;
                margin: 0;
                color: var(--text-main);
                background-color: #FFFFFF;
              }

              .page {
                padding: 20px 18px 24px;
              }

              .header-bar {
                background: linear-gradient(90deg, #1D4ED8, #246BFD);
                padding: 14px 18px;
                color: #FFFFFF;
              }

              .brand-title {
                font-size: 18px;
                font-weight: 700;
                margin: 0 0 2px 0;
              }

              .brand-subtitle {
                font-size: 11px;
                opacity: 0.9;
                margin: 0;
              }

              .section-card {
                background-color: #FFFFFF;
                border-radius: 10px;
                border: 1px solid var(--border);
                padding: 12px 12px 10px;
                margin-top: 12px;
              }

              .section-title {
                font-size: 13px;
                font-weight: 600;
                margin: 0 0 6px 0;
              }

              p {
                font-size: 11px;
                margin: 2px 0;
              }

              .meta-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
              }

              .meta-label {
                color: var(--muted);
              }

              .meta-value {
                font-weight: 500;
              }

              .status-pill {
                display: inline-block;
                padding: 2px 8px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 600;
                color: #FFFFFF;
                background-color: var(--primary);
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 4px;
              }

              th {
                font-size: 11px;
                text-align: left;
                padding: 4px 8px;
                background-color: var(--bg-soft);
                border-bottom: 1px solid var(--border);
              }

              td {
                font-size: 11px;
              }

              .totals-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                margin-top: 2px;
              }

              .totals-label {
                color: var(--muted);
              }

              .totals-value {
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="header-bar">
              <p class="brand-title">${order.sellerName || 'Your Store'}</p>
              <p class="brand-subtitle">Order invoice and payment summary</p>
            </div>

            <div class="page">
              <div class="section-card">
                <p class="section-title">Order Summary</p>
                <div class="meta-row">
                  <span class="meta-label">Order ID</span>
                  <span class="meta-value">${order.code}</span>
                </div>
                ${
                  placedAtText
                    ? `<div class="meta-row"><span class="meta-label">Date</span><span class="meta-value">${placedAtText}</span></div>`
                    : ''
                }
                <div class="meta-row" style="margin-top:4px;">
                  <span class="meta-label">Status</span>
                  <span class="status-pill">${order.status}</span>
                </div>
              </div>

              <div class="section-card">
                <p class="section-title">Customer</p>
                ${order.deliveryAddress ? `<p>${order.deliveryAddress}</p>` : '<p>No address provided</p>'}
              </div>

              <div class="section-card">
                <p class="section-title">Items</p>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style="text-align:center;">Qty</th>
                      <th style="text-align:right;">Price</th>
                      <th style="text-align:right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRows || '<tr><td colspan="4" style="padding: 8px;">No items found</td></tr>'}
                  </tbody>
                </table>
              </div>

              <div class="section-card">
                <p class="section-title">Payment & Shipping</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                <p><strong>Shipping Method:</strong> ${order.shippingMethod}</p>
                <p><strong>Tracking No.:</strong> ${order.trackingNumber}</p>
                ${order.courier ? `<p><strong>Courier:</strong> ${order.courier}</p>` : ''}
                ${order.packageWeight ? `<p><strong>Package:</strong> ${order.packageWeight}</p>` : ''}
              </div>

              <div class="section-card">
                <p class="section-title">Totals</p>
                <div class="totals-row">
                  <span class="totals-label">Subtotal</span>
                  <span class="totals-value">$${order.subtotal.toFixed(2)}</span>
                </div>
                <div class="totals-row">
                  <span class="totals-label">Shipping</span>
                  <span class="totals-value">$${order.shipping.toFixed(2)}</span>
                </div>
                <div class="totals-row" style="margin-top:4px;">
                  <span class="totals-label">Total</span>
                  <span class="totals-value">$${order.total.toFixed(2)}</span>
                </div>
              </div>

              ${
                order.sellerName || order.sellerEmail || order.sellerPhone
                  ? `
                    <div class="section-card">
                      <p class="section-title">Seller</p>
                      ${order.sellerName ? `<p><strong>Name:</strong> ${order.sellerName}</p>` : ''}
                      ${order.sellerEmail ? `<p><strong>Email:</strong> ${order.sellerEmail}</p>` : ''}
                      ${order.sellerPhone ? `<p><strong>Phone:</strong> ${order.sellerPhone}</p>` : ''}
                    </div>
                  `
                  : ''
              }
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (!uri) return;

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) return;

      await Sharing.shareAsync(uri, {
        dialogTitle: `Invoice for ${order.code}`,
        mimeType: 'application/pdf',
      });
    } catch (e) {
      // Swallow PDF/share errors to avoid crashing the screen
    }
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

  const ActionsBar = () => {
    const isDelivered = (order?.status || '').toLowerCase() === 'delivered';

    const handleSubmitReview = () => {
      if (!isDelivered) return;

      const items = Array.isArray(order?.items) ? order.items : [];
      const firstItem = items[0];

      if (!firstItem || !firstItem.id) {
        Alert.alert('Unavailable', 'No items found to review for this order.');
        return;
      }

      navigation.navigate('ProductWriteReview', {
        productId: firstItem.id,
        productName: firstItem.name,
      });
    };

    return (
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary]}
          onPress={handleOpenSupport}
        >
          <Text style={styles.actionButtonSecondaryText}>Contact Support</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={handleDownloadInvoice}
        >
          <Text style={styles.actionButtonPrimaryText}>Download Invoice</Text>
        </TouchableOpacity>
        {isDelivered && (
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={handleSubmitReview}
          >
            <Text style={styles.actionButtonPrimaryText}>Submit review</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

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

        {order && <VendorActions />}
        {order && <ActionsBar />}
      </ScrollView>
      {supportVisible && (
        <View style={styles.supportOverlay}>
          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Contact Support</Text>
            <Text style={styles.supportSubtitle}>
              {order?.sellerName || 'Seller'} will assist you about this order.
            </Text>
            <View style={styles.supportButtonsRow}>
              <TouchableOpacity
                style={[styles.supportButton, styles.supportButtonCall]}
                onPress={handleCallSeller}
              >
                <Text style={styles.supportButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.supportButton, styles.supportButtonEmail]}
                onPress={handleEmailSeller}
              >
                <Text style={styles.supportButtonText}>Email</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleCloseSupport} style={styles.supportCloseTouch}
            >
              <Text style={styles.supportCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  supportOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCard: {
    width: '86%',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 6,
  },
  supportSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  supportButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  supportButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  supportButtonCall: {
    marginRight: 6,
    backgroundColor: '#22C55E',
  },
  supportButtonEmail: {
    marginLeft: 6,
    backgroundColor: '#2563EB',
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  supportCloseTouch: {
    marginTop: 4,
    paddingVertical: 6,
    alignItems: 'center',
  },
  supportCloseText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});

