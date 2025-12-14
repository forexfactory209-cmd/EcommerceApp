import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Minus, Plus } from 'lucide-react-native';
import { useStore } from '../store/store';

const CartScreen = ({ navigation }) => {
  const { cart, removeFromCart, clearCart } = useStore();

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

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

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      <Image source={{ uri: item.image }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemBrand}>{item.brand}</Text>
        <Text style={styles.itemPrice}>${item.price}</Text>
        {(() => {
          const options = Array.isArray(item.deliveryOptions)
            ? item.deliveryOptions
            : Array.isArray(item.delivery_options)
            ? item.delivery_options
            : [];
          const chosen = options.find((opt) => opt.id === item.selectedDeliveryId);
          if (!chosen) return null;
          const label = chosen.label || chosen.name;
          return (
            <Text style={styles.itemDelivery} numberOfLines={1}>
              {label}
            </Text>
          );
        })()}
      </View>
      <View style={styles.itemRight}>
        <TouchableOpacity onPress={() => removeFromCart(item.id)}>
            <Trash2 size={20} color="#EF4444" />
        </TouchableOpacity>
        <View style={styles.quantityBadge}>
            <Text style={styles.quantityText}>x{item.quantity}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>My Cart</Text>

      {cart.length === 0 ? (
        <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Your cart is empty</Text>
        </View>
      ) : (
        <>
            <FlatList 
                data={cart}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                showsVerticalScrollIndicator={false}
            />
            
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
                
                <TouchableOpacity 
                    style={styles.checkoutButton}
                    onPress={() => navigation.navigate('Billing')}
                >
                    <Text style={styles.checkoutText}>Checkout</Text>
                </TouchableOpacity>
            </View>
        </>
      )}
    </SafeAreaView>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginVertical: 24,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  itemName: {
    fontWeight: '700',
    fontSize: 18,
    color: '#111827',
  },
  itemBrand: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 4,
  },
  itemPrice: {
    fontWeight: '700',
    fontSize: 18,
    color: '#2563EB',
  },
  itemDelivery: {
    marginTop: 2,
    color: '#6b7280',
    fontSize: 13,
  },
  itemRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityText: {
    fontWeight: '700',
    marginHorizontal: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 18,
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
  checkoutButton: {
    backgroundColor: '#111827',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
  },
});
