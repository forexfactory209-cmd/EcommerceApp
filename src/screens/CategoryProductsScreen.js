import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { fetchProductsFromSupabase } from '../services/products';
import { getFlashSaleState } from '../utils/flashSale';

const CategoryProductsScreen = ({ navigation, route }) => {
  const { categoryId, categoryName } = route.params || {};

  const products = useStore((state) => state.products);
  const wishlist = useStore((state) => state.wishlist);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const authRole = useStore((state) => state.authRole);
  const deletedProductIds = useStore((state) => state.deletedProductIds || []);

  const [remoteProducts, setRemoteProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProductsFromSupabase();
      if (Array.isArray(data) && data.length > 0) {
        setRemoteProducts(data);
      }
    } catch (e) {
      Alert.alert('Supabase error', e.message || 'Failed to load products from Supabase');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts]),
  );

  const baseDataRaw = remoteProducts.length > 0 ? remoteProducts : products;
  const baseData = (baseDataRaw || []).filter((p) => !deletedProductIds.includes(p.id));

  const data = useMemo(() => {
    let result = baseData || [];

    if (categoryId) {
      const catId = categoryId.toLowerCase();
      result = result.filter((p) => ((p.category || '').toString().toLowerCase() === catId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => (p.name || '').toString().toLowerCase().includes(q));
    }

    return result;
  }, [baseData, categoryId, searchQuery]);

  const renderItem = useCallback(({ item }) => {
    const inWishlist = wishlist.some((w) => w.id === item.id);

    const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
    const isOutOfStock = (item.quantity ?? 0) === 0;

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
        activeOpacity={0.9}
      >
        <View style={styles.productImageWrapper}>
          <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
          {isFlashActive && (
            <View style={styles.outOfStockBanner}>
              <Text style={styles.outOfStockText}>Flash Sale</Text>
            </View>
          )}
          {isOutOfStock && !isFlashActive && (
            <View style={styles.outOfStockBanner}>
              <Text style={styles.outOfStockText}>Out of stock</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.wishlistIcon}
            onPress={(e) => {
              e.stopPropagation();
              if (authRole === 'admin') {
                return;
              }
              if (inWishlist) {
                removeFromWishlist(item.id);
              } else {
                addToWishlist(item);
              }
            }}
          >
            <Text style={styles.wishlistIconText}>{inWishlist ? '♥' : '♡'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.productBrand}>{item.brand}</Text>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        {isFlashActive && flashPrice != null && flashPrice > 0 ? (
          <View>
            <Text style={[styles.productPrice, { textDecorationLine: 'line-through', color: '#9ca3af', fontSize: 12 }]}>${currentPrice.toFixed(2)}</Text>
            <Text style={[styles.productPrice, { marginTop: 2 }]}>${flashPrice.toFixed(2)}</Text>
          </View>
        ) : (
          <Text style={styles.productPrice}>${currentPrice.toFixed(2)}</Text>
        )}
      </TouchableOpacity>
    );
  }, [wishlist, authRole, addToWishlist, removeFromWishlist, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{categoryName || 'Products'}</Text>
      </View>

      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search in this category"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={loadProducts}
      />
    </SafeAreaView>
  );
};

export default CategoryProductsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  backButtonIcon: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  searchWrapper: {
    marginBottom: 25,
    marginTop: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    fontSize: 14,
    color: '#111827',
  },
  listContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  productCard: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  productImageWrapper: {
    height: 190,
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  outOfStockBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    backgroundColor: 'rgba(17,24,39,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wishlistIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistIconText: {
    fontSize: 16,
  },
  productBrand: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  productName: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 4,
  },
  productPrice: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 15,
    marginTop: 6,
  },
});
