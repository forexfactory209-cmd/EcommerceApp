import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import { sendDiscountToFollowers } from '../services/notifications';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';

const VendorScreen = ({ navigation, route }) => {
  const [tab] = useState('orders');
  const { orders, deleteProduct, updateOrderStatus, authUserId, setOrders } = useStore();
  const deletedProductIds = useStore((state) => state.deletedProductIds || []);

  const [remoteProducts, setRemoteProducts] = useState([]);
  const [discountInput, setDiscountInput] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [brandMeta, setBrandMeta] = useState({ id: null, name: null });

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        if (!authUserId) return;

        try {
          // First, get this vendor's approved brand name and any saved discount (if any)
          let brandName = null;
          let brandIdForVendor = null;
          try {
            const { data: brandRow, error: brandError } = await supabase
              .from('brands')
              .select('id, name, discount_percentage')
              .eq('user_id', authUserId)
              .maybeSingle();

            if (brandError && brandError.code !== 'PGRST116') {
              console.warn('Error loading vendor brand row:', brandError.message || brandError);
            } else if (brandRow) {
              if (brandRow.name) {
                brandName = brandRow.name;
              }
              if (brandRow.id) {
                brandIdForVendor = brandRow.id;
              }
              if (typeof brandRow.discount_percentage === 'number' && !Number.isNaN(brandRow.discount_percentage)) {
                setDiscountInput(String(brandRow.discount_percentage));
              }
            }
          } catch (e) {
            console.warn('Error loading vendor brand info:', e.message || e);
          }

          // Load this brand's products by owner id
          const { data: prodByOwner, error: prodOwnerError } = await supabase
            .from('products')
            .select('*')
            .eq('brand_user_id', authUserId)
            .or('is_deleted.is.null,is_deleted.eq.false');

          if (prodOwnerError) {
            console.warn('Error loading vendor products by owner:', prodOwnerError.message || prodOwnerError);
          }

          let combined = Array.isArray(prodByOwner) ? prodByOwner : [];

          // Also load products that match this brand's name, for legacy rows without brand_user_id
          if (brandName) {
            try {
              const { data: prodByName, error: prodNameError } = await supabase
                .from('products')
                .select('*')
                .eq('brand', brandName)
                .or('is_deleted.is.null,is_deleted.eq.false');

              if (prodNameError) {
                console.warn('Error loading vendor products by name:', prodNameError.message || prodNameError);
              } else if (Array.isArray(prodByName) && prodByName.length > 0) {
                const existingIds = new Set(combined.map((p) => p.id));
                const onlyNew = prodByName.filter((p) => !existingIds.has(p.id));
                combined = [...combined, ...onlyNew];
              }
            } catch (e) {
              console.warn('Error loading vendor products by brand name:', e.message || e);
            }
          }

          if (isActive) {
            setRemoteProducts(combined);
          }

          // Load this brand's orders from Supabase and sync to store
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('brand_user_id', authUserId)
            .order('placed_at', { ascending: false });

          if (orderError) {
            console.warn('Error loading vendor orders:', orderError.message);
          } else if (isActive) {
            const mapped = (orderData || []).map((row) => ({
              id: row.id,
              items: Array.isArray(row.items) ? row.items : [],
              subtotal: Number(row.subtotal) || 0,
              shipping: Number(row.shipping) || 0,
              total: Number(row.total) || 0,
              status: row.status || 'Pending',
              date: row.placed_at
                ? new Date(row.placed_at).toLocaleDateString()
                : '',
              brand_user_id: row.brand_user_id,
              payment_method: row.payment_method || 'cash_on_delivery',
              delivery_address: row.delivery_address || '',
              promo_code: row.promo_code || null,
              customer_name: row.customer_name || null,
              customer_phone: row.customer_phone || null,
              customer_secondary_phone: row.customer_secondary_phone || null,
            }));
            setOrders(mapped);
          }
        } catch (e) {
          console.warn('Error loading vendor data:', e);
        }
      };

      loadData();

      return () => {
        isActive = false;
      };
    }, [authUserId, setOrders]),
  );

  const myOrders = Array.isArray(orders)
    ? orders.filter((o) => !authUserId || o.brand_user_id === authUserId)
    : [];

  const COMMISSION_RATE = 0.15;

  const grossRevenue = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const commissionAmount = grossRevenue * COMMISSION_RATE;
  const netRevenue = grossRevenue - commissionAmount;
  const deliveredOrdersCount = myOrders.filter((o) => o.status === 'Delivered').length;
  const pendingOrdersCount = myOrders.length - deliveredOrdersCount;

  const handleApplyDiscount = async () => {
    if (!authUserId) return;

    const trimmed = (discountInput || '').toString().trim();
    const value = parseFloat(trimmed.replace('%', ''));
    if (!trimmed || isNaN(value) || value <= 0 || value >= 100) {
      return;
    }

    try {
      setApplyingDiscount(true);
      const factor = 1 - value / 100;

      const productsForBrand = Array.isArray(remoteProducts)
        ? remoteProducts.filter((p) => p.brand_user_id === authUserId)
        : [];

      for (const prod of productsForBrand) {
        const currentPrice = Number(prod.price) || 0;
        const newPrice = Number((currentPrice * factor).toFixed(2));

        try {
          const { error } = await supabase
            .from('products')
            .update({ price: newPrice })
            .eq('id', prod.id);

          if (error) {
            console.warn('Vendor discount: failed to update product price', error.message || error);
          }
        } catch (e) {
          console.warn('Vendor discount: exception updating product price', e.message || e);
        }
      }

      // Refresh products after applying discount
      try {
        const { data: refreshed, error: refreshError } = await supabase
          .from('products')
          .select('*')
          .eq('brand_user_id', authUserId);

        if (refreshError) {
          console.warn('Vendor discount: failed to reload products', refreshError.message || refreshError);
        } else if (Array.isArray(refreshed)) {
          setRemoteProducts(refreshed);
        }
      } catch (e) {
        console.warn('Vendor discount: exception reloading products', e.message || e);
      }

      // Persist discount percentage on the brand so it survives navigation
      try {
        const { error: brandDiscountError } = await supabase
          .from('brands')
          .update({ discount_percentage: value })
          .eq('user_id', authUserId);

        if (brandDiscountError) {
          console.warn('Vendor discount: failed to persist brand discount', brandDiscountError.message || brandDiscountError);
        }
      } catch (e) {
        console.warn('Vendor discount: exception persisting brand discount', e.message || e);
      }

      // Notify followers (and the brand owner) about the new discount using shared helper
      try {
        let brandIdForNotif = brandMeta?.id || null;
        let brandNameForNotif = brandMeta?.name || null;

        if (!brandIdForNotif && authUserId) {
          try {
            const { data: brandRow, error: brandError } = await supabase
              .from('brands')
              .select('id, name')
              .eq('user_id', authUserId)
              .maybeSingle();

            if (!brandError && brandRow) {
              brandIdForNotif = brandRow.id || brandIdForNotif;
              brandNameForNotif = brandRow.name || brandNameForNotif;
            } else if (brandError) {
              console.warn('Vendor discount: could not refetch brand for notification', brandError.message || brandError);
            }
          } catch (inner) {
            console.warn('Vendor discount: exception refetching brand for notification', inner.message || inner);
          }
        }

        if (brandIdForNotif) {
          await sendDiscountToFollowers(brandIdForNotif, brandNameForNotif, value);
        } else {
          console.warn('Vendor discount: no brand id available for discount notification');
        }
      } catch (e) {
        console.warn('Vendor discount: exception sending discount notification to followers', e.message || e);
      }

      setShowDiscountInput(false);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleRemoveDiscount = async () => {
    if (!authUserId) return;

    const trimmed = (discountInput || '').toString().trim();
    const value = parseFloat(trimmed.replace('%', ''));
    if (!trimmed || isNaN(value) || value <= 0 || value >= 100) {
      return;
    }

    try {
      setApplyingDiscount(true);
      const factor = 1 - value / 100;
      if (factor <= 0) return;

      const productsForBrand = Array.isArray(remoteProducts)
        ? remoteProducts.filter((p) => p.brand_user_id === authUserId)
        : [];

      for (const prod of productsForBrand) {
        const currentPrice = Number(prod.price) || 0;
        const newPrice = Number((currentPrice / factor).toFixed(2));

        try {
          const { error } = await supabase
            .from('products')
            .update({ price: newPrice })
            .eq('id', prod.id);

          if (error) {
            console.warn('Vendor discount: failed to restore product price', error.message || error);
          }
        } catch (e) {
          console.warn('Vendor discount: exception restoring product price', e.message || e);
        }
      }

      // Refresh products after removing discount
      try {
        const { data: refreshed, error: refreshError } = await supabase
          .from('products')
          .select('*')
          .eq('brand_user_id', authUserId);

        if (refreshError) {
          console.warn('Vendor discount: failed to reload products', refreshError.message || refreshError);
        } else if (Array.isArray(refreshed)) {
          setRemoteProducts(refreshed);
        }
      } catch (e) {
        console.warn('Vendor discount: exception reloading products after remove', e.message || e);
      }

      // Clear saved discount percentage on the brand
      try {
        const { error: brandDiscountError } = await supabase
          .from('brands')
          .update({ discount_percentage: null })
          .eq('user_id', authUserId);

        if (brandDiscountError) {
          console.warn('Vendor discount: failed to clear brand discount', brandDiscountError.message || brandDiscountError);
        }
      } catch (e) {
        console.warn('Vendor discount: exception clearing brand discount', e.message || e);
      }

      setShowDiscountInput(false);
      setDiscountInput('');
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus, extraFields = {}) => {
    if (!orderId || !newStatus) return;

    // Optimistic UI update for local store
    updateOrderStatus(orderId, newStatus);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, ...extraFields })
        .eq('id', orderId);

      if (error) {
        console.warn('Vendor: failed to update order status in Supabase:', error.message || error);
      }
    } catch (e) {
      console.warn('Vendor: exception while updating order status in Supabase:', e.message || e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Vendor Dashboard</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddProduct')}
          style={styles.addButton}
        >
          <Plus color="white" size={24} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statLabel}>Total Orders</Text>
          <Text style={styles.statValue}>{myOrders.length}</Text>
          <Text style={styles.statSubValue}>
            {deliveredOrdersCount} delivered · {pendingOrdersCount} pending
          </Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statLabel}>Net Earnings</Text>
          <Text style={styles.statValue}>
            ${netRevenue.toFixed(0)}
          </Text>
          <Text style={styles.statSubValue}>After 15% platform commission</Text>
        </View>
        <View style={[styles.statCard, styles.statCardPurple]}>
          <Text style={styles.statLabel}>Our Commission</Text>
          <Text style={styles.statValue}>${commissionAmount.toFixed(0)}</Text>
          <Text style={styles.statSubValue}>15% of gross sales (${grossRevenue.toFixed(0)})</Text>
        </View>
      </View>

      {/* Discount controls under stats */}
      <View style={styles.discountActionsRow}>
        <TouchableOpacity
          style={styles.discountTabButton}
          onPress={() => setShowDiscountInput((prev) => !prev)}
          disabled={applyingDiscount}
        >
          <Text style={styles.discountTabText}>Set Discount</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.discountTabButton, styles.discountRemoveTabButton]}
          onPress={handleRemoveDiscount}
          disabled={applyingDiscount}
        >
          <Text style={styles.discountRemoveTabText}>Remove Discount</Text>
        </TouchableOpacity>
      </View>

      {showDiscountInput && (
        <View style={styles.discountCard}>
          <Text style={styles.discountLabel}>Discount (%) to apply or remove</Text>
          <TextInput
            style={styles.discountInput}
            placeholder="e.g. 10 for 10%"
            keyboardType="numeric"
            value={discountInput}
            onChangeText={setDiscountInput}
          />
          <View style={styles.discountActionsRow}>
            <TouchableOpacity
              style={[styles.discountButton, styles.discountButtonSecondary]}
              onPress={() => {
                setShowDiscountInput(false);
                setDiscountInput('');
              }}
              disabled={applyingDiscount}
            >
              <Text style={styles.discountButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.discountButton, styles.discountButtonPrimary]}
              onPress={handleApplyDiscount}
              disabled={applyingDiscount}
            >
              <Text style={styles.discountButtonPrimaryText}>
                {applyingDiscount ? 'Applying...' : 'Apply Discount'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.manageWrapper}>
        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => navigation.navigate('VendorOrders')}
        >
          <Text style={styles.manageButtonText}>Manage Products & Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default VendorScreen;

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
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  discountTabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#b9ffc6ff',
  },
  discountRemoveTabButton: {
    backgroundColor: '#111827',
    marginRight: 0,
  },
  discountTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  discountRemoveTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  manageWrapper: {
    marginTop: 8,
    marginBottom: 16,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#11126F',
    shadowColor: '#11126F',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  discountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  discountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  discountInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  discountActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  discountButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 8,
  },
  discountButtonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  discountButtonPrimary: {
    backgroundColor: '#111827',
  },
  discountButtonSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  discountButtonPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 17,
  },
  statCardBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statCardGreen: {
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
  },
  statCardPurple: {
    backgroundColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  statSubValue: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    padding: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: '#111827',
  },
  tabButtonInactive: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabButtonText: {
    fontWeight: '700',
    color: '#6b7280',
  },
  tabButtonTextActive: {
    fontWeight: '700',
    color: '#ffffff',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontWeight: '700',
    color: '#111827',
  },
  productMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  productPriceRow: {
    marginTop: 2,
  },
  productPriceOriginal: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  productPriceDiscount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#16a34a',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 32,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  orderMeta: {
    marginTop: 4,
    color: '#6b7280',
  },
  orderPromoMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#4b5563',
  },
  orderPromoCode: {
    fontWeight: '700',
    color: '#111827',
  },
  orderItemsList: {
    marginTop: 8,
  },
  orderItemLine: {
    fontSize: 13,
    color: '#4b5563',
  },
  orderItemMore: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  orderExtraRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  orderExtraLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 4,
  },
  orderExtraValue: {
    fontSize: 13,
    color: '#111827',
  },
  orderExtraAddress: {
    marginTop: 4,
  },
  orderExtraAddressText: {
    fontSize: 12,
    color: '#4b5563',
  },
  orderMetaBold: {
    fontWeight: '700',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 14,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0edff',
  },
  statusBadge: {
    marginLeft: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadgePending: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeAccepted: {
    backgroundColor: '#e0f2fe',
  },
  statusBadgeOnTheWay: {
    backgroundColor: '#dcfce7',
  },
  statusBadgeDelivered: {
    backgroundColor: '#bbf7d0',
  },
  statusActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryStatusButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  primaryStatusButtonWide: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  primaryStatusButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryStatusButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  secondaryStatusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
  },
});
