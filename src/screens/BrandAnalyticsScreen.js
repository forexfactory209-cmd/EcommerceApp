import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useStore } from '../store/store';

const BrandAnalyticsScreen = ({ navigation }) => {
  const { orders, authUserId, products } = useStore();

  const myOrders = useMemo(
    () =>
      Array.isArray(orders)
        ? orders.filter((o) => (authUserId ? o.brand_user_id === authUserId : true))
        : [],
    [orders, authUserId],
  );

  const hasAnyOrders = useMemo(() => Array.isArray(myOrders) && myOrders.length > 0, [myOrders]);

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

    return all.sort((a, b) => b.total - a.total).slice(0, 10);
  }, [myOrders, products]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Top Products</Text>
      </View>

      {!hasAnyOrders || topProducts.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>No sales yet. Your top products will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Top Products</Text>
          {topProducts.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {product.image ? (
                <Image
                  source={{ uri: product.image }}
                  style={styles.productImage}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={200}
                />
              ) : (
                <View style={styles.productImageFallback}>
                  <Text style={styles.productImageFallbackText}>
                    {(product.name || 'P').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.productInfoCol}>
                <Text style={styles.productName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.productSoldText}>{product.quantity} sold</Text>
              </View>
              <View style={styles.productValueCol}>
                <Text style={styles.productRevenue}>${product.total.toFixed(2)}</Text>
                <ChevronRight size={18} color="#9CA3AF" />
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
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  productImageFallback: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  productImageFallbackText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  productInfoCol: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  productSoldText: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  productValueCol: {
    marginLeft: 8,
    alignItems: 'flex-end',
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22C55E',
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#9CA3AF',
  },
});

export default BrandAnalyticsScreen;
