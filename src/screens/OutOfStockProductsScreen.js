import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const OutOfStockProductsScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadOutOfStock = async () => {
      try {
        if (!authUserId) {
          setProducts([]);
          return;
        }

        const { data, error: prodError } = await supabase
          .from('products')
          .select('*')
          .eq('brand_user_id', authUserId)
          .or('is_deleted.is.null,is_deleted.eq.false');

        if (prodError) {
          console.warn('Error loading out-of-stock products:', prodError.message || prodError);
          setError('Failed to load products');
          return;
        }

        const all = Array.isArray(data) ? data : [];
        const outOfStock = all.filter((p) => {
          const stock = typeof p.stock === 'number' ? p.stock : null;
          const quantity = typeof p.quantity === 'number' ? p.quantity : null;
          const inventory = typeof p.inventory === 'number' ? p.inventory : null;
          const status = (p.status || '').toString().toLowerCase();

          if (stock !== null) return stock <= 0;
          if (quantity !== null) return quantity <= 0;
          if (inventory !== null) return inventory <= 0;
          if (status === 'out_of_stock' || status === 'out-of-stock') return true;
          return false;
        });

        if (isActive) {
          setProducts(outOfStock);
        }
      } catch (e) {
        console.warn('Unexpected error loading out-of-stock products:', e.message || e);
        setError('Failed to load products');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadOutOfStock();

    return () => {
      isActive = false;
    };
  }, [authUserId]);

  const renderItem = ({ item }) => {
    const name = item.name || 'Unnamed product';
    const stock =
      typeof item.stock === 'number'
        ? item.stock
        : typeof item.quantity === 'number'
        ? item.quantity
        : typeof item.inventory === 'number'
        ? item.inventory
        : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
              <Text style={styles.thumbnailPlaceholderText}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.cardContent}>
            <Text style={styles.productName} numberOfLines={2}>
              {name}
            </Text>
            {stock !== null && (
              <Text style={styles.stockText}>Current stock: {stock}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.restockButton}
          onPress={() => {
            // Send them to the full Vendor screen where they can edit inventory
            navigation.navigate('Vendor');
          }}
        >
          <Text style={styles.restockButtonText}>Edit product</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Out of stock</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#090966" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && products.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>All products are in stock</Text>
          <Text style={styles.emptySubtitle}>We could not find any out-of-stock items.</Text>
        </View>
      )}

      {!loading && !error && products.length > 0 && (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#4B5563',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#B91C1C',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4B5563',
  },
  cardContent: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  stockText: {
    fontSize: 13,
    color: '#B91C1C',
  },
  restockButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#090966',
  },
  restockButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default OutOfStockProductsScreen;
