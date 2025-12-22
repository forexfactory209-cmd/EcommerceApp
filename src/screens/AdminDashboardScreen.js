import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { sendAdminBroadcast } from '../services/notifications';

const COMMISSION_RATE = 0.15;

const AdminDashboardScreen = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('placed_at', { ascending: false });

      if (error) {
        console.warn('Admin dashboard: error loading orders:', error.message || error);
        setOrders([]);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      const mapped = rows.map((row) => ({
        id: row.id,
        items: Array.isArray(row.items) ? row.items : [],
        subtotal: Number(row.subtotal) || 0,
        shipping: Number(row.shipping) || 0,
        total: Number(row.total) || 0,
        status: row.status || 'Pending',
        date: row.placed_at ? new Date(row.placed_at).toLocaleDateString() : '',
        brand_user_id: row.brand_user_id,
        payment_method: row.payment_method || 'cash_on_delivery',
        delivery_address: row.delivery_address || '',
      }));

      setOrders(mapped);
    } catch (e) {
      console.warn('Admin dashboard: exception loading orders:', e.message || e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const totalOrders = orders.length;
  const grossRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const commissionAmount = grossRevenue * COMMISSION_RATE;
  const netToVendors = grossRevenue - commissionAmount;

  const handleSendBroadcast = async () => {
    const title = (broadcastTitle || '').trim();
    const message = (broadcastMessage || '').trim();

    if (!title || !message) {
      Alert.alert('Missing information', 'Please enter both a title and a message.');
      return;
    }

    try {
      setSendingBroadcast(true);
      await sendAdminBroadcast(title, message, { type: 'admin_broadcast' });
      setBroadcastTitle('');
      setBroadcastMessage('');
      Alert.alert('Broadcast sent', 'Your announcement has been sent to users.');
    } catch (e) {
      console.warn('Admin dashboard: failed to send broadcast', e.message || e);
      Alert.alert('Error', 'Could not send broadcast notification.');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const renderOrder = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeaderRow}>
        <View>
          <Text style={styles.orderId}>Order #{item.id}</Text>
          {item.date ? <Text style={styles.orderDate}>{item.date}</Text> : null}
        </View>
        <View style={styles.orderHeaderRight}>
          <Text style={styles.orderTotalLabel}>Total</Text>
          <Text style={styles.orderTotalValue}>${item.total.toFixed(2)}</Text>
          <View style={[styles.statusPill, item.status === 'Delivered' ? styles.statusPillDelivered : styles.statusPillPending]}>
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
              <Text style={styles.orderItemMeta} numberOfLines={1}>
                {prod.brand ? `${prod.brand} · ` : ''}
                {prod.price?.toFixed ? `$${prod.price.toFixed(2)}` : `$${prod.price}`}
              </Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin Revenue Dashboard</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{totalOrders}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statLabel}>Gross Sales</Text>
          <Text style={styles.statValue}>${grossRevenue.toFixed(0)}</Text>
          <Text style={styles.statSubValue}>All brands combined</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPurple]}>
          <Text style={styles.statLabel}>Platform Revenue</Text>
          <Text style={styles.statValue}>${commissionAmount.toFixed(0)}</Text>
          <Text style={styles.statSubValue}>15% commission on sales</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGray]}>
          <Text style={styles.statLabel}>Total Vendor Payout</Text>
          <Text style={styles.statValue}>${netToVendors.toFixed(0)}</Text>
          <Text style={styles.statSubValue}>What brands receive</Text>
        </View>
      </View>

      {/* Admin broadcast form */}
      <View style={styles.broadcastCard}>
        <Text style={styles.broadcastTitle}>Send announcement to all users</Text>
        <TextInput
          style={styles.broadcastInput}
          placeholder="Announcement title"
          value={broadcastTitle}
          onChangeText={setBroadcastTitle}
        />
        <TextInput
          style={[styles.broadcastInput, styles.broadcastTextArea]}
          placeholder="What's new? This will be sent as a notification message."
          value={broadcastMessage}
          onChangeText={setBroadcastMessage}
          multiline
        />
        <TouchableOpacity
          style={[styles.broadcastButton, sendingBroadcast && styles.broadcastButtonDisabled]}
          onPress={handleSendBroadcast}
          disabled={sendingBroadcast}
        >
          <Text style={styles.broadcastButtonText}>
            {sendingBroadcast ? 'Sending...' : 'Send Broadcast'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={
            orders.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }
          }
          renderItem={renderOrder}
          onRefresh={loadOrders}
          refreshing={loading}
          ListEmptyComponent={
            !loading && (
              <Text style={styles.emptyText}>No orders yet.</Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AdminDashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#111827',
  },
  backButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginRight: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statCardBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statCardGreen: {
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
  },
  statCardPurple: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  statCardGray: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
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
  statSubValue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9ca3af',
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
  orderMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  orderMetaBold: {
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  orderTotalLabel: {
    fontSize: 11,
    color: '#6b7280',
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
    backgroundColor: '#dcfce7',
  },
  statusPillPending: {
    backgroundColor: '#dbeafe',
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
    color: '#6b7280',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
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
    color: '#6b7280',
    marginBottom: 2,
    fontWeight: '600',
  },
  orderExtraValue: {
    fontSize: 13,
    color: '#111827',
  },
  orderExtraAddressText: {
    fontSize: 12,
    color: '#4b5563',
  },
  broadcastCard: {
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  broadcastTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  broadcastInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
    marginBottom: 8,
  },
  broadcastTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  broadcastButton: {
    marginTop: 4,
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  broadcastButtonDisabled: {
    opacity: 0.6,
  },
  broadcastButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
