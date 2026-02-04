import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import { getFlashSaleState } from '../utils/productHelpers';

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
  // Shipping cost is no longer charged; keep for display as 0
  const shipping = 0;
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
      Alert.alert(
        'Cart is empty',
        'Please add at least one item to your cart before placing an order.',
      );
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

    const trimmedBackupPhone = (backupPhone || '').trim();
    const numericBackup = trimmedBackupPhone.replace(/[^0-9]/g, '');
    if (!trimmedBackupPhone) {
      Alert.alert(
        'Secondary phone required',
        'Please enter a secondary phone number so the courier can reach you.',
      );
      return;
    }

    // Somalia format validation: allow either local (0xxxxxxxx or 0xxxxxxxxx) or international (252xxxxxxxxx)
    const isSomaliaLocal =
      (numericBackup.length === 9 || numericBackup.length === 10) &&
      numericBackup.startsWith('0');

    const isSomaliaIntl =
      numericBackup.length === 12 &&
      numericBackup.startsWith('252');

    if (!isSomaliaLocal && !isSomaliaIntl) {
      Alert.alert(
        'Invalid phone number',
        'Please enter a valid Somalia phone number, for example 061xxxxxxx or 25261xxxxxxx.',
      );
      return;
    }

    setPlacingOrder(true);

    const now = Date.now();

    try {
      // Extra safety: check for a very recent pending order for this user to avoid duplicates
      if (authUserId) {
        try {
          const since = new Date(now - 15 * 1000).toISOString(); // last 15 seconds
          const { data: recentOrders, error: recentError } = await supabase
            .from('orders')
            .select('id, total, status, placed_at')
            .eq('customer_user_id', authUserId)
            .eq('status', 'pending')
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

      // Determine a human-readable shipping method for the combined order (first selected option wins)
      let combinedShippingMethod = null;
      cart.forEach((item) => {
        if (combinedShippingMethod) return;
        const options = Array.isArray(item.deliveryOptions)
          ? item.deliveryOptions
          : Array.isArray(item.delivery_options)
            ? item.delivery_options
            : [];

        const chosen = options.find((opt) => opt.id === item.selectedDeliveryId);
        if (chosen && !combinedShippingMethod) {
          combinedShippingMethod = chosen.name || chosen.label || null;
        }
      });

      // Build the items snapshot for the orders table (for convenience)
      const orderItemsSnapshot = cart.map((item) => ({
        id: item.id,
        name: item.name,
        brand: item.brand,
        code: item.code || null,
        quantity: item.quantity,
        price: (() => {
          const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
          const unit =
            isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
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
      }));

      const orderPayload = {
        customer_user_id: authUserId || null,
        // We are using a separate order_items table per brand, so keep brand_user_id null on the parent order
        brand_user_id: null,
        items: orderItemsSnapshot,
        subtotal,
        shipping,
        total: grandTotal,
        status: 'pending',
        placed_at: new Date().toISOString(),
        payment_method: paymentMethod,
        delivery_address: deliveryAddress,
        shipping_method: combinedShippingMethod,
        promo_code: appliedPromo?.code || null,
        customer_name: selectedAddress.name || null,
        customer_phone: selectedAddress.phone || null,
        customer_secondary_phone: trimmedBackupPhone || selectedAddress.secondary_phone || null,
      };

      // Persist the single combined order
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderError) {
        console.warn(
          'Billing: failed to create order in Supabase',
          orderError.message || orderError,
        );
        Alert.alert('Error', 'Could not place order. Please try again.');
        return;
      }

      // Insert one row per cart item into order_items, using the shared order id
      try {
        const orderItemsPayload = cart.map((item) => {
          const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
          const unit =
            isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;

          const options = Array.isArray(item.deliveryOptions)
            ? item.deliveryOptions
            : Array.isArray(item.delivery_options)
              ? item.delivery_options
              : [];
          const chosen = options.find((opt) => opt.id === item.selectedDeliveryId);

          return {
            order_id: orderRow.id,
            product_id: item.id,
            brand_user_id: item.brand_user_id || null,
            name: item.name,
            quantity: item.quantity || 1,
            unit_price: unit,
            color:
              (item.selectedColor && String(item.selectedColor)) ||
              (item.color && String(item.color)) ||
              null,
            size:
              (item.selectedSize && String(item.selectedSize)) ||
              (item.size && String(item.size)) ||
              null,
            delivery_type: chosen ? chosen.label || chosen.name || null : null,
            image_url: item.image || null,
          };
        });

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItemsPayload);

        if (itemsError) {
          console.warn('Billing: failed to insert order_items', itemsError.message || itemsError);
        }
      } catch (e) {
        console.warn('Billing: exception inserting order_items', e.message || e);
      }

      // Create a notification for each distinct brand in the cart
      try {
        const brandUserIds = Array.from(
          new Set(
            cart
              .map((item) => item.brand_user_id)
              .filter((id) => typeof id === 'string' && id.length > 0),
          ),
        );

        if (brandUserIds.length > 0) {
          const { data: brandRows, error: brandsError } = await supabase
            .from('brands')
            .select('id, user_id')
            .in('user_id', brandUserIds);

          if (brandsError) {
            console.warn(
              'Billing: failed to load brands for notifications',
              brandsError.message || brandsError,
            );
          } else if (Array.isArray(brandRows) && brandRows.length > 0) {
            const notificationsPayload = brandRows
              .filter((b) => b.user_id)
              .map((b) => ({
                user_id: b.user_id,
                brand_id: b.id,
                title: 'New order received',
                message: `You have a new order #${orderRow.id} to review.`,
                data: { order_id: orderRow.id },
                is_read: false,
              }));

            if (notificationsPayload.length > 0) {
              await supabase.from('notifications').insert(notificationsPayload);
            }
          }
        }
      } catch (notifErr) {
        console.warn('Billing: failed to create brand notifications', notifErr.message || notifErr);
      }

      // Local confirmation notification to the customer
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
        for (const item of cart) {
          const lineQty = item.quantity || 1;

          const { data: prod, error: prodError } = await supabase
            .from('products')
            .select(
              'id, quantity, flash_price, flash_start_at, flash_end_at, flash_quantity, flash_sold',
            )
            .eq('id', item.id)
            .maybeSingle();

          if (prodError) {
            console.warn(
              'Billing: failed to load product for quantity update',
              prodError.message || prodError,
            );
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
        for (const item of cart) {
          const lineQty = item.quantity || 1;

          const { data: prod, error: prodError } = await supabase
            .from('products')
            .select('id, flash_price, flash_start_at, flash_end_at, flash_quantity, flash_sold')
            .eq('id', item.id)
            .maybeSingle();

          if (prodError || !prod) {
            console.warn(
              'Billing: failed to load product for flash tracking',
              prodError?.message || prodError,
            );
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
              console.warn(
                'Billing: failed to update flash fields',
                flashUpdateError.message || flashUpdateError,
              );
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

      // Clear local/cart state after successful order placement
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Billing</Text>

          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.list}>
            {cart.map((item, index) => {
              const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
              const unit = isFlashActive && flashPrice != null && flashPrice > 0 ? flashPrice : currentPrice;
              const lineTotal = unit * (item.quantity || 1);

              const displayColor =
                (item.selectedColor && String(item.selectedColor)) ||
                (item.color && String(item.color)) ||
                null;
              const displaySize =
                (item.selectedSize && String(item.selectedSize)) ||
                (item.size && String(item.size)) ||
                null;

              return (
                <View key={`${item.id}-${index}`} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {(displayColor || displaySize) && (
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {displayColor ? `Color: ${displayColor}` : ''}
                        {displayColor && displaySize ? '  •  ' : ''}
                        {displaySize ? `Size: ${displaySize}` : ''}
                      </Text>
                    )}
                  </View>
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

          <Text style={styles.sectionTitle}>Secondary phone for delivery</Text>
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
            style={[styles.backHomeButton, placingOrder && { opacity: 0.5 }]}
            onPress={() => {
              if (placingOrder) return;
              navigation.navigate('Main', { screen: 'HomeTab' });
            }}
            disabled={placingOrder}
          >
            <Text style={styles.backHomeText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  itemMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#090966',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 13,
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
    backgroundColor: '#090966',
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
    backgroundColor: '#090966',
    borderColor: '#090966',
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
    borderColor: '#090966',
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
    color: '#090966',
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
