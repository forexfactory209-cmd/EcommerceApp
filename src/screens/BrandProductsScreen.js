import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const BrandProductsScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const deleteProduct = useStore((state) => state.deleteProduct);

  const [remoteProducts, setRemoteProducts] = useState([]);
  const [brandDiscount, setBrandDiscount] = useState(null);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadProducts = async () => {
        if (!authUserId) {
          setRemoteProducts([]);
          return;
        }

        try {
          setLoading(true);
          // Load brand discount percentage
          try {
            const { data: brandRow, error: brandError } = await supabase
              .from('brands')
              .select('discount_percentage')
              .eq('user_id', authUserId)
              .maybeSingle();

            if (brandError && brandError.code !== 'PGRST116') {
              console.warn('BrandProducts: failed to load brand discount', brandError.message || brandError);
            } else if (isActive && brandRow && typeof brandRow.discount_percentage === 'number') {
              setBrandDiscount(brandRow.discount_percentage);
            } else if (isActive) {
              setBrandDiscount(null);
            }
          } catch (e) {
            console.warn('BrandProducts: exception loading brand discount', e.message || e);
          }

          const { data: prodByOwner, error: prodOwnerError } = await supabase
            .from('products')
            .select('*')
            .eq('brand_user_id', authUserId)
            .or('is_deleted.is.null,is_deleted.eq.false');

          if (prodOwnerError) {
            console.warn('BrandProducts: failed to load products', prodOwnerError.message || prodOwnerError);
          }

          if (isActive) {
            setRemoteProducts(Array.isArray(prodByOwner) ? prodByOwner : []);
          }
        } catch (e) {
          console.warn('BrandProducts: unexpected error loading products', e.message || e);
        } finally {
          if (isActive) setLoading(false);
        }
      };

      loadProducts();

      return () => {
        isActive = false;
      };
    }, [authUserId]),
  );

  const handleDeleteProduct = async (productId) => {
    if (!productId) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ is_deleted: true })
        .eq('id', productId);

      if (error) {
        console.warn('BrandProducts: delete product error:', error.message || error);
        Alert.alert('Error', error.message || 'Could not delete product.');
        return;
      }

      setRemoteProducts((prev) => (Array.isArray(prev) ? prev.filter((p) => p.id !== productId) : prev));
      if (typeof deleteProduct === 'function') {
        deleteProduct(productId);
      }
    } catch (e) {
      console.warn('BrandProducts: exception deleting product:', e.message || e);
      Alert.alert('Error', 'Something went wrong while deleting this product.');
    }
  };

  const segmented = useMemo(() => {
    const all = Array.isArray(remoteProducts) ? remoteProducts : [];

    const nowIso = new Date().toISOString();

    const flash = all.filter((p) => {
      if (p.flash_price == null) return false;
      if (!p.flash_start_at || !p.flash_end_at) return false;
      return p.flash_start_at <= nowIso && p.flash_end_at > nowIso;
    });

    const outOfStock = all.filter((p) => {
      const qty = p.quantity != null ? Number(p.quantity) : null;
      return qty != null && !Number.isNaN(qty) && qty <= 0;
    });

    const active = all.filter((p) => !flash.includes(p) && !outOfStock.includes(p));

    return { active, flash, outOfStock };
  }, [remoteProducts]);

  const currentList =
    tab === 'flash' ? segmented.flash : tab === 'out_of_stock' ? segmented.outOfStock : segmented.active;

  const handleEndFlashSale = async (productId) => {
    if (!productId) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          flash_price: null,
          flash_start_at: null,
          flash_end_at: null,
          flash_quantity: null,
          flash_sold: 0,
        })
        .eq('id', productId);

      if (error) {
        console.warn('BrandProducts: failed to end flash sale', error.message || error);
        Alert.alert('Error', error.message || 'Could not end flash sale.');
        return;
      }

      // Update local state so the product moves back to the active list
      setRemoteProducts((prev) =>
        Array.isArray(prev)
          ? prev.map((p) =>
              p.id === productId
                ? {
                    ...p,
                    flash_price: null,
                    flash_start_at: null,
                    flash_end_at: null,
                    flash_quantity: null,
                    flash_sold: 0,
                  }
                : p,
            )
          : prev,
      );
    } catch (e) {
      console.warn('BrandProducts: exception ending flash sale', e.message || e);
      Alert.alert('Error', 'Something went wrong while ending this flash sale.');
    }
  };

  const TabButton = ({ id, label }) => {
    const isActive = tab === id;
    return (
      <TouchableOpacity
        style={[styles.topTabButton, isActive && styles.topTabButtonActive]}
        onPress={() => setTab(id)}
      >
        <Text style={[styles.topTabText, isActive && styles.topTabTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderProductCard = (item) => {
    const price = Number(item.price || 0) || 0;
    const qty = item.quantity != null ? Number(item.quantity) : null;

    const hasBrandDiscount = typeof brandDiscount === 'number' && !Number.isNaN(brandDiscount) && brandDiscount > 0;
    const isFlash =
      item.flash_price != null && item.flash_start_at && item.flash_end_at;

    // Brand-wide discount price (used only when not showing flash pricing)
    const discountedPrice = hasBrandDiscount
      ? Number((price * (1 - brandDiscount / 100)).toFixed(2))
      : null;

    let leftText = null;
    let countdownText = null;

    if (isFlash) {
      const endTs = item.flash_end_at ? new Date(item.flash_end_at).getTime() : 0;
      const remainingMs = Math.max(endTs - now, 0);
      const totalSeconds = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const sold = Number(item.flash_sold) || 0;
      const flashQty = item.flash_quantity;
      if (flashQty != null) {
        const left = Math.max(flashQty - sold, 0);
        leftText = `${left} / ${flashQty} left`;
      } else {
        leftText = `Sold: ${sold}`;
      }

      countdownText = `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardLeftRow}>
          <View style={styles.thumbnailWrapper}>
            <Image
              source={{ uri: item.image }}
              style={styles.thumbnail}
              contentFit="cover"
            />
            {/* {hasBrandDiscount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{Math.round(brandDiscount)}%</Text>
              </View>
            )} */}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {tab === 'flash' && isFlash ? (
              <View style={styles.priceRow}>
                <Text style={styles.cardPriceOriginal}>${price.toFixed(2)}</Text>
                <Text style={styles.cardPriceDiscount}>
                  ${Number(item.flash_price || 0).toFixed(2)}
                </Text>
              </View>
            ) : hasBrandDiscount && discountedPrice != null ? (
              <View style={styles.priceRow}>
                <Text style={styles.cardPriceOriginal}>${price.toFixed(2)}</Text>
                <Text style={styles.cardPriceDiscount}>${discountedPrice.toFixed(2)}</Text>
              </View>
            ) : (
              <Text style={styles.cardPrice}>${price.toFixed(2)}</Text>
            )}
            {qty != null && (
              <Text style={styles.cardStock}>
                {qty > 0 ? `${qty} in stock` : 'Out of stock'}
              </Text>
            )}
            {tab === 'flash' && isFlash && (
              <>
                {leftText && <Text style={styles.flashLeftText}>{leftText}</Text>}
                {countdownText && (
                  <Text style={styles.flashCountdownText}>{countdownText}</Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.cardActionsRow}>
          {tab === 'flash' && isFlash ? (
            <TouchableOpacity
              style={[styles.actionPill, styles.actionPillEndFlash]}
              onPress={() => {
                Alert.alert(
                  'End flash sale',
                  'Are you sure you want to end the flash sale for this product?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'End Flash',
                      style: 'destructive',
                      onPress: () => handleEndFlashSale(item.id),
                    },
                  ],
                );
              }}
            >
              <Text style={styles.actionPillEndFlashText}>End Flash</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillPrimary]}
                onPress={() => navigation.navigate('EditProduct', { product: item })}
              >
                <Text style={styles.actionPillPrimaryText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionPill}
                onPress={() => navigation.navigate('EditFlashSale', { product: item })}
              >
                <Text style={styles.actionPillText}>Make Flash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillDanger]}
                onPress={() => {
                  Alert.alert(
                    'Delete product',
                    'Are you sure you want to delete this product? This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => handleDeleteProduct(item.id),
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.actionPillDangerText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Products</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddProduct')}
        >
          <Text style={styles.addButtonIcon}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.discountActionsRow}>
        <TouchableOpacity
          style={styles.discountButton}
          onPress={() => navigation.navigate('BrandDiscount')}
        >
          <Text style={styles.discountButtonText}>Add Discount</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.discountButton, styles.discountRemoveButton]}
          onPress={() => navigation.navigate('BrandDiscount')}
        >
          <Text style={styles.discountRemoveButtonText}>Remove Discount</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.topTabsRow}>
        <TabButton id="active" label="Active" />
        <TabButton id="flash" label="Flash" />
        <TabButton id="out_of_stock" label="Out of Stock" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={currentList.length === 0 && styles.emptyContainer}
        showsVerticalScrollIndicator={false}
      >
        {currentList.length === 0 ? (
          <Text style={styles.emptyText}>{loading ? 'Loading products...' : 'No products to show.'}</Text>
        ) : (
          currentList.map(renderProductCard)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BrandProductsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#11126F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  topTabsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  topTabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  topTabButtonActive: {
    borderBottomColor: '#11126F',
  },
  topTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  topTabTextActive: {
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  discountActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  discountButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#eef2ff',
  },
  discountButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  discountRemoveButton: {
    backgroundColor: '#111827',
    marginRight: 0,
  },
  discountRemoveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  cardPrice: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#11126F',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cardPriceOriginal: {
    fontSize: 13,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  cardPriceDiscount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#16a34a',
  },
  cardStock: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  flashLeftText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  flashCountdownText: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginLeft: 8,
  },
  actionPillPrimary: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
  },
  actionPillDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  actionPillPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionPillDangerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
  },
  actionPillEndFlash: {
    borderColor: '#fed7aa',
    backgroundColor: '#fffbeb',
  },
  actionPillEndFlashText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
  },
});
