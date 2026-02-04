import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useStore } from '../store/store';

const BrandTopProductsScreen = ({ navigation, route }) => {
  const { timeFilter: initialTimeFilter } = route.params || {};
  const { orders, authUserId, products } = useStore();

  const myOrders = useMemo(
    () =>
      Array.isArray(orders)
        ? orders.filter((o) => (authUserId ? o.brand_user_id === authUserId : true))
        : [],
    [orders, authUserId],
  );

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(myOrders) || myOrders.length === 0) return [];

    const timeFilter = initialTimeFilter || 'weekly';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);
    const startOf7Days = new Date(startOfToday);
    startOf7Days.setDate(startOfToday.getDate() - 6);
    const startOf30Days = new Date(startOfToday);
    startOf30Days.setDate(startOfToday.getDate() - 29);

    const getOrderDate = (order) => {
      if (!order) return null;
      const placedAt = order.placed_at ? new Date(order.placed_at) : order.date ? new Date(order.date) : null;
      if (!placedAt || Number.isNaN(placedAt.getTime())) return null;
      return new Date(placedAt.getFullYear(), placedAt.getMonth(), placedAt.getDate());
    };

    return myOrders.filter((order) => {
      const day = getOrderDate(order);
      if (!day) return false;

      switch (timeFilter) {
        case 'yesterday':
          return day >= startOfYesterday && day < startOfToday;
        case 'today':
          return day >= startOfToday;
        case 'weekly':
          return day >= startOf7Days && day <= now;
        case 'monthly':
          return day >= startOf30Days && day <= now;
        default:
          return true;
      }
    });
  }, [myOrders, initialTimeFilter]);

  const rankedProducts = useMemo(() => {
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

    const all = Array.from(map.values()).map((summary) => {
      const prod = Array.isArray(products)
        ? products.find((p) => p.id === summary.id)
        : null;

      const image = prod?.image_full_url || prod?.image || prod?.image_thumb_url || null;

      return {
        ...summary,
        image,
      };
    });

    return all.sort((a, b) => b.total - a.total);
  }, [filteredOrders, products]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Products</Text>
      </View>

      {rankedProducts.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>No sales yet for this time period.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {rankedProducts.map((product, index) => (
            <View key={product.id} style={styles.row}>
              <Text style={styles.rankText}>{index + 1}</Text>
              {product.image ? (
                <Image
                  source={{ uri: product.image }}
                  style={styles.thumb}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={200}
                />
              ) : (
                <View style={styles.thumbFallback}>
                  <Text style={styles.thumbFallbackText}>
                    {(product.name || 'P').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.rowTextCol}>
                <Text style={styles.productName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.productMeta}>
                  {product.quantity} sold · ${product.total.toFixed(2)} revenue
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rankText: {
    width: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    marginRight: 4,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    marginRight: 10,
  },
  thumbFallback: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  thumbFallbackText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  rowTextCol: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  productMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
});

export default BrandTopProductsScreen;
