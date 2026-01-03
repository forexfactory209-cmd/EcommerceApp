import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowLeft, Search, Download } from 'lucide-react-native';
import { Svg, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useStore } from '../store/store';

const CHART_WIDTH = 260;
const CHART_HEIGHT = 120;

const buildLinePath = (values, width, height) => {
  if (!values || values.length === 0) return '';

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const count = values.length;
  const stepX = count > 1 ? width / (count - 1) : 0;

  let d = '';

  values.forEach((v, index) => {
    const x = stepX * index;
    const normalized = (v - min) / range;
    const y = height - normalized * height;
    d += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  return d;
};

const buildAreaPath = (values, width, height) => {
  const line = buildLinePath(values, width, height);
  if (!line) return '';

  const lastX = width;
  const baseY = height;

  return `${line} L ${lastX} ${baseY} L 0 ${baseY} Z`;
};

const BrandAnalyticsScreen = ({ navigation }) => {
  const { orders, authUserId } = useStore();
  const [activeTab, setActiveTab] = useState('sales');
  const [range, setRange] = useState('30d'); // 'today' | 'yesterday' | '7d' | '30d'

  const myOrders = useMemo(
    () =>
      Array.isArray(orders)
        ? orders.filter((o) => (authUserId ? o.brand_user_id === authUserId : true))
        : [],
    [orders, authUserId],
  );

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(myOrders) || myOrders.length === 0) return [];

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    let startOfRange = new Date(startOfToday);

    if (range === '7d') {
      startOfRange.setDate(startOfToday.getDate() - 6);
    } else if (range === '30d') {
      startOfRange.setDate(startOfToday.getDate() - 29);
    }

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const parseOrderDate = (order) => {
      if (order.placed_at) {
        const d = new Date(order.placed_at);
        if (!Number.isNaN(d.getTime())) return d;
      }

      if (order.date) {
        const d = new Date(order.date);
        if (!Number.isNaN(d.getTime())) return d;
      }

      return null;
    };

    return myOrders.filter((order) => {
      const d = parseOrderDate(order);
      if (!d) return false;

      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (range === 'today') {
        return sameDay(day, startOfToday);
      }

      if (range === 'yesterday') {
        return sameDay(day, startOfYesterday);
      }

      // 7d or 30d ranges
      return day >= startOfRange && day <= startOfToday;
    });
  }, [myOrders, range]);

  const COMMISSION_RATE = 0.15;

  const grossRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const commissionAmount = grossRevenue * COMMISSION_RATE;
  const netRevenue = grossRevenue - commissionAmount;
  const deliveredOrdersCount = filteredOrders.filter((o) => o.status === 'Delivered').length;
  const pendingOrdersCount = filteredOrders.length - deliveredOrdersCount;

  const topProducts = useMemo(() => {
    const map = new Map();

    filteredOrders.forEach((order) => {
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
  }, [filteredOrders]);

  const chartValues = useMemo(() => {
    const points = 7;
    if (grossRevenue <= 0 || filteredOrders.length === 0) {
      return Array.from({ length: points }, (_, index) => (index === points - 1 ? 1 : 0.4));
    }

    const base = grossRevenue / points;
    return Array.from({ length: points }, (_, index) => {
      const factor = 0.6 + (index / (points - 1)) * 0.8;
      return base * factor;
    });
  }, [grossRevenue, filteredOrders.length]);

  const rangeLabel = useMemo(() => {
    switch (range) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case '7d':
        return 'Last 7 Days';
      case '30d':
      default:
        return 'Last 30 Days';
    }
  }, [range]);

  const cycleRange = () => {
    setRange((prev) => {
      if (prev === '30d') return '7d';
      if (prev === '7d') return 'yesterday';
      if (prev === 'yesterday') return 'today';
      return '30d';
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft color="#ffffff" size={20} />
          </TouchableOpacity>
          <View style={styles.headerTextWrapper}>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSubtitle}>Monitor your brand performance</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Search color="#ffffff" size={18} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Download color="#ffffff" size={18} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterPill}
            activeOpacity={0.85}
            onPress={cycleRange}
          >
            <Text style={styles.filterPillText}>{rangeLabel}</Text>
          </TouchableOpacity>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={activeTab === 'sales' ? styles.tabActive : styles.tabInactive}
              onPress={() => setActiveTab('sales')}
              activeOpacity={0.9}
            >
              <Text style={activeTab === 'sales' ? styles.tabActiveText : styles.tabInactiveText}>
                Sales
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={activeTab === 'traffic' ? styles.tabActive : styles.tabInactive}
              onPress={() => setActiveTab('traffic')}
              activeOpacity={0.9}
            >
              <Text style={activeTab === 'traffic' ? styles.tabActiveText : styles.tabInactiveText}>
                Traffic
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={activeTab === 'inventory' ? styles.tabActive : styles.tabInactive}
              onPress={() => setActiveTab('inventory')}
              activeOpacity={0.9}
            >
              <Text
                style={activeTab === 'inventory' ? styles.tabActiveText : styles.tabInactiveText}
              >
                Inventory
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Sales</Text>
            <Text style={styles.metricValue}>${grossRevenue.toFixed(0)}</Text>
            <Text style={styles.metricDelta}>Orders: {myOrders.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Net Profit</Text>
            <Text style={styles.metricValue}>${netRevenue.toFixed(0)}</Text>
            <Text style={styles.metricDelta}>After 15% commission</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeaderRow}>
            <View>
              <Text style={styles.chartTitle}>Revenue vs. Orders</Text>
              <Text style={styles.chartSubtitle}>Synthetic daily view</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Daily</Text>
            </View>
          </View>

          <View style={styles.chartAreaWrapper}>
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
              <Defs>
                <LinearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity={0.3} />
                  <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path
                d={buildAreaPath(chartValues, CHART_WIDTH, CHART_HEIGHT)}
                fill="url(#fillGradient)"
              />
              <Path
                d={buildLinePath(chartValues, CHART_WIDTH, CHART_HEIGHT)}
                stroke="#ffffff"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.chartDaysRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <Text key={day} style={styles.chartDayLabel}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.chartFooterRow}>
            <View>
              <Text style={styles.chartFooterLabel}>Delivered</Text>
              <Text style={styles.chartFooterValue}>{deliveredOrdersCount}</Text>
            </View>
            <View>
              <Text style={styles.chartFooterLabel}>Pending</Text>
              <Text style={styles.chartFooterValue}>{pendingOrdersCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Top Products</Text>
        </View>

        <View style={styles.topProductsList}>
          {topProducts.length === 0 ? (
            <Text style={styles.emptyText}>No sales yet for this period.</Text>
          ) : (
            topProducts.map((item, index) => (
              <View key={item.id} style={styles.productRow}>
                <View style={styles.productAvatar}>
                  <Text style={styles.productAvatarText}>{index + 1}</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.productMeta}>
                    {item.quantity} sales · ${item.total.toFixed(0)} revenue
                  </Text>
                </View>
                <Text style={styles.productKpi}>${item.price.toFixed(0)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default BrandAnalyticsScreen;

const PRIMARY = '#090966';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 34,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: PRIMARY,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(9,9,102,0.7)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(9,9,102,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(9,9,102,0.06)',
  },
  filterPillText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(9,9,102,0.04)',
    borderRadius: 999,
    padding: 3,
  },
  tabActive: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PRIMARY,
    marginRight: 4,
  },
  tabInactive: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 4,
  },
  tabActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  tabInactiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  metricCard: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    borderWidth: 0,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  metricValue: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  metricDelta: {
    marginTop: 6,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  chartCard: {
    borderRadius: 26,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: PRIMARY,
    borderWidth: 0,
    marginBottom: 20,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  chartSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  chartAreaWrapper: {
    height: CHART_HEIGHT,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  chartFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartFooterLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  chartFooterValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  chartDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  chartDaysLabel: {
    fontSize: 12,
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY,
  },
  topProductsList: {
    borderRadius: 26,
    backgroundColor: PRIMARY,
    borderWidth: 0,
    padding: 10,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  productAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  productMeta: {
    marginTop: 2,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  productKpi: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  emptyText: {
    paddingVertical: 12,
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
});
