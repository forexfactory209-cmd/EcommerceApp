import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { User as UserIcon, Phone, MapPin, ArrowLeft } from 'lucide-react-native';

import { supabase } from '../lib/supabase';

const BrandOrderDetailsScreen = ({ navigation, route }) => {
  const order = route?.params?.order || null;

  const [isUpdating, setIsUpdating] = useState(false);

  const itemsArray = useMemo(
    () => (Array.isArray(order?.items) ? order.items : []),
    [order],
  );

  // Group items by product so quantity is aggregated and not shown as duplicated rows
  const groupedItems = useMemo(() => {
    if (!Array.isArray(itemsArray) || itemsArray.length === 0) return [];

    const map = new Map();

    itemsArray.forEach((it) => {
      if (!it) return;

      const baseName = it.name || 'Item';
      const unit = Number(it.price || it.unit_price || 0);
      const key = `${baseName}::${unit}`;

      const existing = map.get(key) || {
        name: baseName,
        unitPrice: unit,
        quantity: 0,
      };

      const qty = typeof it.quantity === 'number' && it.quantity > 0 ? it.quantity : 1;
      existing.quantity += qty;

      map.set(key, existing);
    });

    return Array.from(map.values());
  }, [itemsArray]);

  const handleCallCustomer = async () => {
    const phone = order?.customer_phone;
    if (!phone) return;

    try {
      const url = `tel:${phone}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Not supported', 'This device cannot make phone calls.');
      }
    } catch (e) {
      console.warn('BrandOrderDetails: failed to open dialer', e.message || e);
      Alert.alert('Error', 'Could not open the phone dialer.');
    }
  };

  const handleOpenMap = async () => {
    const address = order?.delivery_address;
    if (!address) return;

    try {
      const encoded = encodeURIComponent(address);
      const url = Platform.OS === 'android'
        ? `geo:0,0?q=${encoded}`
        : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Not supported', 'No maps application is available on this device.');
      }
    } catch (e) {
      console.warn('BrandOrderDetails: failed to open map', e.message || e);
      Alert.alert('Error', 'Could not open maps for this address.');
    }
  };

  const handleUpdateStatus = async (nextFields, successMessage) => {
    if (!order?.id || !nextFields) return;

    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('orders')
        .update(nextFields)
        .eq('id', order.id);

      if (error) {
        console.warn('BrandOrderDetails: failed to update order', error.message || error);
        Alert.alert('Error', error.message || 'Could not update this order.');
        return;
      }

      if (successMessage) {
        Alert.alert('Success', successMessage);
      }

      navigation.goBack();
    } catch (e) {
      console.warn('BrandOrderDetails: exception updating order', e.message || e);
      Alert.alert('Error', 'Something went wrong while updating this order.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAccept = () => {
    const now = new Date().toISOString();
    handleUpdateStatus(
      { brand_accepted_at: now, status: 'accepted' },
      'Order accepted.',
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline order',
      'Are you sure you want to decline this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline order',
          style: 'destructive',
          onPress: () =>
            handleUpdateStatus(
              { status: 'declined', decline_reason: 'Declined by brand' },
              'Order declined.',
            ),
        },
      ],
    );
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Order not found</Text>
          <Text style={styles.emptySubtitle}>Please go back and select an order again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstItem = itemsArray[0] || null;
  const productName = firstItem?.name || order.first_item_name || 'Order';
  const amount = Number(order.total) || 0;
  const qty = groupedItems.reduce((sum, it) => sum + (it.quantity || 0), 0) || order.quantity || 1;

  const placedAt = order.placed_at
    ? new Date(order.placed_at).toLocaleString()
    : 'Recently';

  // Prefer full/thumbnail URLs from the first ordered item so header shows product image
  const imageUrl = (() => {
    if (!firstItem) return null;
    const candidates = [
      firstItem.image_full_url,
      firstItem.image_thumb_url,
      firstItem.image,
      firstItem.image_url,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const url = candidates[i];
      if (typeof url === 'string' && url.length > 0) return url;
    }
    return null;
  })();

  const customerName = order.customer_name || 'Customer';

  const brandAcceptedAt = order.brand_accepted_at;
  const onTheWayAt = order.on_the_way_at;
  const deliveredAt = order.delivered_at;

  let statusLabel = 'Pending';
  const rawStatus = typeof order.status === 'string' ? order.status.toLowerCase().trim() : '';
  if (rawStatus === 'accepted') statusLabel = 'Accepted';
  if (rawStatus === 'on_the_way') statusLabel = 'On the way';
  if (rawStatus === 'delivered') statusLabel = 'Delivered';

  const isDeclinedOrCancelled =
    rawStatus === 'declined' || (rawStatus && rawStatus.startsWith('cancel'));
  const isNew = !brandAcceptedAt && !onTheWayAt && !deliveredAt && !isDeclinedOrCancelled;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.orderHeaderCard}>
          <View style={styles.orderHeaderTopRow}>
            <View>
              <Text style={styles.orderId}>Order #{order.id}</Text>
              <Text style={styles.orderTimeLabel}>{placedAt}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.orderSummaryRow}>
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

            <View style={styles.orderSummaryInfo}>
              <Text style={styles.productTitle} numberOfLines={1}>
                {productName}
              </Text>
              <Text style={styles.productMeta} numberOfLines={1}>
                {qty} {qty === 1 ? 'item' : 'items'}
              </Text>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${amount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderIconWrapper}>
              <UserIcon size={18} color="#111827" />
            </View>
            <Text style={styles.sectionTitle}>Customer Details</Text>
          </View>

          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>
                {customerName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{customerName}</Text>
              <Text style={styles.customerTag}>Regular customer</Text>
            </View>
            {order.customer_phone ? (
              <TouchableOpacity
                style={styles.callButton}
                onPress={handleCallCustomer}
              >
                <Phone size={18} color="#22c55e" />
              </TouchableOpacity>
            ) : null}
          </View>

          {order.delivery_address ? (
            <View style={styles.customerAddressRow}>
              <MapPin size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.customerAddressText} numberOfLines={2}>
                  {order.delivery_address}
                </Text>
                <TouchableOpacity
                  style={styles.mapButton}
                  onPress={handleOpenMap}
                >
                  <Text style={styles.mapButtonText}>Open Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Ordered items ({groupedItems.length})</Text>
          </View>

          {groupedItems.map((it, index) => {
            const itemName = it && it.name ? String(it.name) : 'Item';
            const qtyItem = typeof it.quantity === 'number' ? it.quantity : 1;
            const lineTotal = Number(it.unitPrice || 0) * qtyItem;

            return (
              <View key={`${itemName}-${index}`} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {itemName}
                  </Text>
                  <Text style={styles.itemMeta}>
                    Qty: {qtyItem}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>${lineTotal.toFixed(2)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {isNew && (
        <View style={styles.footerActionsRow}>
          <TouchableOpacity
            style={[styles.rejectButton, isUpdating && { opacity: 0.7 }]}
            disabled={isUpdating}
            onPress={handleDecline}
          >
            <Text style={styles.rejectButtonText}>Reject Order</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, isUpdating && { opacity: 0.7 }]}
            disabled={isUpdating}
            onPress={handleAccept}
          >
            <Text style={styles.acceptButtonText}>Accept Order</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  orderHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  orderTimeLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginRight: 14,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4b5563',
  },
  orderSummaryInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  productMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 11,
    color: '#9ca3af',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#b91c1c',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  customerTag: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  customerAddressText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
  },
  mapButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  mapButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  itemMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  rejectButton: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  acceptButton: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default BrandOrderDetailsScreen;
