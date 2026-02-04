import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Minus, Plus, ArrowLeft, Tag, ShoppingBag, ShoppingCart } from 'lucide-react-native';
import { useStore } from '../store/store';
import { getFlashSaleState } from '../utils/productHelpers';

// Brand colors
const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';
const SUCCESS_COLOR = '#10B981';
const BACKGROUND_COLOR = '#f9fafb';

const circleColors = ['#FFE5D9', '#E0F2FE', '#E0F7EA', '#FDE68A'];

const CartScreen = ({ navigation }) => {
  const { cart, removeFromCart, clearCart, increaseQuantity, decreaseQuantity } = useStore();
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState('123 Main St, New York, NY 10001');

  // Mock delivery time
  const estimatedDelivery = '3-5 business days';

  // Mock tax rate (8.25%)
  const taxRate = 0.0825;

  const subtotal = cart.reduce((sum, item) => {
    const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
    const unit = isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
    return sum + unit * (item.quantity || 1);
  }, 0);

  const discount = appliedPromo ? subtotal * (appliedPromo.discount / 100) : 0;
  const taxes = (subtotal - discount) * taxRate;
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

  const total = subtotal - discount + taxes + shipping;

  // Helper functions
  const handleRemoveItem = (itemId, itemName) => {
    Alert.alert(
      'Remove Item',
      `Are you sure you want to remove ${itemName} from your cart?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(itemId) }
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearCart }
      ]
    );
  };

  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }

    // Mock promo codes
    const promoCodes = {
      'SAVE10': { discount: 10, description: '10% off' },
      'SAVE20': { discount: 20, description: '20% off' },
      'WELCOME': { discount: 15, description: '15% off' }
    };

    const promo = promoCodes[promoCode.toUpperCase()];
    if (promo) {
      setAppliedPromo(promo);
      Alert.alert('Success', `${promo.description} applied!`);
    } else {
      Alert.alert('Invalid Code', 'This promo code is not valid');
    }
  };

  const handleChangeAddress = () => {
    // Navigate to address selection or show address modal
    Alert.alert('Change Address', 'Address selection will be implemented');
  };

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

        {/* Product Variants */}
        {(item.size || item.color) && (
          <View style={styles.variantsContainer}>
            {item.size && (
              <Text style={styles.variantText}>Size: {item.size}</Text>
            )}
            {item.color && (
              <Text style={styles.variantText}>Color: {item.color}</Text>
            )}
          </View>
        )}

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
        <TouchableOpacity onPress={() => handleRemoveItem(item.id, item.name)} style={styles.removeButton}>
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
      {/* Top section with image and dark blue overlay like profile screen */}
      <View style={styles.topSection}>
        {/* Background image */}
        <Image
          source={require('../../assets/photo4.jpg')} // Using existing image
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        {/* Dark blue overlay */}
        <View style={styles.overlay} />

        {/* Header content */}
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.screenTitle}>My Cart</Text>
            {cart.length > 0 && (
              <Text style={styles.itemCount}>{cart.length} {cart.length === 1 ? 'item' : 'items'}</Text>
            )}
          </View>

          {cart.length > 0 ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearCart}
            >
              <Trash2 size={18} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholder} />
          )}
        </View>
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyState}>
          <ShoppingBag size={80} color="#D1D5DB" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity
            style={styles.startShoppingButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.startShoppingText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
          <FlatList
            data={cart}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />

          {/* Coupon / Promo Code Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Tag size={20} color={BRAND_COLOR} />
              <Text style={styles.sectionTitle}>Promo Code</Text>
            </View>
            <View style={styles.promoContainer}>
              <TextInput
                style={styles.promoInput}
                placeholder="Enter promo code"
                value={promoCode}
                onChangeText={setPromoCode}
                editable={!appliedPromo}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={[styles.applyButton, appliedPromo && styles.applyButtonDisabled]}
                onPress={handleApplyPromo}
                disabled={appliedPromo}
              >
                <Text style={styles.applyButtonText}>
                  {appliedPromo ? 'Applied' : 'Apply'}
                </Text>
              </TouchableOpacity>
            </View>
            {appliedPromo && (
              <Text style={styles.appliedPromoText}>
                {appliedPromo.description} applied
              </Text>
            )}
          </View>

          <View style={styles.summaryPanel}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.discountValue}>-${discount.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>${shipping.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxes</Text>
              <Text style={styles.summaryValue}>${taxes.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>${total.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.checkoutButton, cart.length === 0 && styles.checkoutButtonDisabled]}
              onPress={() => navigation.navigate('Billing')}
              disabled={cart.length === 0}
            >
              <ShoppingCart size={20} color="#ffffff" style={styles.checkoutIcon} />
              <Text style={styles.checkoutText}>Checkout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default CartScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },

  // Top section with image and dark blue overlay like profile screen
  topSection: {
    height: 80,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BRAND_COLOR,
    opacity: 0.85,
  },
  headerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 25,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  itemCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 36,
    height: 36,
  },
  itemRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    marginTop: 8,
    marginHorizontal: 16,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
  variantsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 12,
  },
  variantText: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemName: {
    fontWeight: '700',
    fontSize: 16,
    color: BRAND_COLOR,
    marginBottom: 2,
  },
  itemBrand: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 4,
  },
  itemPrice: {
    fontWeight: '700',
    fontSize: 16,
    color: BRAND_COLOR,
    marginBottom: 2,
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
    backgroundColor: BRAND_COLOR,
  },
  quantityText: {
    fontWeight: '700',
    fontSize: 14,
    color: BRAND_COLOR,
    marginHorizontal: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyText: {
    color: BRAND_COLOR,
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '500',
  },
  startShoppingButton: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  startShoppingText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  summaryPanel: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
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
    color: BRAND_COLOR,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: BRAND_COLOR,
  },
  checkoutButton: {
    backgroundColor: BRAND_COLOR,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginTop: 8,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  checkoutIcon: {
    marginRight: 8,
  },
  checkoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
  },

  // New section styles
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginLeft: 12,
  },
  promoContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BRAND_COLOR,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    color: BRAND_COLOR,
  },
  applyButton: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  applyButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  applyButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  appliedPromoText: {
    fontSize: 13,
    color: SUCCESS_COLOR,
    fontWeight: '600',
  },
  discountValue: {
    color: SUCCESS_COLOR,
    fontWeight: '700',
  },
});
