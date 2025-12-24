import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const AdminCustomerDetailsScreen = ({ route, navigation }) => {
  const { customerId, customerName } = route.params || {};

  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!customerId) return;

    try {
      setLoading(true);

      const [profileResult, ordersResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('name, role, notification_token')
          .eq('user_id', customerId)
          .maybeSingle(),
        supabase
          .from('orders')
          .select('*')
          .eq('customer_user_id', customerId)
          .order('placed_at', { ascending: false }),
      ]);

      const { data: profileData, error: profileError } = profileResult;
      const { data: orderRows, error: ordersError } = ordersResult;

      if (profileError) {
        console.warn('AdminCustomerDetails: error loading profile', profileError.message || profileError);
      }

      if (ordersError) {
        console.warn('AdminCustomerDetails: error loading orders', ordersError.message || ordersError);
      }

      const safeProfile = profileData || null;
      setProfile(safeProfile);

      const mappedOrders = Array.isArray(orderRows)
        ? orderRows.map((row) => ({
            id: row.id,
            items: Array.isArray(row.items) ? row.items : [],
            subtotal: Number(row.subtotal) || 0,
            shipping: Number(row.shipping) || 0,
            total: Number(row.total) || 0,
            status: row.status || 'Pending',
            date: row.placed_at ? new Date(row.placed_at).toLocaleDateString() : '',
            payment_method: row.payment_method || 'cash_on_delivery',
            delivery_address: row.delivery_address || '',
          }))
        : [];

      setOrders(mappedOrders);
    } catch (e) {
      console.warn('AdminCustomerDetails: exception loading data', e.message || e);
      setProfile(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const renderOrder = ({ item }) => {
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeaderRow}>
          <View>
            <Text style={styles.orderId}>Order #{item.id}</Text>
            {item.date ? <Text style={styles.orderDate}>{item.date}</Text> : null}
          </View>
          <View style={styles.orderHeaderRight}>
            <Text style={styles.orderTotalLabel}>Total</Text>
            <Text style={styles.orderTotalValue}>${item.total.toFixed(2)}</Text>
            <View
              style={[
                styles.statusPill,
                item.status === 'Delivered'
                  ? styles.statusPillDelivered
                  : styles.statusPillPending,
              ]}
            >
              <Text style={styles.statusPillText}>{item.status}</Text>
            </View>
          </View>
        </View>

        {Array.isArray(item.items) && item.items.length > 0 && (
          <View style={styles.orderItemsList}>
            {item.items.map((prod) => (
              <View key={prod.id} style={styles.orderItemRow}>
                <Text style={styles.orderItemMain} numberOfLines={1}>
                  {prod.quantity}x {prod.name}
                </Text>
                {prod.brand || prod.price ? (
                  <Text style={styles.orderItemMeta} numberOfLines={1}>
                    {prod.brand ? `${prod.brand} · ` : ''}
                    {prod.price != null
                      ? prod.price.toFixed
                        ? `$${prod.price.toFixed(2)}`
                        : `$${prod.price}`
                      : ''}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <View style={styles.orderFooter}>
          <View style={styles.orderFooterLeft}>
            <Text style={styles.orderExtraLabel}>Payment</Text>
            <Text style={styles.orderExtraValue}>{item.payment_method}</Text>
          </View>
          {item.delivery_address ? (
            <View style={styles.orderFooterRight}>
              <Text style={styles.orderExtraLabel}>Address</Text>
              <Text style={styles.orderExtraAddressText} numberOfLines={2}>
                {item.delivery_address}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const displayName = profile?.name || customerName || 'Customer';

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Customers</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Details</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileAvatarCircle}>
            <Text style={styles.profileAvatarInitial}>
              {displayName ? displayName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.profileTextBlock}>
            <Text style={styles.profileName}>{displayName}</Text>
            {profile?.role ? (
              <Text style={styles.profileRole}>{profile.role}</Text>
            ) : (
              <Text style={styles.profileRole}>Customer</Text>
            )}
            {profile?.notification_token ? (
              <Text
                style={styles.profileNote}
                numberOfLines={2}
              >
                {profile.notification_token}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardBlue]}>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.statValue}>{totalOrders}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardGreen]}>
            <Text style={styles.statLabel}>Delivered</Text>
            <Text style={styles.statValue}>{deliveredCount}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardPurple]}>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Order History</Text>

        {loading && orders.length === 0 ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color="#2563EB" />
          </View>
        ) : orders.length === 0 ? (
          <Text style={styles.emptyText}>This customer has no orders yet.</Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderOrder}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminCustomerDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  backIcon: {
    fontSize: 16,
    color: '#F9FAFB',
    marginRight: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#111827',
    marginBottom: 16,
  },
  profileAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarInitial: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
  },
  profileTextBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  profileRole: {
    fontSize: 13,
    color: '#E5E7EB',
    marginTop: 4,
  },
  profileNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  statCardBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statCardGreen: {
    backgroundColor: '#ECFDF3',
    borderColor: '#BBF7D0',
  },
  statCardPurple: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingWrapper: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  orderId: {
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  orderTotalLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
  },
  orderTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillDelivered: {
    backgroundColor: '#DCFCE7',
  },
  statusPillPending: {
    backgroundColor: '#DBEAFE',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'capitalize',
  },
  orderItemsList: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
    marginBottom: 6,
  },
  orderItemRow: {
    marginBottom: 4,
  },
  orderItemMain: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  orderItemMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  orderFooterLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderFooterRight: {
    flex: 1,
  },
  orderExtraLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '600',
  },
  orderExtraValue: {
    fontSize: 13,
    color: '#111827',
  },
  orderExtraAddressText: {
    fontSize: 12,
    color: '#4B5563',
  },
});

