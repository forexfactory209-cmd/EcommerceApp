import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Modal, TextInput, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Swipeable } from 'react-native-gesture-handler';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import { QrCode, X, Search } from 'lucide-react-native';
import ProductQRCodeGenerator from '../components/ProductQRCodeGenerator';

const BrandProductsScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const deleteProduct = useStore((state) => state.deleteProduct);

  const [remoteProducts, setRemoteProducts] = useState([]);
  const [brandDiscount, setBrandDiscount] = useState(null);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [promoList, setPromoList] = useState([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [copiedPromoId, setCopiedPromoId] = useState(null);
  const [promoCodeText, setPromoCodeText] = useState('');
  const [promoAmountInput, setPromoAmountInput] = useState('');
  const [promoExpiryInput, setPromoExpiryInput] = useState(''); // YYYY-MM-DD
  const [creatingPromo, setCreatingPromo] = useState(false);

  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [discountTargetProduct, setDiscountTargetProduct] = useState(null);

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrTargetProduct, setQrTargetProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const loadProducts = useCallback(async () => {
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
        } else if (brandRow && typeof brandRow.discount_percentage === 'number') {
          setBrandDiscount(brandRow.discount_percentage);
        } else {
          setBrandDiscount(null);
        }
      } catch (e) {
        console.warn('BrandProducts: exception loading brand discount', e.message || e);
      }

      // Simple fetch of this brand's products, no pagination
      const { data: prodByOwner, error: prodOwnerError } = await supabase
        .from('products')
        .select('*')
        .eq('brand_user_id', authUserId)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false })
        .limit(100);

      if (prodOwnerError) {
        console.warn('BrandProducts: failed to load products', prodOwnerError.message || prodOwnerError);
      }

      const rows = Array.isArray(prodByOwner) ? prodByOwner : [];
      setRemoteProducts(rows);
    } catch (e) {
      console.warn('BrandProducts: unexpected error loading products', e.message || e);
    } finally {
      setLoading(false);
    }
  }, [authUserId]);

  const handleCreatePromoCode = useCallback(async () => {
    if (!authUserId) return;

    const codeRaw = (promoCodeText || '').trim();
    const amountRaw = (promoAmountInput || '').trim();
    const expiryRaw = (promoExpiryInput || '').trim();

    if (!codeRaw || !amountRaw) {
      return;
    }

    const discountValue = parseFloat(amountRaw.replace(/[^0-9.]/g, ''));
    if (!discountValue || discountValue <= 0 || discountValue >= 100) {
      Alert.alert('Invalid discount', 'Enter a percentage between 1 and 99.');
      return;
    }

    try {
      setCreatingPromo(true);

      const normalizedCode = codeRaw.toUpperCase();

      let expiresAt = null;
      if (expiryRaw) {
        // Expecting YYYY-MM-DD; let Supabase parse it
        expiresAt = expiryRaw;
      }

      const { error } = await supabase.from('promo_codes').insert([
        {
          code: normalizedCode,
          brand_user_id: authUserId,
          discount_percentage: discountValue,
          is_active: true,
          expires_at: expiresAt,
        },
      ]);

      if (error) {
        console.warn('BrandProducts: failed to create promo code', error.message || error);
        Alert.alert('Error', error.message || 'Could not create promo code.');
        return;
      }

      setPromoCodeText('');
      setPromoAmountInput('');
      setPromoExpiryInput('');

      // Refresh promo list
      await loadPromos();
    } catch (e) {
      console.warn('BrandProducts: unexpected error creating promo code', e.message || e);
      Alert.alert('Error', 'Something went wrong while creating this promo code.');
    } finally {
      setCreatingPromo(false);
    }
  }, [authUserId, promoCodeText, promoAmountInput, promoExpiryInput, loadPromos]);

  const handleDeactivatePromoCode = useCallback(async (promoId) => {
    if (!promoId) return;

    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: false })
        .eq('id', promoId);

      if (error) {
        console.warn('BrandProducts: failed to deactivate promo code', error.message || error);
        Alert.alert('Error', error.message || 'Could not deactivate this promo code.');
        return;
      }

      setPromoList((current) =>
        Array.isArray(current)
          ? current.map((p) => (p.id === promoId ? { ...p, is_active: false } : p))
          : current,
      );
    } catch (e) {
      console.warn('BrandProducts: exception deactivating promo code', e.message || e);
      Alert.alert('Error', 'Something went wrong while deactivating this promo code.');
    }
  }, []);

  const loadPromos = useCallback(async () => {
    if (!authUserId) {
      setPromoList([]);
      return;
    }

    try {
      setPromoLoading(true);
      const { data: promoRows, error: promoError } = await supabase
        .from('promo_codes')
        .select('id, code, discount_percentage, is_active, expires_at, created_at')
        .eq('brand_user_id', authUserId)
        .order('created_at', { ascending: false });

      if (promoError) {
        console.warn('BrandProducts: failed to load promo codes', promoError.message || promoError);
      } else if (Array.isArray(promoRows)) {
        setPromoList(promoRows);
      }
    } catch (e) {
      console.warn('BrandProducts: unexpected error loading promo codes', e.message || e);
    } finally {
      setPromoLoading(false);
    }
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      // Load coupons as well when first entering
      loadPromos();
    }, [loadProducts, loadPromos]),
  );

  useEffect(() => {
    if (tab === 'coupons') {
      loadPromos();
    }
  }, [tab, loadPromos]);

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

  const handleRemoveProductDiscount = async (productId) => {
    if (!productId) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          product_discount_percentage: null,
          product_discount_active: false,
        })
        .eq('id', productId);

      if (error) {
        console.warn('BrandProducts: failed to remove product discount', error.message || error);
        Alert.alert('Error', error.message || 'Could not remove discount for this product.');
        return;
      }

      setRemoteProducts((prev) =>
        Array.isArray(prev)
          ? prev.map((p) =>
            p.id === productId
              ? {
                ...p,
                product_discount_percentage: null,
                product_discount_active: false,
              }
              : p,
          )
          : prev,
      );
    } catch (e) {
      console.warn('BrandProducts: exception removing product discount', e.message || e);
      Alert.alert('Error', 'Something went wrong while removing this discount.');
    }
  };

  const openProductDiscountModal = (product) => {
    if (!product) return;
    setDiscountTargetProduct(product);
    const existing =
      typeof product.product_discount_percentage === 'number' && !Number.isNaN(product.product_discount_percentage)
        ? String(product.product_discount_percentage)
        : '';
    setDiscountInput(existing);
    setDiscountModalVisible(true);
  };

  const handleApplyProductDiscount = async () => {
    if (!discountTargetProduct?.id) return;

    const raw = String(discountInput || '').trim();
    const pct = Number(raw);

    if (!raw || Number.isNaN(pct) || pct <= 0 || pct >= 100) {
      Alert.alert('Invalid discount', 'Enter a percentage between 1 and 99.');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({
          product_discount_percentage: pct,
          product_discount_active: true,
        })
        .eq('id', discountTargetProduct.id);

      if (error) {
        console.warn('BrandProducts: failed to apply product discount', error.message || error);
        Alert.alert('Error', error.message || 'Could not apply discount to this product.');
        return;
      }

      setRemoteProducts((prev) =>
        Array.isArray(prev)
          ? prev.map((p) =>
            p.id === discountTargetProduct.id
              ? {
                ...p,
                product_discount_percentage: pct,
                product_discount_active: true,
              }
              : p,
          )
          : prev,
      );

      setDiscountModalVisible(false);
      setDiscountTargetProduct(null);
      setDiscountInput('');
    } catch (e) {
      console.warn('BrandProducts: exception applying product discount', e.message || e);
      Alert.alert('Error', 'Something went wrong while applying this discount.');
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

  const renderProductCard = (item) => {
    const price = Number(item.price || 0) || 0;
    const qty = item.quantity != null ? Number(item.quantity) : null;

    const hasBrandDiscount = typeof brandDiscount === 'number' && !Number.isNaN(brandDiscount) && brandDiscount > 0;
    const isFlash =
      item.flash_price != null && item.flash_start_at && item.flash_end_at;

    // Effective product discount: prefer per-product percentage, fallback to brandDiscount when applying
    const productLevelDiscount =
      typeof item.product_discount_percentage === 'number' && !Number.isNaN(item.product_discount_percentage)
        ? item.product_discount_percentage
        : null;

    const effectivePct = productLevelDiscount != null ? productLevelDiscount : brandDiscount;

    // Discounted price when a discount is active and we have a percentage
    let discountedPrice = null;
    if (typeof effectivePct === 'number' && !Number.isNaN(effectivePct)) {
      discountedPrice = Number((price * (1 - effectivePct / 100)).toFixed(2));
    }

    const isProductDiscounted = !!item.product_discount_active;

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
            ) : isProductDiscounted && discountedPrice != null ? (
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
          ) : tab === 'out_of_stock' ? (
            <>
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillPrimary]}
                onPress={() => navigation.navigate('EditProduct', { product: item })}
              >
                <Text style={styles.actionPillPrimaryText}>Edit</Text>
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
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillPrimary]}
                onPress={() => navigation.navigate('EditProduct', { product: item })}
              >
                <Text style={styles.actionPillPrimaryText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionPill, { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => {
                  setQrTargetProduct(item);
                  setQrModalVisible(true);
                }}
              >
                <QrCode size={12} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563EB' }}>QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillSecondary]}
                onPress={() => navigation.navigate('EditFlashSale', { product: item })}
              >
                <Text style={styles.actionPillSecondaryText}>Flash</Text>
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
              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillDiscount]}
                onPress={() => {
                  if (isProductDiscounted) {
                    Alert.alert('Remove discount', 'Remove discount from this product?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => handleRemoveProductDiscount(item.id) },
                    ]);
                  } else {
                    openProductDiscountModal(item);
                  }
                }}
              >
                <Text style={styles.actionPillDiscountText}>
                  {isProductDiscounted ? 'Remove' : 'Discount'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
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

  // Filter products based on search query and tab
  const currentList = (() => {
    // First get the products for the current tab
    let tabFiltered = tab === 'flash'
      ? segmented.flash
      : tab === 'out_of_stock'
        ? segmented.outOfStock
        : segmented.active;

    // Then apply search filter if there's a query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      return tabFiltered.filter(product => {
        const name = (product.name || '').toLowerCase();
        const brand = (product.brand || '').toLowerCase();
        const code = (product.code || '').toLowerCase();
        return name.includes(query) || brand.includes(query) || code.includes(query);
      });
    }

    return tabFiltered;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={discountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscountModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Product discount (%)</Text>
            <TextInput
              value={discountInput}
              onChangeText={setDiscountInput}
              keyboardType="numeric"
              placeholder="e.g. 10"
              style={styles.modalInput}
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setDiscountModalVisible(false);
                  setDiscountTargetProduct(null);
                  setDiscountInput('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonApply]}
                onPress={handleApplyProductDiscount}
              >
                <Text style={styles.modalButtonApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products by name, brand, or code..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <X size={18} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.topTabsRow}>
        <TabButton id="active" label="Active" />
        <TabButton id="flash" label="Flash" />
        <TabButton id="coupons" label="Coupons" />
        <TabButton id="out_of_stock" label="Out of Stock" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={tab === 'coupons' && styles.couponsContainer}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'coupons' ? (
          <View style={styles.couponsInnerWrapper}>
            <View style={styles.promoCardInlineForm}>
              <Text style={styles.promoTitle}>Create Promo Code</Text>
              <Text style={styles.promoSubtitle}>
                Share codes with your customers. They will be valid only for orders from your brand.
              </Text>
              <View style={styles.promoInputsRow}>
                <TextInput
                  style={styles.promoCodeInput}
                  placeholder="CODE"
                  autoCapitalize="characters"
                  value={promoCodeText}
                  onChangeText={setPromoCodeText}
                />
                <TextInput
                  style={styles.promoAmountInput}
                  placeholder="% off (e.g. 10)"
                  keyboardType="numeric"
                  value={promoAmountInput}
                  onChangeText={setPromoAmountInput}
                />
              </View>
              <TextInput
                style={styles.promoExpiryInput}
                placeholder="Expiry date (DD-MM-YYYY)"
                value={promoExpiryInput}
                onChangeText={setPromoExpiryInput}
              />
              <TouchableOpacity
                style={styles.promoCreateButton}
                onPress={handleCreatePromoCode}
                disabled={creatingPromo}
              >
                <Text style={styles.promoCreateButtonText}>
                  {creatingPromo ? 'Creating...' : 'Generate Promo Code'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.promoListCardInline}>
              <Text style={styles.promoListTitle}>My Promo Codes</Text>
              {promoLoading && <Text style={styles.promoListHelper}>Loading promo codes...</Text>}
              {!promoLoading && (!promoList || promoList.length === 0) && (
                <Text style={styles.promoListHelper}>You have not created any promo codes yet.</Text>
              )}
              {!promoLoading && Array.isArray(promoList) && promoList.length > 0 && (
                <View style={styles.promoListItems}>
                  {promoList.map((promo) => {
                    const isActive = promo.is_active;
                    const amount = Number(promo.discount_percentage) || 0;
                    let expiryLabel = 'No expiry';
                    if (promo.expires_at) {
                      try {
                        const d = new Date(promo.expires_at);
                        if (!Number.isNaN(d.getTime())) {
                          expiryLabel = d.toLocaleDateString();
                        }
                      } catch { }
                    }

                    return (
                      <View key={promo.id} style={styles.promoListItemRow}>
                        <View style={styles.promoListItemLeft}>
                          <Text style={styles.promoListCode}>{promo.code}</Text>
                          <Text style={styles.promoListMeta}>
                            {amount.toFixed(0)}% off · Expires: {expiryLabel}
                          </Text>
                        </View>
                        <View style={styles.promoListItemRight}>
                          <Text style={isActive ? styles.promoStatusActive : styles.promoStatusInactive}>
                            {isActive ? 'Active' : 'Inactive'}
                          </Text>
                          <View style={styles.promoListActionsRow}>
                            <TouchableOpacity
                              style={styles.promoCopyButton}
                              onPress={() => {
                                if (!promo.code) return;
                                try {
                                  Clipboard.setString(promo.code);
                                  setCopiedPromoId(promo.id);
                                  setTimeout(() => {
                                    setCopiedPromoId((current) => (current === promo.id ? null : current));
                                  }, 1500);
                                } catch (e) {
                                  console.warn('BrandProducts: failed to copy promo code', e.message || e);
                                }
                              }}
                            >
                              <Text style={styles.promoCopyButtonText}>
                                {copiedPromoId === promo.id ? 'Copied' : 'Copy'}
                              </Text>
                            </TouchableOpacity>
                            {isActive && (
                              <TouchableOpacity
                                style={styles.promoDeactivateButton}
                                onPress={() => handleDeactivatePromoCode(promo.id)}
                              >
                                <Text style={styles.promoDeactivateButtonText}>Deactivate</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        ) : currentList.length === 0 ? (
          <Text style={styles.emptyText}>{loading ? 'Loading products...' : 'No products to show.'}</Text>
        ) : (
          currentList.map(renderProductCard)
        )}
      </ScrollView>
      <Modal
        visible={qrModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%', padding: 0, overflow: 'hidden' }]}>
            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#f3f4f6',
              backgroundColor: '#ffffff'
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }} numberOfLines={1}>
                {qrTargetProduct?.name || 'Product'} QR Code
              </Text>
              <TouchableOpacity
                style={{ padding: 8, backgroundColor: '#f3f4f6', borderRadius: 999, marginLeft: 12 }}
                onPress={() => setQrModalVisible(false)}
              >
                <X size={20} color="#4b5563" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              <Text style={{ textAlign: 'center', marginBottom: 20, color: '#6b7280', fontSize: 14, lineHeight: 20 }}>
                Scan this code during checkout to quickly find the product and deduct stock.
              </Text>

              {qrTargetProduct && (
                <ProductQRCodeGenerator
                  productId={qrTargetProduct.id}
                  productName={qrTargetProduct.name}
                />
              )}

              <TouchableOpacity
                style={{
                  marginTop: 16,
                  paddingVertical: 14,
                  backgroundColor: '#f3f4f6',
                  borderRadius: 12,
                  alignItems: 'center',
                  marginBottom: 20 // Extra bottom padding for scroll
                }}
                onPress={() => setQrModalVisible(false)}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
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
  couponsContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingVertical: 16,
  },
  couponsInnerWrapper: {
    gap: 12,
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
  loadMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#11126F',
    backgroundColor: '#ffffff',
  },
  loadMoreButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#11126F',
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
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  swipeActionButton: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  swipeActionPrimary: {
    backgroundColor: '#11126F',
  },
  swipeActionSecondary: {
    backgroundColor: '#374151',
  },
  swipeActionDanger: {
    backgroundColor: '#dc2626',
  },
  swipeActionDiscount: {
    backgroundColor: '#16a34a',
  },
  swipeActionEndFlash: {
    backgroundColor: '#111827',
  },
  swipeActionTextOnDark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 14,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginLeft: 10,
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonApply: {
    backgroundColor: '#11126F',
  },
  modalButtonCancelText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  modalButtonApplyText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  // Create promo form styling (top of Coupons tab)
  promoCardInlineForm: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'left',
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
  },
  promoInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  promoCodeInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginRight: 8,
  },
  promoAmountInput: {
    width: 110,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  promoExpiryInput: {
    marginTop: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  promoCreateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  promoCreateButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Inline promo / coupon list styling (aligned with PromoCodesScreen)
  promoListCardInline: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  promoListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  promoListHelper: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  promoListItems: {
    marginTop: 6,
  },
  promoListItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  promoListItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  promoListItemRight: {
    alignItems: 'flex-end',
  },
  promoListCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  promoListMeta: {
    fontSize: 11,
    color: '#6b7280',
  },
  promoStatusActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 4,
  },
  promoStatusInactive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 4,
  },
  promoListActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoCopyButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  promoCopyButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  promoDeactivateButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#111827',
    marginLeft: 6,
  },
  promoDeactivateButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
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
  actionPillSecondary: {
    backgroundColor: '#374151',
    borderColor: '#374151',
  },
  actionPillSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionPillDiscount: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  actionPillDiscountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
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
