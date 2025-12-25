import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import { getFlashSaleState } from '../utils/flashSale';

const BillingScreen = ({ navigation }) => {
  const { cart, clearCart, addOrder, clearWishlistByProductIds, authUserId } = useStore();

  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [backupPhone, setBackupPhone] = useState('');

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // Promo code state
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null); // { id, code, discountAmount, brand_user_id }
  const [promoFeedback, setPromoFeedback] = useState('');
  const [promoApplying, setPromoApplying] = useState(false);

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

  const promoDiscount = appliedPromo?.discountAmount || 0;
  const grandTotal = Math.max(0, total - promoDiscount);

  useEffect(() => {
    const loadAddresses = async () => {
      if (!authUserId) {
        setSavedAddresses([]);
        return;
      }
      try {
        setAddressesLoading(true);
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('id, name, country, city, phone, secondary_phone, address_line, is_primary')
          .eq('user_id', authUserId)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Billing: failed to load saved addresses', error.message || error);
          setSavedAddresses([]);
          return;
        }

        const list = Array.isArray(data) ? data : [];
        setSavedAddresses(list);

        const primary = list.find((a) => a.is_primary);
        const first = primary || list[0];
        if (first) {
          setSelectedAddressId(first.id);
          const composed = `${first.address_line}\n${first.city || ''}${first.city && first.country ? ', ' : ''}${first.country || ''}`;
          setDeliveryAddress(composed.trim());
          setBackupPhone(first.secondary_phone || '');
        }
      } catch (e) {
        console.warn('Billing: unexpected error loading saved addresses', e.message || e);
        setSavedAddresses([]);
      } finally {
        setAddressesLoading(false);
      }
    };

    loadAddresses();
  }, [authUserId]);

  const handleApplyPromo = async () => {
    const raw = (promoCodeInput || '').trim();
    if (!raw) {
      setPromoFeedback('Enter a promo code to apply.');
      setAppliedPromo(null);
      return;
    }

    if (!cart || cart.length === 0) {
      setPromoFeedback('Your cart is empty.');
      setAppliedPromo(null);
      return;
    }

    // For now, promo codes apply only when all items belong to a single brand.
    const brandIds = Array.from(
      new Set(
        cart
          .map((item) => item.brand_user_id)
          .filter((id) => typeof id === 'string' && id.length > 0),
      ),
    );

    if (brandIds.length !== 1) {
      setPromoFeedback('Promo codes can be used when your cart is from a single brand.');
      setAppliedPromo(null);
      return;
    }

    const brandId = brandIds[0];
    const normalizedCode = raw.toUpperCase();

    try {
      setPromoApplying(true);
      setPromoFeedback('');

      const { data: promoRow, error } = await supabase
        .from('promo_codes')
        .select('id, code, brand_user_id, discount_percentage, is_active, expires_at')
        .eq('code', normalizedCode)
        .eq('brand_user_id', brandId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('Billing: failed to validate promo code', error.message || error);
        setPromoFeedback('Could not validate promo code. Please try again.');
        setAppliedPromo(null);
        return;
      }

      if (!promoRow) {
        setPromoFeedback('Promo code is invalid or expired.');
        setAppliedPromo(null);
        return;
      }

      if (promoRow.expires_at) {
        try {
          const expiryDate = new Date(promoRow.expires_at);
          if (!Number.isNaN(expiryDate.getTime())) {
            const nowDate = new Date();

            const expiryDay = new Date(
              expiryDate.getFullYear(),
              expiryDate.getMonth(),
              expiryDate.getDate(),
              0,
              0,
              0,
              0,
            );
            const today = new Date(
              nowDate.getFullYear(),
              nowDate.getMonth(),
              nowDate.getDate(),
              0,
              0,
              0,
              0,
            );

            if (expiryDay.getTime() < today.getTime()) {
              setPromoFeedback('Promo code has expired.');
              setAppliedPromo(null);
              return;
            }
          }
        } catch (e) {
        }
      }

      const discountValue = Number(promoRow.discount_percentage) || 0;
      if (discountValue <= 0 || discountValue >= 100) {
        setPromoFeedback('Promo code is not configured with a valid discount percentage.');
        setAppliedPromo(null);
        return;
      }

      const discountAmount = Math.max(0, total * (discountValue / 100));

      if (discountAmount <= 0) {
        setPromoFeedback('Promo code does not apply to this order.');
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo({
        id: promoRow.id,
        code: promoRow.code,
        discountAmount,
        brand_user_id: promoRow.brand_user_id,
      });
      setPromoFeedback(`Promo code applied: -${discountValue.toFixed(0)}% off your order.`);
    } catch (e) {
      console.warn('Billing: unexpected error while applying promo', e.message || e);
      setPromoFeedback('Something went wrong while applying the promo code.');
      setAppliedPromo(null);
    } finally {
      setPromoApplying(false);
    }
  };

  const handleConfirm = async () => {
    if (placingOrder) {
      return;
    }

    if (!cart || cart.length === 0) {
      Alert.alert('Cart is empty', 'Please add at least one item to your cart before placing an order.');
      return;
    }

    const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId) || null;

    if (!selectedAddress) {
      if (!savedAddresses || savedAddresses.length === 0) {
        Alert.alert(
          'No saved address',
          'No available address. Please add an address from Saved Addresses first.',
          [
            {
              text: 'Go to Saved Addresses',
              onPress: () => navigation.navigate('Addresses'),
            },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Select address', 'Please choose one of your saved addresses for delivery.');
      }
      return;
    }

    if (!deliveryAddress || !deliveryAddress.trim()) {
      Alert.alert(
        'Missing address details',
        'Your delivery address is missing. Please select a valid saved address.',
      );
      return;
    }

    setPlacingOrder(true);

    const now = Date.now();

    const promoBrandId = appliedPromo?.brand_user_id || null;
    const promoPercent = appliedPromo ? Number(appliedPromo.discountAmount / total) : 0;
    const promoCodeValue = appliedPromo?.code || null;

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

    try {
      // Extra safety: check for a very recent pending order for this user to avoid duplicates
      if (authUserId) {
        try {
          const since = new Date(now - 15 * 1000).toISOString(); // last 15 seconds
          const { data: recentOrders, error: recentError } = await supabase
            .from('orders')
            .select('id, total, status, placed_at')
            .eq('customer_user_id', authUserId)
            .eq('status', 'Pending')
            .gte('placed_at', since)
            .limit(1);

          if (!recentError && Array.isArray(recentOrders) && recentOrders.length > 0) {
            Alert.alert(
              'Order already placed',
              'We detected a recent order. Please wait a moment before trying again.',
            );
            return;
          }
        } catch (e) {
          console.warn('Billing: failed duplicate-order safety check', e.message || e);
        }
      }

      for (const [brandKey, items] of Object.entries(groupsByBrand)) {
        const brandSubtotal = items.reduce((sum, item) => {
          const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
          const unit = isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
          return sum + unit * (item.quantity || 1);
        }, 0);

        let brandShippingMethod = null;
        const brandShipping = items.reduce((sum, item) => {
          const options = Array.isArray(item.deliveryOptions)
            ? item.deliveryOptions
            : Array.isArray(item.delivery_options)
            ? item.delivery_options
            : [];

          const chosen = options.find((opt) => opt.id === item.selectedDeliveryId);
          const price = typeof chosen?.price === 'number' ? chosen.price : 0;

          if (chosen && !brandShippingMethod) {
            brandShippingMethod = chosen.name || chosen.label || null;
          }

          return sum + price;
        }, 0);

        const brandTotal = brandSubtotal + brandShipping;

        let appliedDiscountForOrder = 0;
        let promoCodeForOrder = null;
        if (
          promoPercent > 0 &&
          promoBrandId &&
          brandKey !== 'unassigned' &&
          brandKey === promoBrandId
        ) {
          appliedDiscountForOrder = Math.max(0, brandTotal * promoPercent);
          promoCodeForOrder = promoCodeValue;
        }

        const finalBrandTotal = Math.max(0, brandTotal - appliedDiscountForOrder);

        const order = {
          id: now + index,
          items: items.map((item) => ({
            id: item.id,
            name: item.name,
            brand: item.brand,
            quantity: item.quantity,
            price: (() => {
              const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
              const unit = isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
              return unit;
            })(),
            color:
              (item.selectedColor && String(item.selectedColor)) ||
              (item.color && String(item.color)) ||
              null,
            size:
              (item.selectedSize && String(item.selectedSize)) ||
              (item.size && String(item.size)) ||
              null,
            delivery_type: (() => {
              const options = Array.isArray(item.deliveryOptions)
                ? item.deliveryOptions
                : Array.isArray(item.delivery_options)
                ? item.delivery_options
                : [];
              const chosen = options.find((opt) => opt.id === item.selectedDeliveryId);
              if (!chosen) return null;
              return chosen.label || chosen.name || null;
            })(),
          })),
          subtotal: brandSubtotal,
          shipping: brandShipping,
          total: finalBrandTotal,
          status: 'Pending',
          date: new Date().toLocaleDateString(),
          brand_user_id: brandKey === 'unassigned' ? null : brandKey,
          payment_method: paymentMethod,
          delivery_address: deliveryAddress,
          shipping_method: brandShippingMethod,
          promo_code: promoCodeForOrder,
          customer_name: selectedAddress.name || null,
          customer_phone: selectedAddress.phone || null,
          customer_secondary_phone:
            (backupPhone && backupPhone.trim()) || selectedAddress.secondary_phone || null,
        };

        addOrder(order);
        try {
          // Load seller/brand info for this order so we can denormalize
          // seller_name and seller_phone into the orders table.
          let sellerName = null;
          let sellerPhone = null;
          if (order.brand_user_id) {
            try {
              const { data: brandRow, error: brandError } = await supabase
                .from('brands')
                .select('name, contact_phone')
                .eq('user_id', order.brand_user_id)
                .maybeSingle();

              if (brandError) {
                console.warn('Billing: failed to load brand for seller info', brandError.message || brandError);
              } else if (brandRow) {
                sellerName = brandRow.name || null;
                sellerPhone = brandRow.contact_phone || null;
              }
            } catch (e) {
              console.warn('Billing: exception loading brand for seller info', e.message || e);
            }
          }

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
                shipping_method: order.shipping_method,
                promo_code: order.promo_code,
                customer_name: order.customer_name,
                customer_phone: order.customer_phone,
                customer_secondary_phone: order.customer_secondary_phone,
                seller_name: sellerName,
                seller_phone: sellerPhone,
              },
            ])
            .select()
            .single();

          if (orderError) {
            console.warn('Billing: failed to create order in Supabase', orderError.message || orderError);
            Alert.alert('Error', 'Could not place order. Please try again.');
            return;
          }

          // Create a notification for the brand so they see a "new order" alert
          if (orderRow && orderRow.brand_user_id) {
            try {
              await supabase.from('notifications').insert([
                {
                  user_id: orderRow.brand_user_id,
                  type: 'brand_order_placed',
                  order_id: orderRow.id,
                  title: 'New order received',
                  body: `You have a new order #${orderRow.id} to review.`,
                },
              ]);
            } catch (notifErr) {
              console.warn('Billing: failed to create brand notification', notifErr.message || notifErr);
            }
          }

        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Order placed',
              body: `Your order #${orderRow.id} was created successfully.`,
              sound: 'default',
            },
            trigger: null,
          });
        } catch (e) {
          console.warn('Billing: failed to schedule local notification', e.message || e);
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
    setAppliedPromo(null);
    setPromoCodeInput('');
    setPromoFeedback('');
    navigation.navigate('Success');
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Billing</Text>

        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.list}>
          {cart.map((item, index) => {
            const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
            const unit = isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
            const lineTotal = unit * (item.quantity || 1);

            return (
              <View key={`${item.id}-${index}`} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemQty}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>
                  ${lineTotal.toFixed(2)}
                </Text>
              </View>
            );
          })}
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
          {promoDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Promo discount{appliedPromo?.code ? ` (${appliedPromo.code})` : ''}
              </Text>
              <Text style={styles.summaryValue}>- ${promoDiscount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>${grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Promo Code</Text>
        <View style={styles.promoRow}>
          <TextInput
            style={styles.promoInput}
            placeholder="Enter promo code"
            autoCapitalize="characters"
            value={promoCodeInput}
            onChangeText={(text) => {
              setPromoCodeInput(text);
              setPromoFeedback('');
            }}
          />
          <TouchableOpacity
            style={styles.promoButton}
            onPress={handleApplyPromo}
            disabled={promoApplying}
          >
            <Text style={styles.promoButtonText}>
              {promoApplying ? 'Applying...' : appliedPromo ? 'Re-apply' : 'Apply'}
            </Text>
          </TouchableOpacity>
        </View>
        {!!promoFeedback && (
          <Text style={styles.promoFeedback}>{promoFeedback}</Text>
        )}

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

        {savedAddresses.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Choose saved address</Text>
            {addressesLoading ? (
              <ActivityIndicator style={{ marginVertical: 8 }} />
            ) : (
              <FlatList
                data={savedAddresses}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.addressCarouselContent}
                renderItem={({ item }) => {
                  const isSelected = selectedAddressId === item.id;
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[
                        styles.addressCard,
                        isSelected && styles.addressCardSelected,
                        item.is_primary && styles.addressCardPrimary,
                      ]}
                      onPress={() => {
                        setSelectedAddressId(item.id);
                        const composed = `${item.address_line}\n${item.city || ''}${item.city && item.country ? ', ' : ''}${item.country || ''}`;
                        setDeliveryAddress(composed.trim());
                      }}
                    >
                      <View style={styles.addressCardHeaderRow}>
                        <Text style={styles.addressCardName} numberOfLines={1}>
                          {item.name || 'Recipient'}
                        </Text>
                        {item.is_primary && (
                          <Text style={styles.addressCardBadge}>Primary</Text>
                        )}
                      </View>
                      <Text style={styles.addressCardAddress} numberOfLines={2}>
                        {item.address_line}
                      </Text>
                      <Text style={styles.addressCardMeta} numberOfLines={1}>
                        {item.city}
                        {item.city && item.country ? ', ' : ''}
                        {item.country}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </>
        )}

        {savedAddresses.length === 0 && !addressesLoading && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
              You have no saved delivery address yet.
            </Text>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: '#090966' }]}
              onPress={() => navigation.navigate('Addresses')}
            >
              <Text style={styles.confirmText}>Add Address</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Secondary phone for delivery (optional)</Text>
        <TextInput
          style={styles.secondaryPhoneInput}
          placeholder="Backup phone number"
          value={backupPhone}
          onChangeText={setBackupPhone}
          keyboardType="phone-pad"
          placeholderTextColor="#9CA3AF"
        />

        <TouchableOpacity
          style={[styles.confirmButton, placingOrder && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={placingOrder}
        >
          <Text style={styles.confirmText}>{placingOrder ? 'Placing order...' : 'Confirm Order'}</Text>
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
    marginBottom:13,
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
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  promoInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginRight: 8,
  },
  promoButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  promoButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  promoFeedback: {
    marginTop: 4,
    fontSize: 12,
    color: '#16a34a',
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
  addressCarouselContent: {
    paddingVertical: 8,
  },
  addressCard: {
    width: 220,
    marginRight: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addressCardSelected: {
    borderColor: '#2563EB',
  },
  addressCardPrimary: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  addressCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressCardName: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  addressCardBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B5CF6',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  addressCardAddress: {
    fontSize: 13,
    color: '#111827',
    marginBottom: 2,
  },
  addressCardMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  secondaryPhoneInput: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
