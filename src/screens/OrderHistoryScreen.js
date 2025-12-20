import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';

const OrderHistoryScreen = ({ navigation }) => {
  const orders = useStore((state) => state.orders);
  const userType = useStore((state) => state.userType);
  const authUserId = useStore((state) => state.authUserId);

  const myOrders =
    userType === 'brand' && authUserId
      ? orders.filter((o) => o.brand_user_id === authUserId)
      : orders;

  const renderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeaderRow}>
        <Text style={styles.orderTitle}>Order #{item.id}</Text>
        <Text style={styles.orderDate}>{item.date}</Text>
      </View>
      <Text style={styles.orderMeta}>
        {item.items.length} items
        <Text style={styles.orderMetaBold}> • ${item.total.toFixed(2)}</Text>
      </Text>
      {Array.isArray(item.items) && item.items.length > 0 && (
        <View style={styles.orderItemsList}>
          {item.items.slice(0, 3).map((prod) => (
            <Text key={prod.id} style={styles.orderItemLine}>
              {prod.quantity}x {prod.name}
            </Text>
          ))}
          {item.items.length > 3 && (
            <Text style={styles.orderItemMore}>+{item.items.length - 3} more</Text>
          )}
        </View>
      )}
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text
          style={
            item.status === 'Delivered' ? styles.statusDelivered : styles.statusPending
          }
        >
          {item.status}
        </Text>
      </View>
      <View style={styles.extraRow}>
        <Text style={styles.extraLabel}>Payment:</Text>
        <Text style={styles.extraValue}>{item.payment_method || 'N/A'}</Text>
      </View>
      {item.delivery_address ? (
        <View style={styles.extraAddress}>
          <Text style={styles.extraLabel}>Address:</Text>
          <Text style={styles.extraAddressText} numberOfLines={2}>
            {item.delivery_address}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Order History</Text>
      </View>

      {myOrders.length === 0 ? (
        <Text style={styles.emptyText}>You have no orders yet.</Text>
      ) : (
        <FlatList
          data={myOrders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
};

export default OrderHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 0,
  },
  backButtonText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#9ca3af',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    marginTop: 4,
    color: '#6b7280',
    marginBottom: 8,
  },
  orderMetaBold: {
    fontWeight: '700',
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusDelivered: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  statusPending: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
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
  extraRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  extraLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 4,
  },
  extraValue: {
    fontSize: 13,
    color: '#111827',
  },
  extraAddress: {
    marginTop: 4,
  },
  extraAddressText: {
    fontSize: 12,
    color: '#4b5563',
  },
});
