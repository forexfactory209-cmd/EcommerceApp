import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Truck, CheckCircle } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const AdminVendorScreen = ({ route, navigation }) => {
  const { brandUserId, brandName } = route.params || {};

  const [tab, setTab] = useState('products'); // 'products' | 'orders'
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        if (!brandUserId) return;

        try {
          // Load this brand's products by owner id
          const { data: prodByOwner, error: prodOwnerError } = await supabase
            .from('products')
            .select('*')
            .eq('brand_user_id', brandUserId);

          if (prodOwnerError) {
            console.warn('Admin vendor: error loading products by owner:', prodOwnerError.message || prodOwnerError);
          }

          let combined = Array.isArray(prodByOwner) ? prodByOwner : [];

          // Also include products that match this brand's name (for legacy rows without brand_user_id)
          const trimmedName = (brandName || '').toString().trim();
          if (trimmedName) {
            try {
              const { data: prodByName, error: prodNameError } = await supabase
                .from('products')
                .select('*')
                .eq('brand', trimmedName);

              if (prodNameError) {
                console.warn('Admin vendor: error loading products by name:', prodNameError.message || prodNameError);
              } else if (Array.isArray(prodByName) && prodByName.length > 0) {
                const existingIds = new Set(combined.map((p) => p.id));
                const onlyNew = prodByName.filter((p) => !existingIds.has(p.id));
                combined = [...combined, ...onlyNew];
              }
            } catch (e) {
              console.warn('Admin vendor: exception loading products by name:', e.message || e);
            }
          }

          if (isActive) {
            setProducts(combined);
          }

          // Load this brand's orders
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('brand_user_id', brandUserId)
            .order('placed_at', { ascending: false });

          if (orderError) {
            console.warn('Admin vendor: error loading orders:', orderError.message);
          } else if (isActive) {
            const mapped = (orderData || []).map((row) => ({
              id: row.id,
              items: Array.isArray(row.items) ? row.items : [],
              subtotal: Number(row.subtotal) || 0,
              shipping: Number(row.shipping) || 0,
              total: Number(row.total) || 0,
              status: row.status || 'Pending',
              date: row.placed_at
                ? new Date(row.placed_at).toLocaleDateString()
                : '',
              payment_method: row.payment_method || 'cash_on_delivery',
              delivery_address: row.delivery_address || '',
            }));
            setOrders(mapped);
          }
        } catch (e) {
          console.warn('Admin vendor: error loading data:', e);
        }
      };

      loadData();

      return () => {
        isActive = false;
      };
    }, [brandUserId]),
  );

  const COMMISSION_RATE = 0.15;

  const totalOrders = orders.length;
  const grossRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const commissionAmount = grossRevenue * COMMISSION_RATE;
  const netRevenue = grossRevenue - commissionAmount;
  const deliveredOrdersCount = orders.filter((o) => o.status === 'Delivered').length;
  const pendingOrdersCount = totalOrders - deliveredOrdersCount;

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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#ffffff" size={18} />
        </TouchableOpacity>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.title}>{brandName || 'Vendor'}</Text>
          <Text style={styles.subtitle}>Admin view of this vendor dashboard</Text>
        </View>
      </View>

      <View style={[styles.statsRow, { flexWrap: 'wrap' }]}>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{totalOrders}</Text>
          <Text style={styles.statSubValue}>
            {deliveredOrdersCount} delivered · {pendingOrdersCount} pending
          </Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statLabel}>Vendor Net</Text>
          <Text style={styles.statValue}>${netRevenue.toFixed(0)}</Text>
          <Text style={styles.statSubValue}>After 15% commission</Text>
        </View>
        <View style={[styles.statCard, styles.statCardPurple]}>
          <Text style={styles.statLabel}>Our Commission</Text>
          <Text style={styles.statValue}>${commissionAmount.toFixed(0)}</Text>
          <Text style={styles.statSubValue}>15% of ${grossRevenue.toFixed(0)}</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        <TabButton title="Products" value="products" />
        <TabButton title="Delivery & Orders" value="orders" />
      </View>

      {tab === 'products' ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.productRow}>
              <Image source={{ uri: item.image }} style={styles.productImage} />
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productMeta}>${item.price}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No products for this brand yet.</Text>
          }
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No orders yet for this brand.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.orderHeaderRow}>
                <Text style={styles.orderTitle}>Order #{item.id}</Text>
                <Text style={styles.orderDate}>{item.date}</Text>
              </View>
              <Text style={styles.orderMeta}>
                {item.items.length} items
                <Text style={styles.orderMetaBold}> • Total: ${item.total.toFixed(2)}</Text>
              </Text>

              {Array.isArray(item.items) && item.items.length > 0 && (
                <View style={styles.orderItemsList}>
                  {item.items.slice(0, 3).map((prod) => (
                    <Text key={prod.id} style={styles.orderItemLine}>
                      {prod.quantity}x {prod.name}
                    </Text>
                  ))}
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
                  {item.status === 'Delivered' ? (
                    <CheckCircle color="green" size={20} />
                  ) : (
                    <Truck color="#2563EB" size={20} />
                  )}
                  <Text
                    style={
                      item.status === 'Delivered'
                        ? styles.statusDelivered
                        : styles.statusPending
                    }
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default AdminVendorScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statCardBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statCardGreen: {
    backgroundColor: '#ecfdf3',
    borderColor: '#6ce797f8',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    padding: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: '#111827',
  },
  tabButtonInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabButtonText: {
    fontWeight: '700',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    fontWeight: '700',
    color: '#ffffff',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontWeight: '700',
    color: '#111827',
  },
  productMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 32,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  orderMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  orderMetaBold: {
    fontWeight: '700',
    color: '#111827',
  },
  orderItemsList: {
    marginTop: 8,
  },
  orderItemLine: {
    fontSize: 13,
    color: '#4b5563',
  },
  orderItemMore: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  orderExtraRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  orderExtraLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 4,
  },
  orderExtraValue: {
    fontSize: 13,
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
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 12,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDelivered: {
    marginLeft: 8,
    fontWeight: '700',
    color: '#16a34a',
  },
  statusPending: {
    marginLeft: 8,
    fontWeight: '700',
    color: '#2563EB',
  },
});