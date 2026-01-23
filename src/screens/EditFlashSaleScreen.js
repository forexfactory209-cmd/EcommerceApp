import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { sendFlashSaleToFollowers } from '../services/notifications';

const EditFlashSaleScreen = ({ route, navigation }) => {
  const { product } = route.params || {};

  const [flashPrice, setFlashPrice] = useState(product?.flash_price ? String(product.flash_price) : '');
  const [duration, setDuration] = useState('60');
  const [flashQuantity, setFlashQuantity] = useState(
    product?.flash_quantity != null ? String(product.flash_quantity) : ''
  );
  const [statusMessage, setStatusMessage] = useState('');

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>No product provided.</Text>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    const priceNum = parseFloat(flashPrice);
    const qtyNum = flashQuantity ? parseInt(flashQuantity, 10) : null;
    const durationMinutes = parseInt(duration, 10) || 60;

    // Prevent creating a flash sale for products that are out of stock
    const baseQuantity =
      product?.quantity != null ? Number(product.quantity) : null;

    if (baseQuantity == null || Number.isNaN(baseQuantity) || baseQuantity <= 0) {
      setStatusMessage('This product is out of stock. Update quantity before starting a flash sale.');
      Alert.alert(
        'Product out of stock',
        'This product currently has no available stock. Please restock and update its quantity before starting a flash sale.',
      );
      return;
    }

    // Compute discount percent relative to the original product price (if available)
    const basePriceNum = product?.price ? Number(product.price) : 0;
    let discountPercent = null;
    if (basePriceNum > 0 && priceNum > 0) {
      const raw = 100 - (priceNum / basePriceNum) * 100;
      discountPercent = Math.max(0, Math.round(raw));
    }

    console.log('[FlashSale] handleSave pressed', {
      flashPrice,
      priceNum,
      flashQuantity,
      qtyNum,
      duration,
      durationMinutes,
      productId: product?.id,
    });

    setStatusMessage('Saving flash sale...');

    if (!priceNum || priceNum <= 0) {
      setStatusMessage('Invalid price. Please enter a valid flash price.');
      Alert.alert('Invalid price', 'Please enter a valid flash price.');
      return;
    }

    try {
      const now = new Date();
      const end = new Date(now.getTime() + durationMinutes * 60 * 1000);

      const { data, error } = await supabase
        .from('products')
        .update({
          flash_price: priceNum,
          flash_start_at: now.toISOString(),
          flash_end_at: end.toISOString(),
          flash_quantity: qtyNum,
        })
        .eq('id', product.id)
        .select()
        .maybeSingle();

      console.log('[FlashSale] update result', { error, data });

      if (error) {
        setStatusMessage('Error: ' + (error.message || 'Failed to save flash sale'));
        Alert.alert('Error', error.message || 'Failed to save flash sale');
        return;
      }

      if (!data) {
        setStatusMessage('Error: product row was not updated.');
        Alert.alert('Error', 'Flash sale not saved. Product row was not updated.');
        return;
      }

      // After successfully saving the flash sale, notify followers of this brand
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: brandRow, error: brandError } = await supabase
            .from('brands')
            .select('id, name')
            .eq('user_id', user.id)
            .maybeSingle();

          if (brandError) {
            console.warn('[FlashSale] Failed to load brand for flash sale notification', brandError.message || brandError);
          } else if (brandRow?.id) {
            console.log('[FlashSale] Sending flash sale notification for brand', brandRow, 'discount:', discountPercent);
            await sendFlashSaleToFollowers(brandRow.id, brandRow.name, discountPercent);
          }
        }
      } catch (notifyError) {
        console.warn('[FlashSale] Failed to send flash sale notification to followers', notifyError.message || notifyError);
      }

      setStatusMessage('Flash sale saved.');
      Alert.alert('Saved', 'Flash sale updated.', [
        {
          text: 'OK',
          onPress: () =>
            navigation.navigate('Main', {
              screen: 'BrandProducts',
            }),
        },
      ]);
    } catch (e) {
      console.log('[FlashSale] exception', e);
      setStatusMessage('Error: ' + (e.message || 'Failed to save flash sale'));
      Alert.alert('Error', e.message || 'Failed to save flash sale');
    }
  };

  const handleEnd = async () => {
    try {
      setStatusMessage('Ending flash sale...');
      const { error } = await supabase
        .from('products')
        .update({
          flash_price: null,
          flash_start_at: null,
          flash_end_at: null,
          flash_quantity: null,
          flash_sold: 0,
        })
        .eq('id', product.id);

      if (error) {
        setStatusMessage('Error: ' + (error.message || 'Failed to end flash sale'));
        Alert.alert('Error', error.message || 'Failed to end flash sale');
        return;
      }

      setStatusMessage('Flash sale ended.');
      Alert.alert('Ended', 'Flash sale ended.', [
        {
          text: 'OK',
          onPress: () =>
            navigation.navigate('Main', {
              screen: 'Vendor',
            }),
        },
      ]);
    } catch (e) {
      setStatusMessage('Error: ' + (e.message || 'Failed to end flash sale'));
      Alert.alert('Error', e.message || 'Failed to end flash sale');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Edit Flash Sale</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            navigation.navigate('Main', {
              screen: 'Vendor',
            })
          }
        >
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
      {statusMessage ? (
        <Text style={styles.statusText}>{statusMessage}</Text>
      ) : null}
      <Text style={styles.productName}>{product.name}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Flash Price</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={flashPrice}
          onChangeText={setFlashPrice}
          placeholder="e.g. 49.99"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={duration}
          onChangeText={setDuration}
          placeholder="e.g. 10, 60, 1440"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Flash Quantity (optional)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={flashQuantity}
          onChangeText={setFlashQuantity}
          placeholder="e.g. 50"
        />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleEnd}>
          <Text style={styles.secondaryButtonText}>End Flash Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default EditFlashSaleScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    marginTop: 40,
    textAlign: 'center',
    color: '#ef4444',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#111827',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
