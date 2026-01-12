import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const BrandDiscountScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);

  const [discountInput, setDiscountInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [scope, setScope] = useState('all'); // 'all' or 'category'
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadBrandDiscount = async () => {
        if (!authUserId) return;

        try {
          const { data: brandRow, error } = await supabase
            .from('brands')
            .select('discount_percentage')
            .eq('user_id', authUserId)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            console.warn('BrandDiscount: failed to load brand discount', error.message || error);
          } else if (isActive && brandRow && typeof brandRow.discount_percentage === 'number') {
            setDiscountInput(String(brandRow.discount_percentage));
          }
        } catch (e) {
          console.warn('BrandDiscount: exception loading discount', e.message || e);
        }

        // Load distinct categories for this brand's products so discount can target a category
        try {
          const { data: products, error: prodError } = await supabase
            .from('products')
            .select('category')
            .eq('brand_user_id', authUserId)
            .or('is_deleted.is.null,is_deleted.eq.false');

          if (prodError) {
            console.warn('BrandDiscount: failed to load product categories', prodError.message || prodError);
          } else if (isActive && Array.isArray(products)) {
            const set = new Set();
            products.forEach((p) => {
              if (p && p.category && typeof p.category === 'string') {
                set.add(p.category);
              }
            });
            setCategories(Array.from(set));
          }
        } catch (e) {
          console.warn('BrandDiscount: exception loading product categories', e.message || e);
        }
      };

      loadBrandDiscount();

      return () => {
        isActive = false;
      };
    }, [authUserId]),
  );

  const handleApplyDiscount = async () => {
    if (!authUserId) return;

    const trimmed = (discountInput || '').toString().trim();
    const value = parseFloat(trimmed.replace('%', ''));
    if (!trimmed || Number.isNaN(value) || value <= 0 || value >= 100) {
      Alert.alert('Invalid discount', 'Enter a percentage between 0 and 100.');
      return;
    }

    try {
      setApplying(true);
      setStatusMessage('Applying discount...');

      const factor = 1 - value / 100;

      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('brand_user_id', authUserId)
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (prodError) {
        console.warn('BrandDiscount: failed to load products for discount', prodError.message || prodError);
      }

      let list = Array.isArray(products) ? products : [];
      if (scope === 'category' && selectedCategory) {
        list = list.filter((p) => p.category === selectedCategory);
      }

      for (const prod of list) {
        const currentPrice = Number(prod.price) || 0;
        const newPrice = Number((currentPrice * factor).toFixed(2));

        try {
          const { error } = await supabase
            .from('products')
            .update({ price: newPrice })
            .eq('id', prod.id);

          if (error) {
            console.warn('BrandDiscount: failed to update product price', error.message || error);
          }
        } catch (e) {
          console.warn('BrandDiscount: exception updating product price', e.message || e);
        }
      }

      try {
        const { error: brandError } = await supabase
          .from('brands')
          .update({ discount_percentage: value })
          .eq('user_id', authUserId);

        if (brandError) {
          console.warn('BrandDiscount: failed to persist discount percentage', brandError.message || brandError);
        }
      } catch (e) {
        console.warn('BrandDiscount: exception persisting discount percentage', e.message || e);
      }

      setStatusMessage('Discount applied.');
      Alert.alert('Discount applied', 'All your products have been discounted.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } finally {
      setApplying(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!authUserId) return;

    const trimmed = (discountInput || '').toString().trim();
    const value = parseFloat(trimmed.replace('%', ''));
    if (!trimmed || Number.isNaN(value) || value <= 0 || value >= 100) {
      Alert.alert('Invalid discount', 'Enter the existing discount percentage to remove it.');
      return;
    }

    try {
      setApplying(true);
      setStatusMessage('Removing discount...');

      const factor = 1 - value / 100;
      if (factor <= 0) {
        Alert.alert('Invalid discount', 'Discount factor is invalid.');
        return;
      }

      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('brand_user_id', authUserId)
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (prodError) {
        console.warn('BrandDiscount: failed to load products to remove discount', prodError.message || prodError);
      }

      let list = Array.isArray(products) ? products : [];
      if (scope === 'category' && selectedCategory) {
        list = list.filter((p) => p.category === selectedCategory);
      }

      for (const prod of list) {
        const currentPrice = Number(prod.price) || 0;
        const newPrice = Number((currentPrice / factor).toFixed(2));

        try {
          const { error } = await supabase
            .from('products')
            .update({ price: newPrice })
            .eq('id', prod.id);

          if (error) {
            console.warn('BrandDiscount: failed to restore product price', error.message || error);
          }
        } catch (e) {
          console.warn('BrandDiscount: exception restoring product price', e.message || e);
        }
      }

      if (scope === 'all') {
        try {
          const { error: brandError } = await supabase
            .from('brands')
            .update({ discount_percentage: null })
            .eq('user_id', authUserId);

          if (brandError) {
            console.warn('BrandDiscount: failed to clear discount percentage', brandError.message || brandError);
          }
        } catch (e) {
          console.warn('BrandDiscount: exception clearing discount percentage', e.message || e);
        }
      }

      setDiscountInput('');
      setStatusMessage('Discount removed.');
      Alert.alert('Discount removed', 'All discounts have been removed from your products.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } finally {
      setApplying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Brand Discount</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>

      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

      <Text style={styles.label}>Discount (%)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 10 for 10%"
        keyboardType="numeric"
        value={discountInput}
        onChangeText={setDiscountInput}
      />

      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={[styles.scopeChip, scope === 'all' && styles.scopeChipActive]}
          onPress={() => setScope('all')}
          disabled={applying}
        >
          <Text style={scope === 'all' ? styles.scopeChipTextActive : styles.scopeChipText}>All products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeChip, scope === 'category' && styles.scopeChipActive]}
          onPress={() => setScope('category')}
          disabled={applying}
        >
          <Text style={scope === 'category' ? styles.scopeChipTextActive : styles.scopeChipText}>
            By category
          </Text>
        </TouchableOpacity>
      </View>

      {scope === 'category' && categories.length > 0 && (
        <View style={styles.categorySelector}>
          <Text style={styles.label}>Select category</Text>
          <View style={styles.dropdownWrapper}>
            <TouchableOpacity
              style={styles.dropdownSelected}
              activeOpacity={0.8}
              disabled={applying}
              onPress={() => setCategoryOpen((prev) => !prev)}
            >
              <Text style={styles.dropdownSelectedText}>
                {selectedCategory || 'Choose a category'}
              </Text>
            </TouchableOpacity>
            {categoryOpen && (
              <View style={styles.dropdownOptions}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setCategoryOpen(false);
                    }}
                    disabled={applying}
                  >
                    <Text style={styles.dropdownOptionText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleRemoveDiscount}
          disabled={applying}
        >
          <Text style={styles.secondaryButtonText}>Remove Discount</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleApplyDiscount}
          disabled={applying}
        >
          <Text style={styles.primaryButtonText}>Add Discount</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default BrandDiscountScreen;

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
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusText: {
    marginBottom: 8,
    fontSize: 13,
    color: '#4b5563',
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
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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
  scopeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scopeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#f9fafb',
  },
  scopeChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  scopeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  scopeChipTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  categorySelector: {
    marginBottom: 12,
  },
  dropdownWrapper: {
    marginTop: 4,
  },
  dropdownSelected: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: '#111827',
  },
  dropdownOptions: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#374151',
  },
});
