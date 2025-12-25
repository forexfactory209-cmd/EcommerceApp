import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const AdminOrdersScreen = ({ navigation }) => {
  const { setOrders } = useStore();
  const orders = useStore((state) => state.orders || []);

  const [loading, setLoading] = useState(false);
  const [notesByOrderId, setNotesByOrderId] = useState({});

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadOrders = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('placed_at', { ascending: false });

          if (error) {
            console.warn('AdminOrders: failed to load orders', error.message || error);
          } else if (isActive) {
            const mapped = (data || []).map((row) => ({
              id: row.id,
              items: Array.isArray(row.items) ? row.items : [],
              subtotal: Number(row.subtotal) || 0,
              shipping: Number(row.shipping) || 0,
              total: Number(row.total) || 0,
              status: row.status || 'Pending',
              date: row.placed_at
                ? new Date(row.placed_at).toLocaleDateString()
                : '',
              brand_user_id: row.brand_user_id,
              payment_method: row.payment_method || 'cash_on_delivery',
              delivery_address: row.delivery_address || '',
              shipping_method: row.shipping_method || null,
              promo_code: row.promo_code || null,
              customer_name: row.customer_name || null,
              customer_phone: row.customer_phone || null,
              customer_secondary_phone: row.customer_secondary_phone || null,
              seller_name: row.seller_name || null,
              seller_phone: row.seller_phone || null,
              admin_note: row.admin_note || '',
            }));
            setOrders(mapped);
            setNotesByOrderId(
              mapped.reduce((acc, o) => {
                acc[o.id] = o.admin_note || '';
                return acc;
              }, {}),
            );
          }
        } catch (e) {
          console.warn('AdminOrders: unexpected error loading data', e.message || e);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      loadOrders();

      return () => {
        isActive = false;
      };
    }, [setOrders]),
  );

  const handleNoteChange = (orderId, text) => {
    setNotesByOrderId((prev) => ({
      ...prev,
      [orderId]: text,
    }));
  };

  const handleSaveNote = async (orderId) => {
    if (!orderId) return;
    const note = notesByOrderId[orderId] || '';

    try {
      const { error } = await supabase
        .from('orders')
        .update({ admin_note: note })
        .eq('id', orderId);

      if (error) {
        console.warn('AdminOrders: failed to save admin note:', error.message || error);
      }
    } catch (e) {
      console.warn('AdminOrders: exception saving admin note:', e.message || e);
    }
  };

  const renderOrder = ({ item }) => {
    return (
      <View style={styles.orderCard}>
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

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Status: {item.status}</Text>
        </View>

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

        {(item.seller_name || item.seller_phone) && (
          <View style={styles.sellerBlock}>
            <Text style={styles.sellerLabel}>Seller</Text>
            {item.seller_name ? (
              <Text style={styles.sellerValue}>{item.seller_name}</Text>
            ) : null}
            {item.seller_phone ? (
              <Text style={styles.sellerValue}>Phone: {item.seller_phone}</Text>
            ) : null}
          </View>
        )}

        {Array.isArray(item.items) && item.items.length > 0 && (
          <View style={styles.orderItemsList}>
            {item.items.map((prod) => {
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
          </View>
        )}

        {item.delivery_address ? (
          <View style={styles.orderExtraAddress}>
            <Text style={styles.orderExtraLabel}>Address:</Text>
            <Text style={styles.orderExtraAddressText} numberOfLines={2}>
              {item.delivery_address}
            </Text>
          </View>
        ) : null}

        {item.payment_method ? (
          <View style={styles.orderExtraRow}>
            <Text style={styles.orderExtraLabel}>Payment:</Text>
            <Text style={styles.orderExtraValue}>{item.payment_method}</Text>
          </View>
        ) : null}

        {item.promo_code ? (
          <Text style={styles.orderPromoMeta}>
            Promo code used: <Text style={styles.orderPromoCode}>{item.promo_code}</Text>
          </Text>
        ) : null}

        <View style={styles.noteContainer}>
          <Text style={styles.noteLabel}>Admin note</Text>
          <TextInput
            style={styles.noteInput}
            value={notesByOrderId[item.id] ?? item.admin_note ?? ''}
            onChangeText={(text) => handleNoteChange(item.id, text)}
            placeholder="Add note about this order"
            multiline
          />
          <TouchableOpacity
            style={styles.noteSaveButton}
            onPress={() => handleSaveNote(item.id)}
          >
            <Text style={styles.noteSaveButtonText}>Save note</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}> Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Orders (Admin)</Text>
      </View>

      <FlashList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{loading ? 'Loading orders...' : 'No orders found'}</Text>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        estimatedItemSize={180}
        renderItem={renderOrder}
      />
    </SafeAreaView>
  );
};

export default AdminOrdersScreen;

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
  backButton: {
    paddingVertical: 7,
    paddingRight: 17,
    backgroundColor:'#090966',
    alignItems:'center',
    textAlign:'center',
    borderRadius:10,
    paddingLeft:10,
    // paddingRight:10,
  },
  backButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    textAlign:'center'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: '#4b5563',
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
  orderPromoMeta: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
  },
  orderPromoCode: {
    fontWeight: '600',
  },
  sellerBlock: {
    marginTop: 6,
  },
  sellerLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  sellerValue: {
    fontSize: 12,
    color: '#111827',
  },
  noteContainer: {
    marginTop: 10,
  },
  noteLabel: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 4,
  },
  noteInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  noteSaveButton: {
    marginTop: 6,
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  noteSaveButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
