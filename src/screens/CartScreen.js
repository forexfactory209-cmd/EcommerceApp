import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Minus, Plus, ArrowLeft } from 'lucide-react-native';
import { useStore } from '../store/store';
import { getFlashSaleState } from '../utils/flashSale';

const circleColors = ['#FFE5D9', '#E0F2FE', '#E0F7EA', '#FDE68A'];

const CartScreen = ({ navigation }) => {
  const { cart, removeFromCart, clearCart, increaseQuantity, decreaseQuantity } = useStore();

  const subtotal = cart.reduce((sum, item) => {
    const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
    const unit = isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
    return sum + unit * (item.quantity || 1);
  }, 0);

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

  const renderItem = ({ item, index }) => (
    <View style={styles.itemRow}>
      <View
        style={[
          styles.itemImageWrapper,
          { backgroundColor: circleColors[index % circleColors.length] },
        ]}
      >
        <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="contain" />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemBrand}>{item.brand}</Text>
        {(() => {
          const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
          const unit = isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
          return (
            <Text style={styles.itemPrice}>
              ${unit.toFixed(2)}
            </Text>
          );
        })()}
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
        <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeButton}>
          <Trash2 size={18} color="#EF4444" />
        </TouchableOpacity>
        <View style={styles.quantityBadge}>
          <TouchableOpacity
            style={styles.quantityCircleButton}
            activeOpacity={0.9}
            onPress={() => decreaseQuantity(item.id)}
          >
            <Minus size={14} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            style={[styles.quantityCircleButton, styles.quantityCircleButtonPrimary]}
            activeOpacity={0.9}
            onPress={() => increaseQuantity(item.id)}
          >
            <Plus size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerIconButton}
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>My Cart</Text>
        {cart.length > 0 ? (
          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.85}
            onPress={clearCart}
          >
            <Trash2 size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerIconPlaceholder} />
        )}
      </View>

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
    backgroundColor: '#eef2ff',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#090966',
    paddingHorizontal: 16,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerIconPlaceholder: {
    width: 36,
    height: 36,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  itemImageWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
  },
  itemBrand: {
    color: '#6b7280',
    fontSize: 14,
  },
  itemPrice: {
    fontWeight: '700',
    fontSize: 16,
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
  removeButton: {
    padding: 4,
  },
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityCircleButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quantityCircleButtonPrimary: {
    backgroundColor: '#090966',
  },
  quantityText: {
    fontWeight: '700',
    fontSize: 14,
    color: '#111827',
    marginHorizontal: 10,
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
    padding: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
    marginHorizontal: -16,
    marginTop: 8,
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
    backgroundColor: '#090966',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
  },
});
