import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Truck, CheckCircle } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';

const VendorOrdersScreen = ({ navigation, route }) => {
  const highlightOrderId = route?.params?.highlightOrderId || null;
  const { orders, deleteProduct, updateOrderStatus, authUserId, setOrders } = useStore();
  const deletedProductIds = useStore((state) => state.deletedProductIds || []);

  const [remoteProducts, setRemoteProducts] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        if (!authUserId) return;

        try {
          // Load this brand's products by owner id
          const { data: prodByOwner, error: prodOwnerError } = await supabase
            .from('products')
            .select('*')
            .eq('brand_user_id', authUserId)
            .or('is_deleted.is.null,is_deleted.eq.false');

          if (prodOwnerError) {
            console.warn('VendorOrders: failed to load products', prodOwnerError.message || prodOwnerError);
          }

          if (isActive) {
            setRemoteProducts(Array.isArray(prodByOwner) ? prodByOwner : []);
          }

          // Load this brand's orders via order_items joined to orders so each brand
          // sees only the items that belong to them, but shares the same order id.
          const { data: orderData, error: orderError } = await supabase
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
                customer_secondary_phone
              )
            `,
            )
            .eq('brand_user_id', authUserId)
            .order('order_id', { ascending: false });

          if (orderError) {
            console.warn('VendorOrders: failed to load orders', orderError.message || orderError);
          } else if (isActive) {
            // Group order_items rows by parent order id and build the same order
            // shape the rest of the screen expects, but with items limited to
            // this vendor's products only.
            const byOrderId = (orderData || []).reduce((acc, row) => {
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
                  // Keep brand_user_id so existing filters still work; for this
                  // screen it will always be the logged-in brand.
                  brand_user_id: authUserId,
                  payment_method: o.payment_method || 'cash_on_delivery',
                  delivery_address: o.delivery_address || '',
                  shipping_method: o.shipping_method || null,
                  promo_code: o.promo_code || null,
                  customer_name: o.customer_name || null,
                  customer_phone: o.customer_phone || null,
                  customer_secondary_phone: o.customer_secondary_phone || null,
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

            const mapped = Object.values(byOrderId);
            setOrders(mapped);
          }
        } catch (e) {
          console.warn('VendorOrders: unexpected error loading data', e.message || e);
        }
      };

      loadData();

      return () => {
        isActive = false;
      };
    }, [authUserId, setOrders]),
  );

  const myProducts = Array.isArray(remoteProducts)
    ? remoteProducts.filter((p) => !deletedProductIds.includes(p.id))
    : [];

  const myOrders = Array.isArray(orders)
    ? orders.filter((o) => !authUserId || o.brand_user_id === authUserId)
    : [];

  const handleDeleteProduct = async (productId) => {
    if (!productId) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_deleted: true })
        .eq('id', productId);

      if (error) {
        console.warn('VendorOrders: delete product error:', error.message || error);
        Alert.alert('Error', error.message || 'Could not delete product.');
        return;
      }

      setRemoteProducts((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== productId) : prev));
      deleteProduct(productId);
    } catch (e) {
      console.warn('VendorOrders: exception deleting product:', e.message || e);
      Alert.alert('Error', 'Something went wrong while deleting this product.');
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, extraFields = {}) => {
    if (!orderId || !newStatus) return;

    try {
      const payload =
        newStatus === 'accepted'
          ? { status: newStatus, brand_accepted_at: new Date().toISOString(), ...extraFields }
          : { status: newStatus, ...extraFields };

      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId);

      if (error) {
        console.warn('VendorOrders: failed to update order status:', error.message || error);
        Alert.alert('Error', error.message || 'Could not update order status.');
        return;
      }

      // Only update local store after a successful Supabase write so
      // the status persists correctly across refresh/logout.
      updateOrderStatus(orderId, newStatus);
    } catch (e) {
      console.warn('VendorOrders: exception updating order status:', e.message || e);
      Alert.alert('Error', 'Something went wrong while updating this order status.');
    }
  };

  const [tab, setTab] = useState(highlightOrderId ? 'orders' : 'products');

  const TabButton = ({ title, value }) => (
    <TouchableOpacity
      onPress={() => setTab(value)}
      style={[
        styles.tabButton,
        tab === value ? styles.tabButtonActive : styles.tabButtonInactive,
      ]}
    >
      <Text style={tab === value ? styles.tabButtonTextActive : styles.tabButtonText}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Products & Orders</Text>
      </View>

      <View style={styles.tabsRow}>
        <TabButton title="My Products" value="products" />
        <TabButton title="Delivery & Orders" value="orders" />
      </View>

      {tab === 'products' ? (
        <FlashList
          data={myProducts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100 }}
          estimatedItemSize={80}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productRow}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('EditProduct', { product: item })}
            >
              <Image
                source={{ uri: item.image }}
                style={styles.productImage}
                contentFit="cover"
                cachePolicy="disk"
                transition={200}
              />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productMeta}>${Number(item.price || 0).toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditProduct', { product: item })}
                style={styles.deleteButton}
              >
                <Text style={{ color: '#2563EB', fontWeight: '600', marginRight: 4 }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditFlashSale', { product: item })}
                style={styles.deleteButton}
              >
                <Text style={{ color: '#111827', fontWeight: '600', marginRight: 4 }}>Flash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Delete product',
                    'Are you sure you want to delete this product? This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => handleDeleteProduct(item.id),
                      },
                    ],
                  );
                }}
                style={styles.deleteButton}
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlashList
          data={myOrders}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No orders yet</Text>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          estimatedItemSize={160}
          renderItem={({ item }) => {
            const rawStatus = (item.status || '').toLowerCase();
            const isCustomerConfirmed = rawStatus === 'customer_confirmed';
            const isDeliveredLike = rawStatus === 'delivered' || isCustomerConfirmed;
            const isOnTheWay = rawStatus === 'on_the_way';
            const isAccepted = rawStatus === 'accepted';
            const prettyStatus = isDeliveredLike
              ? isCustomerConfirmed
                ? 'Delivered · Confirmed'
                : 'Delivered'
              : isOnTheWay
              ? 'On the way'
              : isAccepted
              ? 'Preparing order'
              : 'Pending';

            const isHighlighted =
              highlightOrderId != null && String(item.id) === String(highlightOrderId);

            return (
              <View
                style={[styles.orderCard, isHighlighted && styles.orderCardHighlighted]}
              >
                <View style={styles.orderHeaderRow}>
                  <Text style={styles.orderTitle}>Order #{item.id}</Text>
                  <Text style={styles.orderDate}>{item.date}</Text>
                </View>
                <Text style={styles.orderMeta}>
                  {item.items.length} items 
                  <Text style={styles.orderMetaBold}>
                    • Total: ${item.total.toFixed(2)}
                  </Text>
                </Text>
                {item.customer_name || item.customer_phone || item.customer_secondary_phone ? (
                  <View style={styles.orderCustomerBlock}>
                    {item.customer_name ? (
                      <Text style={styles.orderCustomerName}>{item.customer_name}</Text>
                    ) : null}
                    {item.customer_phone ? (
                      <Text style={styles.orderCustomerPhone}>Phone: {item.customer_phone}</Text>
                    ) : null}
                    {item.customer_secondary_phone ? (
                      <Text style={styles.orderCustomerPhone}>Secondary: {item.customer_secondary_phone}</Text>
                    ) : null}
                  </View>
                ) : null}
                {item.promo_code ? (
                  <Text style={styles.orderPromoMeta}>
                    Promo code used: <Text style={styles.orderPromoCode}>{item.promo_code}</Text>
                  </Text>
                ) : null}

                {Array.isArray(item.items) && item.items.length > 0 && (
                  <View style={styles.orderItemsList}>
                    {item.items.slice(0, 3).map((prod) => {
                      const details = [];
                      if (prod.color) details.push(`Color: ${prod.color}`);
                      if (prod.size) details.push(`Size: ${prod.size}`);
                      if (prod.delivery_type) details.push(`Delivery: ${prod.delivery_type}`);

                      return (
                        <View key={prod.id} style={{ marginBottom: 2 }}>
                          <Text style={styles.orderItemLine}>
                            {prod.quantity}x {prod.name}
                          </Text>
                          {details.length > 0 && (
                            <Text style={styles.orderItemDetails}>
                              {details.join(' · ')}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                    {item.items.length > 3 && (
                      <Text style={styles.orderItemMore}>
                        +{item.items.length - 3} more
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.orderExtraRow}>
                  <Text style={styles.orderExtraLabel}>Payment:</Text>
                  <Text style={styles.orderExtraValue}>{item.payment_method || 'N/A'}</Text>
                </View>
                {item.shipping_method ? (
                  <View style={styles.orderExtraRow}>
                    <Text style={styles.orderExtraLabel}>Delivery type:</Text>
                    <Text style={styles.orderExtraValue}>{item.shipping_method}</Text>
                  </View>
                ) : null}
                {item.delivery_address ? (
                  <View style={styles.orderExtraAddress}>
                    <Text style={styles.orderExtraLabel}>Address:</Text>
                    <Text style={styles.orderExtraAddressText} numberOfLines={2}>
                      {item.delivery_address}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.statusRow}>
                  <View style={styles.statusLeft}>
                    <View style={styles.statusIconWrapper}>
                      {isDeliveredLike ? (
                        <CheckCircle color={isCustomerConfirmed ? '#090966' : '#22c55e'} size={18} />
                      ) : (
                        <Truck color="#2563EB" size={18} />
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isCustomerConfirmed
                          ? styles.statusBadgeCustomerConfirmed
                          : isDeliveredLike
                          ? styles.statusBadgeDelivered
                          : isOnTheWay
                          ? styles.statusBadgeOnTheWay
                          : isAccepted
                          ? styles.statusBadgeAccepted
                          : styles.statusBadgePending,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>{prettyStatus}</Text>
                    </View>
                  </View>

                  {rawStatus === 'pending' || rawStatus === 'pending ' ? (
                    <View style={styles.statusActionsRow}>
                      <TouchableOpacity
                        onPress={() => handleUpdateOrderStatus(item.id, 'accepted')}
                        style={styles.primaryStatusButton}
                      >
                        <Text style={styles.primaryStatusButtonText}>Accept order</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert(
                            'Decline order',
                            'Select a reason for declining this order',
                            [
                              {
                                text: 'Out of stock',
                                onPress: () =>
                                  handleUpdateOrderStatus(item.id, 'declined', {
                                    decline_reason: 'Out of stock',
                                  }),
                              },
                              {
                                text: 'Cannot deliver to this area',
                                onPress: () =>
                                  handleUpdateOrderStatus(item.id, 'declined', {
                                    decline_reason: 'Cannot deliver to this area',
                                  }),
                              },
                              {
                                text: 'Other',
                                onPress: () =>
                                  handleUpdateOrderStatus(item.id, 'declined', {
                                    decline_reason: 'Other',
                                  }),
                              },
                              { text: 'Cancel', style: 'cancel' },
                            ],
                          );
                        }}
                        style={styles.secondaryStatusButton}
                      >
                        <Text style={styles.secondaryStatusButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

export default VendorOrdersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  tabButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  tabButtonInactive: {
    backgroundColor: '#f3f4f6',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  productMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  deleteButton: {
    marginLeft: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#6b7280',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderCardHighlighted: {
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  orderMeta: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 6,
  },
  orderMetaBold: {
    fontWeight: '600',
  },
  orderCustomerBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  orderCustomerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  orderCustomerPhone: {
    fontSize: 12,
    color: '#4b5563',
  },
  orderPromoMeta: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2,
  },
  orderPromoCode: {
    fontWeight: '600',
  },
  orderItemsList: {
    marginTop: 4,
  },
  orderItemLine: {
    fontSize: 12,
    color: '#4b5563',
  },
  orderItemDetails: {
    fontSize: 11,
    color: '#6b7280',
  },
  orderItemMore: {
    fontSize: 12,
    color: '#6b7280',
  },
  orderExtraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  orderExtraLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 4,
  },
  orderExtraValue: {
    fontSize: 12,
    color: '#111827',
  },
  orderExtraAddress: {
    marginTop: 4,
  },
  orderExtraAddressText: {
    fontSize: 12,
    color: '#4b5563',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadgeCustomerConfirmed: {
    backgroundColor: '#e0e7ff',
  },
  statusBadgeDelivered: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeOnTheWay: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeAccepted: {
    backgroundColor: '#fef3c7',
  },
  statusBadgePending: {
    backgroundColor: '#fee2e2',
  },
  statusActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryStatusButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  primaryStatusButtonWide: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryStatusButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryStatusButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  secondaryStatusButtonText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '600',
  },
});
