import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Svg, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const CHART_WIDTH = 260;
const CHART_HEIGHT = 120;

const BrandAnalyticsScreen = ({ navigation }) => {
  const { orders, authUserId } = useStore();
  const [trendRange, setTrendRange] = useState('weekly'); // 'weekly' | 'monthly'
  const [trafficStats, setTrafficStats] = useState({ recent: 0, deltaPercent: 0 });
  const [ratingStats, setRatingStats] = useState({ avg: null, count: 0 });

  const myOrders = useMemo(
    () =>
      Array.isArray(orders)
        ? orders.filter((o) => (authUserId ? o.brand_user_id === authUserId : true))
        : [],
    [orders, authUserId],
  );

  const allDeliveredOrdersCount = useMemo(
    () => myOrders.filter((o) => o.status === 'Delivered').length,
    [myOrders],
  );

  const allGrossRevenue = useMemo(
    () => myOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    [myOrders],
  );

  const COMMISSION_RATE = 0.15;

  const totalOrders = myOrders.length;
  const netRevenue = allGrossRevenue * (1 - COMMISSION_RATE);
  const avgOrderValue = totalOrders > 0 ? allGrossRevenue / totalOrders : 0;
  const fulfillmentRate = totalOrders > 0 ? (allDeliveredOrdersCount / totalOrders) * 100 : 0;
  const hasAnyOrders = totalOrders > 0;

  const topProducts = useMemo(() => {
    const map = new Map();

    myOrders.forEach((order) => {
      if (!Array.isArray(order.items)) return;
      order.items.forEach((item) => {
        if (!item || !item.id) return;
        const existing = map.get(item.id) || {
          id: item.id,
          name: item.name || 'Product',
          price: Number(item.price || 0),
          quantity: 0,
          total: 0,
        };
        const qty = Number(item.quantity || 0);
        existing.quantity += qty;
        existing.total += qty * (Number(item.price || 0));
        map.set(item.id, existing);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [myOrders]);

  const weeklyBuckets = useMemo(() => {
    const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const values = Array(7).fill(0);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

    myOrders.forEach((order) => {
      const placedAt = order.placed_at ? new Date(order.placed_at) : order.date ? new Date(order.date) : null;
      if (!placedAt || Number.isNaN(placedAt.getTime())) return;
      const day = new Date(placedAt.getFullYear(), placedAt.getMonth(), placedAt.getDate());
      if (day < start || day > today) return;
      const weekday = day.getDay();
      const index = (weekday + 6) % 7;
      values[index] += order.total || 0;
    });

    return labels.map((label, index) => ({ label, value: values[index] }));
  }, [myOrders]);

  const monthlyBuckets = useMemo(() => {
    const labels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const now = new Date();
    const buckets = [];

    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: labels[d.getMonth()],
        value: 0,
      });
    }

    myOrders.forEach((order) => {
      const placedAt = order.placed_at ? new Date(order.placed_at) : order.date ? new Date(order.date) : null;
      if (!placedAt || Number.isNaN(placedAt.getTime())) return;

      const year = placedAt.getFullYear();
      const month = placedAt.getMonth();

      const bucket = buckets.find((b) => b.year === year && b.month === month);
      if (bucket) {
        bucket.value += order.total || 0;
      }
    });

    return buckets;
  }, [myOrders]);

  const chartBuckets = trendRange === 'weekly' ? weeklyBuckets : monthlyBuckets;

  const chartMax = useMemo(
    () => Math.max(...chartBuckets.map((b) => b.value || 0), 1),
    [chartBuckets],
  );

  const [chartOpacity] = useState(new Animated.Value(0));

  useEffect(() => {
    chartOpacity.setValue(0);
    Animated.timing(chartOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [chartBuckets]);

  useEffect(() => {
    let isMounted = true;

    const loadTraffic = async () => {
      try {
        if (!authUserId) return;

        const now = new Date();
        const last30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
        const last60 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59);

        const { data: recent, error: recentError } = await supabase
          .from('brand_visits')
          .select('id, created_at')
          .eq('brand_user_id', authUserId)
          .gte('created_at', last30.toISOString());

        if (recentError || !isMounted) return;

        const { data: prev, error: prevError } = await supabase
          .from('brand_visits')
          .select('id, created_at')
          .eq('brand_user_id', authUserId)
          .gte('created_at', last60.toISOString())
          .lt('created_at', last30.toISOString());

        if (prevError || !isMounted) return;

        const recentCount = (recent || []).length;
        const prevCount = (prev || []).length;

        let deltaPercent = 0;
        if (prevCount > 0) {
          deltaPercent = ((recentCount - prevCount) / prevCount) * 100;
        } else if (recentCount > 0) {
          deltaPercent = 100;
        }

        setTrafficStats({ recent: recentCount, deltaPercent });
      } catch (e) {
      }
    };

    const loadRating = async () => {
      try {
        if (!authUserId) return;
        const { data, error } = await supabase
          .from('brands')
          .select('rating_average, rating_count')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (error || !isMounted) return;

        if (data) {
          setRatingStats({
            avg: typeof data.rating_average === 'number' ? data.rating_average : null,
            count: typeof data.rating_count === 'number' ? data.rating_count : 0,
          });
        }
      } catch (e) {
      }
    };

    loadTraffic();
    loadRating();

    return () => {
      isMounted = false;
    };
  }, [authUserId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeftRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft color="#111827" size={20} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Analytics</Text>
              <Text style={styles.headerSubtitle}>Performance dashboard</Text>
            </View>
          </View>
        </View>

        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Total Revenue</Text>
          <View style={styles.revenueRow}>
            <Text style={styles.revenueValue}>${allGrossRevenue.toFixed(2)}</Text>
            <View style={styles.revenueDeltaPill}>
              <Text style={styles.revenueDeltaText}>+12.5%</Text>
            </View>
          </View>
          <View style={styles.revenueMetaRow}>
            <View style={styles.revenueMetaCard}>
              <Text style={styles.revenueMetaLabel}>Orders</Text>
              <Text style={styles.revenueMetaValue}>{totalOrders}</Text>
            </View>
            <View style={styles.revenueMetaCard}>
              <Text style={styles.revenueMetaLabel}>Conv. Rate</Text>
              <Text style={styles.revenueMetaValue}>
                {trafficStats.recent > 0
                  ? `${((totalOrders / trafficStats.recent) * 100).toFixed(2)}%`
                  : '0.00%'}
              </Text>
            </View>
            <View style={styles.revenueMetaCard}>
              <Text style={styles.revenueMetaLabel}>AOV</Text>
              <Text style={styles.revenueMetaValue}>${avgOrderValue.toFixed(2)}</Text>
            </View>
          </View>
          {!hasAnyOrders && (
            <Text style={styles.emptyText}>No orders yet. Your first sales will appear here.</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Sales Trend</Text>
              <Text style={styles.sectionSubtitle}>
                {trendRange === 'weekly' ? 'Last 7 days by weekday' : 'Last 12 months'}
              </Text>
            </View>
            <View style={styles.trendTabsRow}>
              <TouchableOpacity
                style={trendRange === 'weekly' ? styles.trendTabActive : styles.trendTab}
                onPress={() => setTrendRange('weekly')}
              >
                <Text
                  style={
                    trendRange === 'weekly' ? styles.trendTabTextActive : styles.trendTabText
                  }
                >
                  WEEKLY
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={trendRange === 'monthly' ? styles.trendTabActive : styles.trendTab}
                onPress={() => setTrendRange('monthly')}
              >
                <Text
                  style={
                    trendRange === 'monthly' ? styles.trendTabTextActive : styles.trendTabText
                  }
                >
                  MONTHLY
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Animated.View
            style={[
              styles.barChartWrapper,
              {
                opacity: chartOpacity,
                transform: [
                  {
                    translateY: chartOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
              <Defs>
                <LinearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#EEF2FF" />
                  <Stop offset="1" stopColor="#4F46E5" />
                </LinearGradient>
              </Defs>
              {chartBuckets.map((bucket, index) => {
                const barWidth = CHART_WIDTH / (chartBuckets.length * 1.5);
                const gap = barWidth * 0.5;
                const x = index * (barWidth + gap) + gap;
                const value = bucket.value || 0;
                const normalized = value > 0 ? value / chartMax : 0;
                const barHeight = normalized * (CHART_HEIGHT - 16);
                const y = CHART_HEIGHT - barHeight;

                return (
                  <Rect
                    key={bucket.label + index}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={6}
                    fill="url(#barGradient)"
                  />
                );
              })}
            </Svg>
          </Animated.View>
          <View style={styles.barLabelsRow}>
            {chartBuckets.map((bucket) => (
              <Text key={bucket.label} style={styles.barLabelText}>
                {bucket.label}
              </Text>
            ))}
          </View>
          {!hasAnyOrders && (
            <Text style={styles.chartEmptyText}>No sales data yet for this period.</Text>
          )}
        </View>

        <View style={styles.performanceSection}>
          <Text style={styles.performanceTitle}>Performance Details</Text>

          <View style={styles.performanceCardRow}>
            <View style={[styles.performanceIconBox, { backgroundColor: '#EEF2FF' }]} />
            <View style={styles.performanceTextCol}>
              <Text style={styles.performanceLabel}>Store Traffic</Text>
              <Text style={styles.performanceSubLabel}>Unique visitors</Text>
            </View>
            <View style={styles.performanceValueCol}>
              <Text style={styles.performanceValue}>
                {trafficStats.recent >= 1000
                  ? `${(trafficStats.recent / 1000).toFixed(1)}k`
                  : `${trafficStats.recent}`}
              </Text>
              <Text
                style={
                  trafficStats.deltaPercent >= 0
                    ? styles.performanceDeltaPositive
                    : styles.performanceDeltaNegative
                }
              >
                {trafficStats.deltaPercent >= 0 ? '+' : ''}
                {trafficStats.deltaPercent.toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={styles.performanceCardRow}>
            <View style={[styles.performanceIconBox, { backgroundColor: '#FEF9C3' }]} />
            <View style={styles.performanceTextCol}>
              <Text style={styles.performanceLabel}>Rating &amp; Reviews</Text>
              <Text style={styles.performanceSubLabel}>Average rating</Text>
            </View>
            <View style={styles.performanceValueCol}>
              <Text style={styles.performanceValue}>
                {ratingStats.avg != null ? ratingStats.avg.toFixed(1) : '0.0'}/5
              </Text>
              <Text style={styles.performanceMetaRight}>{ratingStats.count} reviews</Text>
            </View>
          </View>

          <View style={styles.performanceCardRow}>
            <View style={[styles.performanceIconBox, { backgroundColor: '#DBEAFE' }]} />
            <View style={styles.performanceTextCol}>
              <Text style={styles.performanceLabel}>Fulfillment Rate</Text>
              <Text style={styles.performanceSubLabel}>Orders delivered</Text>
            </View>
            <View style={styles.performanceValueCol}>
              <Text style={styles.performanceValue}>{fulfillmentRate.toFixed(1)}%</Text>
              <Text style={styles.performanceMetaRight}>
                {allDeliveredOrdersCount} / {totalOrders} orders
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 18,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#11126F',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  revenueCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#11126F',
    marginBottom: 18,
  },
  revenueLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 12,
  },
  revenueValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  revenueDeltaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  revenueDeltaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22C55E',
  },
  revenueMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  revenueMetaCard: {
    flex: 1,
    marginRight: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  revenueMetaLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  revenueMetaValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  trendTabsRow: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    padding: 3,
  },
  trendTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  trendTabActive: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  trendTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  trendTabTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  barChartWrapper: {
    marginTop: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  barLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  barLabelText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  performanceSection: {
    marginTop: 4,
  },
  performanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  performanceCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  performanceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    marginRight: 12,
  },
  performanceTextCol: {
    flex: 1,
  },
  chartEmptyText: {
    marginTop: 6,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  emptyText: {
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default BrandAnalyticsScreen;
