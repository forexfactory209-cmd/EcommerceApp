import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const MOCK_PAYOUT_METHODS = [
  { id: 'zaad', name: 'Zaad', description: 'Linked · 063‑****', color: '#e0f2fe' },
  { id: 'edahab', name: 'Edahab', description: 'Linked · 065‑****', color: '#fef3c7' },
];

const BrandWalletScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const payoutMethods = useStore((state) => state.payoutMethods || []);

  const [wallet, setWallet] = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [timeFilter, setTimeFilter] = useState('all'); // all | yesterday | today | tomorrow | weekly | monthly
  const [salesStatusFilter, setSalesStatusFilter] = useState('all'); // all | pending | completed
  const [gatewayFilter, setGatewayFilter] = useState('all'); // all | zaad | edahab | cash

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadWallet = async () => {
        if (!authUserId) return;

        try {
          // Phase 1: wallet not fully set up yet – derive sales history directly from orders
          // Load wallet balance if it exists (optional)
          try {
            const { data: walletRow, error: walletError } = await supabase
              .from('wallets')
              .select('id, balance, currency')
              .eq('brand_user_id', authUserId)
              .maybeSingle();

            if (walletError) {
              console.warn('BrandWallet: failed to load wallet', walletError.message || walletError);
            } else if (isActive) {
              setWallet(walletRow || null);
            }
          } catch (walletErr) {
            console.warn('BrandWallet: wallet query error', walletErr.message || walletErr);
          }

          // Always build Sales History from order_items + orders for this brand.
          // We load products in a second query keyed by product_id (no DB relationship required).
          try {
            const { data: orderItems, error: ordersError } = await supabase
              .from('order_items')
              .select(
                `id, product_id, name, image_url, delivery_type, quantity, unit_price, created_at,
                 orders:orders ( id, status, placed_at, payment_method )`,
              )
              .eq('brand_user_id', authUserId)
              .order('created_at', { ascending: false })
              .limit(20);

            if (ordersError) {
              console.warn('BrandWallet: orders load failed', ordersError.message || ordersError);
              if (isActive) setRecentTx([]);
            } else if (isActive) {
              const items = orderItems || [];

              // Load related products in a separate query
              const productIds = [
                ...new Set(
                  items
                    .map((row) => row.product_id)
                    .filter((id) => typeof id === 'number' || typeof id === 'string'),
                ),
              ];

              let productMap = new Map();
              if (productIds.length > 0) {
                try {
                  const { data: products, error: productsError } = await supabase
                    .from('products')
                    .select('id, price, flash_price')
                    .in('id', productIds);

                  if (productsError) {
                    console.warn('BrandWallet: products load failed', productsError.message || productsError);
                  } else if (Array.isArray(products)) {
                    productMap = new Map(products.map((p) => [p.id, p]));
                  }
                } catch (prodErr) {
                  console.warn('BrandWallet: products query error', prodErr.message || prodErr);
                }
              }

              const mapped = items.map((row) => {
                const o = row.orders || {};
                const p = productMap.get(row.product_id) || {};
                const unit = Number(row.unit_price || 0);
                const gross = unit * Number(row.quantity || 1);
                const originalPrice = p.price != null ? Number(p.price) : null;
                const flashPrice = p.flash_price != null ? Number(p.flash_price) : null;

                let saleType = null; // 'flash' | 'discount' | null
                if (flashPrice != null && unit === flashPrice) {
                  saleType = 'flash';
                } else if (originalPrice != null && unit < originalPrice) {
                  saleType = 'discount';
                }

                // Derive a readable order status label and bucket (pending/completed)
                const rawOrderStatus = (o.status || '').toLowerCase();
                let orderStatusLabel = 'New';
                let orderStatusBucket = 'pending';

                if (rawOrderStatus.includes('deliver') || rawOrderStatus.includes('complete')) {
                  orderStatusLabel = 'Delivered';
                  orderStatusBucket = 'completed';
                } else if (rawOrderStatus.includes('ship') || rawOrderStatus.includes('way')) {
                  // Treat shipped / on-the-way as the same bucket but label as "On the way"
                  orderStatusLabel = 'On the way';
                  orderStatusBucket = 'pending';
                } else if (
                  rawOrderStatus.includes('pack') ||
                  rawOrderStatus.includes('accept') ||
                  rawOrderStatus.includes('process')
                ) {
                  orderStatusLabel = 'Packing';
                  orderStatusBucket = 'pending';
                } else if (rawOrderStatus.includes('new') || rawOrderStatus.includes('pending')) {
                  orderStatusLabel = 'New';
                  orderStatusBucket = 'pending';
                }

                return {
                  id: row.id,
                  amount: gross,
                  type: 'credit',
                  description: row.name || `Order ${o.id || ''}`.trim(),
                  created_at: row.created_at || o.placed_at,
                  product_name: row.name || null,
                  image_url: row.image_url || null,
                  delivery_type: row.delivery_type || null,
                  unit_price: unit,
                  original_price: originalPrice,
                  flash_price: flashPrice,
                  sale_type: saleType,
                  order_status_label: orderStatusLabel,
                  order_status_bucket: orderStatusBucket,
                  payments: {
                    method: o.payment_method || 'cash',
                    provider: o.payment_method || 'cash',
                    status: o.status || 'paid',
                    order_id: o.id,
                  },
                };
              });

              setRecentTx(mapped);
            }
          } catch (e) {
            console.warn('BrandWallet: error loading orders for sales history', e.message || e);
            if (isActive) setRecentTx([]);
          }
        } catch (e) {
          console.warn('BrandWallet: error loading wallet data', e.message || e);
        }
      };

      loadWallet();

      return () => {
        isActive = false;
      };
    }, [authUserId]),
  );

  const available = wallet?.balance ?? 0;

  // Totals respect the current time filter, list itself shows all orders
  const totals = (recentTx || []).reduce((acc, tx) => {
    const created = tx.created_at ? new Date(tx.created_at) : null;
    if (!created) return acc;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfToday.getDate() + 1);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
    const startOfMonth = new Date(startOfToday.getFullYear(), now.getMonth(), 1);

    // When timeFilter === 'all', do not filter by date at all
    if (timeFilter === 'today' && !(created >= startOfToday && created < startOfTomorrow)) {
      return acc;
    }
    if (timeFilter === 'yesterday' && !(created >= startOfYesterday && created < startOfToday)) {
      return acc;
    }
    if (timeFilter === 'tomorrow') {
      const startOfDay = new Date(startOfTomorrow);
      const endOfDay = new Date(startOfTomorrow);
      endOfDay.setDate(startOfTomorrow.getDate() + 1);
      if (!(created >= startOfDay && created < endOfDay)) return acc;
    }
    if (timeFilter === 'weekly' && !(created >= startOfWeek)) {
      return acc;
    }
    if (timeFilter === 'monthly' && !(created >= startOfMonth)) {
      return acc;
    }

    const amt = Number(tx.amount || 0);
    if (tx.type === 'debit') {
      acc.payouts += Math.abs(amt);
    } else {
      acc.received += Math.max(amt, 0);
    }
    return acc;
  }, { received: 0, payouts: 0 });

  const pending = 0;
  const totalReceived = totals.received;
  const totalPayouts = totals.payouts;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        {/* <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity> */}
        <Text style={styles.headerTitle}>Seller Wallet</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>${Number(available).toFixed(2)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Pending</Text>
              <Text style={styles.balancePillValue}>${Number(pending).toFixed(2)}</Text>
            </View>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Received</Text>
              <Text style={styles.balancePillValue}>${Number(totalReceived).toFixed(2)}</Text>
            </View>
            <View style={styles.balancePill}>
              <Text style={styles.balancePillLabel}>Payouts</Text>
              <Text style={styles.balancePillValue}>${Number(totalPayouts).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.filtersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'today', label: 'Today' },
              { id: 'tomorrow', label: 'Tomorrow' },
              { id: 'weekly', label: 'Weekly' },
              { id: 'monthly', label: 'Monthly' },
            ].map((f) => {
              const active = timeFilter === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setTimeFilter(f.id)}
                  activeOpacity={0.9}
                >
                  <Text style={active ? styles.filterChipTextActive : styles.filterChipText}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Payout Methods</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ManagePayouts')}>
            <Text style={styles.sectionManageText}>MANAGE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.payoutRow}>
          {(payoutMethods && payoutMethods.length > 0
            ? payoutMethods
            : [
              { id: 'zaad', label: 'Zaad Service', phoneNumber: '063-XXXX-XXX' },
              { id: 'edahab', label: 'Edahab Service', phoneNumber: '065-XXXX-XXX' },
            ]
          ).map((m) => {
            const providerId = m.provider || m.id;
            const isZaad = providerId === 'zaad';
            return (
              <View
                key={m.id}
                style={[
                  styles.payoutCard,
                  isZaad ? styles.payoutCardZaad : styles.payoutCardEdahab,
                ]}
              >
                <Text style={styles.payoutName}>{m.label}</Text>
                <Text style={styles.payoutDescription}>
                  Linked · {m.phoneNumber || 'Unknown'}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Sales History</Text>
          <TouchableOpacity onPress={() => navigation.navigate('BrandTransactions')}>
            <Text style={styles.sectionSeeAllText}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.salesTabsRow}>
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'pending', label: 'Pending' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => {
            const active = salesStatusFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.salesTab, active && styles.salesTabActive]}
                onPress={() => setSalesStatusFilter(tab.id)}
              >
                <Text style={active ? styles.salesTabTextActive : styles.salesTabText}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.gatewayChipsRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'zaad', label: 'Zaad' },
            { id: 'edahab', label: 'Edahab' },
            { id: 'cash', label: 'Cash' },
          ].map((chip) => {
            const active = gatewayFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.gatewayChip, active && styles.gatewayChipActive]}
                onPress={() => setGatewayFilter(chip.id)}
              >
                <Text style={active ? styles.gatewayChipTextActive : styles.gatewayChipText}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {recentTx
          .filter((tx) => {
            const payment = tx.payments || {};
            const method = (payment.method || payment.provider || '').toLowerCase();
            const bucket = tx.order_status_bucket || 'pending';

            if (salesStatusFilter === 'pending' && bucket !== 'pending') return false;
            if (salesStatusFilter === 'completed' && bucket !== 'completed') return false;

            if (gatewayFilter === 'zaad' && !method.includes('zaad')) return false;
            if (gatewayFilter === 'edahab' && !method.includes('edahab')) return false;
            if (gatewayFilter === 'cash' && !method.includes('cash')) return false;

            return true;
          })
          .slice(0, 5)
          .map((tx) => {
            const payment = tx.payments || {};
            const method = payment.method || payment.provider || 'Wallet';
            const created = tx.created_at ? new Date(tx.created_at) : null;
            const meta = created
              ? created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '';

            const orderLabel = payment.order_id ? `Order #${payment.order_id}` : '';
            const title = tx.product_name || tx.description || orderLabel || 'Order';
            const delivery = tx.delivery_type ? tx.delivery_type : null;
            const orderStatusLabel = tx.order_status_label || null;
            const bucket = tx.order_status_bucket || 'pending';
            const subtitleParts = [];
            if (delivery) subtitleParts.push(delivery);
            if (method) subtitleParts.push(method);
            const subtitle = subtitleParts.join(' \u2022 ');

            return (
              <View key={tx.id} style={styles.txCard}>
                <View style={styles.txLeft}>
                  {tx.image_url ? (
                    <Image
                      source={{ uri: tx.image_url }}
                      style={styles.txThumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.txThumbnail} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {title || 'Wallet transaction'}
                    </Text>
                    {subtitle ? (
                      <Text style={styles.txSubtitle} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                    {orderStatusLabel ? (
                      <View
                        style={[
                          styles.orderStatusPill,
                          bucket === 'completed'
                            ? styles.orderStatusPillCompleted
                            : styles.orderStatusPillPending,
                        ]}
                      >
                        <Text style={styles.orderStatusPillText}>{orderStatusLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.txRight}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.txAmount}>${Number(tx.amount || 0).toFixed(2)}</Text>
                    {tx.sale_type && (
                      <View
                        style={[
                          styles.saleBadge,
                          tx.sale_type === 'flash' ? styles.saleBadgeFlash : styles.saleBadgeDiscount,
                        ]}
                      >
                        <Text style={styles.saleBadgeText}>
                          {tx.sale_type === 'flash' ? 'Flash sale' : 'Discount'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {tx.original_price && tx.unit_price && tx.original_price > tx.unit_price ? (
                    <Text style={styles.txMeta}>
                      ${tx.unit_price.toFixed(2)} · was ${tx.original_price.toFixed(2)}
                    </Text>
                  ) : (
                    meta ? <Text style={styles.txMeta}>{meta}</Text> : null
                  )}
                </View>
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BrandWalletScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 22,
    paddingVertical: 2,
    marginLeft: 7,
    fontWeight: '700',
    color: '#111827',
  },
  balanceCard: {
    backgroundColor: '#11126F',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  balanceLabel: {
    color: '#cbd5f5',
    fontSize: 13,
    marginBottom: 4,
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balancePill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.7)',
    marginRight: 8,
  },
  balancePillLabel: {
    color: '#e5e7eb',
    fontSize: 11,
  },
  balancePillValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  filtersRow: {
    marginBottom: 16,
  },
  filtersContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  filterChipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  filterChipTextActive: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionManageText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1,
  },
  sectionSeeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  payoutRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  payoutCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
  },
  payoutName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  payoutDescription: {
    fontSize: 12,
    color: '#4b5563',
  },
  salesTabsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  salesTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
  },
  salesTabActive: {
    backgroundColor: '#11126F',
  },
  salesTabText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  salesTabTextActive: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  gatewayChipsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  gatewayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    backgroundColor: '#ffffff',
  },
  gatewayChipActive: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
  },
  gatewayChipText: {
    fontSize: 12,
    color: '#4b5563',
  },
  gatewayChipTextActive: {
    fontSize: 12,
    color: '#ffffff',
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  txThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginRight: 10,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  txSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  txMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});

