import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const BillingScreen = ({ navigation }) => {
  const { cart, clearCart, addOrder, clearWishlistByProductIds, authUserId } = useStore();

  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = cart.reduce((sum, item) => {
    const options = Array.isArray(item.deliveryOptions)
      ? item.deliveryOptions
      : Array.isArray(item.delivery_options)
      ? item.delivery_options
      : [];

    const chosen = options.find((opt) => opt.id === item.selectedDeliveryId);
    const price = typeof chosen?.price === 'number' ? chosen.price : 0;

    return sum + price;
  }, 0);
  const total = subtotal + shipping;

  const handleConfirm = async () => {
    const now = Date.now();

    // Group cart items by brand_user_id so each brand/store gets its own order
    const groupsByBrand = cart.reduce((groups, item) => {
      const key = item.brand_user_id || 'unassigned';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});

    let index = 0;

    for (const [brandKey, items] of Object.entries(groupsByBrand)) {
      const brandSubtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      const brandShipping = items.reduce((sum, item) => {
        const options = Array.isArray(item.deliveryOptions)
          ? item.deliveryOptions
          : Array.isArray(item.delivery_options)
          ? item.delivery_options
          : [];

        const chosen = options.find((opt) => opt.id === item.selectedDeliveryId);
        const price = typeof chosen?.price === 'number' ? chosen.price : 0;

        return sum + price;
      }, 0);

      const brandTotal = brandSubtotal + brandShipping;

      const order = {
        id: now + index,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          brand: item.brand,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: brandSubtotal,
        shipping: brandShipping,
        total: brandTotal,
        status: 'Pending',
        date: new Date().toLocaleDateString(),
        brand_user_id: brandKey === 'unassigned' ? null : brandKey,
        payment_method: paymentMethod,
        delivery_address: deliveryAddress,
      };

      addOrder(order);
      try {
        const { data: orderRow, error: orderError } = await supabase
          .from('orders')
          .insert([
            {
              customer_user_id: authUserId || null,
              brand_user_id: order.brand_user_id,
              items: order.items,
              subtotal: order.subtotal,
              shipping: order.shipping,
              total: order.total,
              status: order.status,
              placed_at: new Date().toISOString(),
              payment_method: order.payment_method,
              delivery_address: order.delivery_address,
            },
          ])
          .select()
          .single();

        if (orderError) {
          console.warn('Billing: failed to create order in Supabase', orderError.message || orderError);
          Alert.alert('Error', 'Could not place order. Please try again.');
          return;
        }

        // Decrement product quantities based on purchased items
        try {
          for (const item of items) {
            const lineQty = item.quantity || 1;

            const { data: prod, error: prodError } = await supabase
              .from('products')
              .select('id, quantity, flash_price, flash_start_at, flash_end_at, flash_quantity, flash_sold')
              .eq('id', item.id)
              .maybeSingle();

            if (prodError) {
              console.warn('Billing: failed to load product for quantity update', prodError.message || prodError);
              continue;
            }

            if (!prod) continue;

            const currentQty = Number(prod.quantity ?? 0);
            const newQty = Math.max(0, currentQty - lineQty);

            const { error: updError } = await supabase
              .from('products')
              .update({ quantity: newQty })
              .eq('id', prod.id);

            if (updError) {
              console.warn('Billing: failed to update product quantity', updError.message || updError);
            }
          }
        } catch (e) {
          console.warn('Billing: exception while updating product quantities', e.message || e);
        }

        // Flash sale quantity tracking and auto-end
        try {
          for (const item of items) {
            const lineQty = item.quantity || 1;

            const { data: prod, error: prodError } = await supabase
              .from('products')
              .select('id, flash_price, flash_start_at, flash_end_at, flash_quantity, flash_sold')
              .eq('id', item.id)
              .maybeSingle();

            if (prodError || !prod) {
              console.warn('Billing: failed to load product for flash tracking', prodError?.message || prodError);
              continue;
            }

            // Only process if this is a flash sale product
            if (prod.flash_price != null && prod.flash_quantity != null) {
              const currentSold = Number(prod.flash_sold) || 0;
              const newSold = currentSold + lineQty;

              const updatePayload = { flash_sold: newSold };

              // If we've reached or exceeded the limit, end the flash sale
              if (newSold >= prod.flash_quantity) {
                updatePayload.flash_price = null;
                updatePayload.flash_start_at = null;
                updatePayload.flash_end_at = null;
                updatePayload.flash_quantity = null;
                updatePayload.flash_sold = 0;
              }

              const { error: flashUpdateError } = await supabase
                .from('products')
                .update(updatePayload)
                .eq('id', prod.id);

              if (flashUpdateError) {
                console.warn('Billing: failed to update flash fields', flashUpdateError.message || flashUpdateError);
              } else {
                if (newSold >= prod.flash_quantity) {
                  console.log(`Billing: flash sale ended for product ${prod.id} (reached limit)`);
                } else {
                  console.log(`Billing: flash_sold updated to ${newSold} for product ${prod.id}`);
                }
              }
            }
          }
        } catch (e) {
          console.warn('Billing: exception while updating flash quantities', e.message || e);
        }
      } catch (e) {
        console.warn('Error saving order to Supabase', e);
      }
      index += 1;
    }

    const purchasedIds = cart.map((item) => item.id);
    clearWishlistByProductIds(purchasedIds);

    clearCart();
    navigation.navigate('Success');
    
    // Optional: ensure flash sale lists refresh on next focus
    setTimeout(() => {
      navigation.navigate('Main', { screen: 'FlashSaleTab' });
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Billing</Text>

        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.list}>
          {cart.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemQty}>x{item.quantity}</Text>
              <Text style={styles.itemPrice}>
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryPanel}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>${shipping.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.paymentRow}>
          {[ 
            { id: 'cash_on_delivery', label: 'Cash on delivery' },
            { id: 'zaad', label: 'ZAAD' },
            { id: 'evc', label: 'EVC' },
          ].map((method) => {
            const active = paymentMethod === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[styles.paymentChip, active && styles.paymentChipActive]}
                onPress={() => setPaymentMethod(method.id)}
              >
                <Text style={[styles.paymentChipText, active && styles.paymentChipTextActive]}>
                  {method.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <TextInput
          style={styles.addressInput}
          placeholder="Street, house/apartment, city, phone number..."
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Confirm Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backHomeButton}
          onPress={() => navigation.navigate('Main', { screen: 'HomeTab' })}
        >
          <Text style={styles.backHomeText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BillingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginVertical: 24,
  },
  list: {
    flexGrow: 0,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  itemQty: {
    width: 40,
    textAlign: 'center',
    color: '#6b7280',
  },
  itemPrice: {
    width: 80,
    textAlign: 'right',
    fontWeight: '600',
    color: '#111827',
  },
  summaryPanel: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
    marginHorizontal: -16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryLabel: {
    color: '#6b7280',
  },
  summaryValue: {
    color: '#111827',
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 24,
  },
  summaryTotalLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563EB',
  },
  confirmButton: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  backHomeButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  backHomeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 8,
  },
  paymentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  paymentChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  paymentChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  paymentChipTextActive: {
    color: '#ffffff',
  },
  addressInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 100,
    fontSize: 14,
    color: '#111827',
  },
});
