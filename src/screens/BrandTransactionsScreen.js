import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Download } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const BrandTransactionsScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);

  const [transactions, setTransactions] = useState([]);
  const [timeFilter, setTimeFilter] = useState('today');
  const [gatewayFilter, setGatewayFilter] = useState('all');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadTransactions = async () => {
        if (!authUserId) return;

        try {
          // Phase 1: build transaction history directly from brand orders (order_items + orders)
          const { data: orderItems, error: ordersError } = await supabase
            .from('order_items')
            .select(
              `id, product_id, name, image_url, delivery_type, quantity, unit_price, created_at,
               orders:orders ( id, status, placed_at, payment_method )`,
            )
            .eq('brand_user_id', authUserId)
            .order('created_at', { ascending: false });

          if (ordersError) {
            console.warn('BrandTransactions: failed to load orders', ordersError.message || ordersError);
            if (isActive) setTransactions([]);
            return;
          }

          const items = orderItems || [];

          // Phase 2: load related products in a separate query keyed by product_id
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
                console.warn('BrandTransactions: products load failed', productsError.message || productsError);
              } else if (Array.isArray(products)) {
                productMap = new Map(products.map((p) => [p.id, p]));
              }
            } catch (prodErr) {
              console.warn('BrandTransactions: products query error', prodErr.message || prodErr);
            }
          }

          if (isActive) {
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

            setTransactions(mapped);
          }
        } catch (e) {
          console.warn('BrandTransactions: error loading data', e.message || e);
          if (isActive) setTransactions([]);
        }
      };

      loadTransactions();

      return () => {
        isActive = false;
      };
    }, [authUserId]),
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);
    const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

    return transactions.filter((tx) => {
      const created = tx.created_at ? new Date(tx.created_at) : null;
      if (!created) return false;

      if (timeFilter === 'today' && !(created >= startOfToday)) return false;
      if (timeFilter === 'yesterday' && !(created >= startOfYesterday && created < startOfToday)) return false;
      if (timeFilter === 'weekly' && !(created >= startOfWeek)) return false;
      if (timeFilter === 'monthly' && !(created >= startOfMonth)) return false;

      const payment = tx.payments || {};
      const method = (payment.method || payment.provider || '').toLowerCase();
      if (gatewayFilter === 'zaad' && !method.includes('zaad')) return false;
      if (gatewayFilter === 'edahab' && !method.includes('edahab')) return false;

      return true;
    });
  }, [transactions, timeFilter, gatewayFilter]);

  const totalRevenue = filtered.reduce((sum, tx) => {
    const amt = Number(tx.amount || 0);
    return sum + amt;
  }, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Download color="#111827" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Total Revenue</Text>
          <View style={styles.revenueRow}>
            <Text style={styles.revenueValue}>${totalRevenue.toFixed(2)}</Text>
          </View>
          <Text style={styles.revenueSubtext}>Based on selected filters</Text>
        </View>

        <View style={styles.filtersRow}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
          ].map((f) => {
            const active = timeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setTimeFilter(f.id)}
              >
                <Text style={active ? styles.filterChipTextActive : styles.filterChipText}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.gatewayRow}>
          {[
            { id: 'all', label: 'All Gateways' },
            { id: 'zaad', label: 'Zaad' },
            { id: 'edahab', label: 'Edahab' },
          ].map((g) => {
            const active = gatewayFilter === g.id;
            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.gatewayChip, active && styles.gatewayChipActive]}
                onPress={() => setGatewayFilter(g.id)}
              >
                <Text style={active ? styles.gatewayChipTextActive : styles.gatewayChipText}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>

        {filtered.map((tx, index) => {
          const created = tx.created_at ? new Date(tx.created_at) : null;
          const dayLabel = created
            ? created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : '';
          const showDayLabel =
            index === 0 || dayLabel !==
              (filtered[index - 1].created_at
                ? new Date(filtered[index - 1].created_at).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric' },
                  )
                : '');

          const payment = tx.payments || {};
          const gateway = payment.method || payment.provider || 'Wallet';
          const timeText = created
            ? created.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            : '';
          const type = tx.type === 'debit' ? 'debit' : 'credit';
          const orderStatusLabel = tx.order_status_label || null;
          const bucket = tx.order_status_bucket || 'pending';

          return (
            <View key={tx.id}>
              {showDayLabel && (
                <Text style={styles.dayLabel}>{dayLabel}</Text>
              )}
              <View style={styles.txCard}>
                {tx.image_url ? (
                  <Image
                    source={{ uri: tx.image_url }}
                    style={styles.txIconCircle}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.txIconCircle} />
                )}
                <View style={styles.txMiddle}>
                  <Text style={styles.txTitle}>{tx.product_name || 'Order'}</Text>
                  <Text style={styles.txMeta}>
                    {payment.order_id ? `Order #${payment.order_id}` : ''}
                  </Text>
                  <Text style={styles.txMeta}>
                    {timeText}
                    {tx.delivery_type ? ` · ${tx.delivery_type}` : ''}
                    {gateway ? ` · ${gateway}` : ''}
                  </Text>
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
                <View style={styles.txRight}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.txAmount,
                        type === 'debit' ? styles.txAmountDebit : styles.txAmountCredit,
                      ]}
                    >
                      {type === 'debit' ? '-' : '+'}${Math.abs(Number(tx.amount || 0)).toFixed(2)}
                    </Text>
                    {tx.sale_type && (
                      <View
                        style={[
                          styles.statusBadge,
                          tx.sale_type === 'flash'
                            ? { backgroundColor: '#fee2e2' }
                            : { backgroundColor: '#e0f2fe' },
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {tx.sale_type === 'flash' ? 'Flash sale' : 'Discount'}
                        </Text>
                      </View>
                    )}
                    {tx.original_price && tx.unit_price && tx.original_price > tx.unit_price && (
                      <Text style={styles.txMeta}>
                        ${tx.unit_price.toFixed(2)} · was ${tx.original_price.toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BrandTransactionsScreen;

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
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  revenueCard: {
    backgroundColor: '#11126F',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  revenueLabel: {
    color: '#cbd5f5',
    fontSize: 13,
    marginBottom: 4,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  revenueValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  deltaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  deltaBadgeText: {
    color: '#bbf7d0',
    fontSize: 12,
    fontWeight: '600',
  },
  revenueSubtext: {
    color: '#e5e7eb',
    fontSize: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  filterChipActive: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
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
  gatewayRow: {
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  txIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
    marginRight: 10,
  },
  txMiddle: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  txMeta: {
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
  },
  txAmountCredit: {
    color: '#16a34a',
  },
  txAmountDebit: {
    color: '#ef4444',
  },
  statusBadge: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  orderStatusPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  orderStatusPillPending: {
    backgroundColor: '#fef3c7',
  },
  orderStatusPillCompleted: {
    backgroundColor: '#dcfce7',
  },
  orderStatusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
});

