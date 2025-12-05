import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { fetchProductsFromSupabase } from '../services/products';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';

const AllProductsScreen = ({ navigation }) => {
  const products = useStore((state) => state.products);
  const wishlist = useStore((state) => state.wishlist);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const authRole = useStore((state) => state.authRole);

  const [remoteProducts, setRemoteProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [priceSort, setPriceSort] = useState('none'); // 'none' | 'low' | 'high'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAudience, setSelectedAudience] = useState('all');

  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

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

  const loadBrands = useCallback(async () => {
    try {
      const data = await fetchApprovedBrandsFromSupabase();
      if (Array.isArray(data)) {
        setBrands(data);
      }
    } catch (e) {
      console.warn('Supabase brands error', e.message || e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadBrands();
    }, [loadProducts, loadBrands]),
  );

  const baseData = remoteProducts.length > 0 ? remoteProducts : products;

  const data = useMemo(() => {
    let result = baseData || [];

    // Category filter (explicit match only)
    if (selectedCategory !== 'all') {
      const categoryId = selectedCategory.toLowerCase();
      result = result.filter((p) => {
        const cat = (p.category || '').toString().toLowerCase();
        return cat && cat === categoryId;
      });
    }

    // Audience filter (explicit match only)
    if (selectedAudience !== 'all') {
      const audId = selectedAudience.toLowerCase();
      result = result.filter((p) => {
        const aud = (p.audience || '').toString().toLowerCase();
        return aud && aud === audId;
      });
    }

    // Brand filter (using approved brands list names)
    if (selectedBrand !== 'all') {
      result = result.filter((p) => (p.brand || '').toString() === selectedBrand);
    }

    // Search by name
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((p) => (p.name || '').toString().toLowerCase().includes(q));
    }

    // Price sort
    if (priceSort === 'low') {
      result = [...result].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (priceSort === 'high') {
      result = [...result].sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return result;
  }, [baseData, selectedCategory, selectedAudience, selectedBrand, priceSort, searchQuery]);

  const renderItem = ({ item }) => {
    const inWishlist = wishlist.some((w) => w.id === item.id);

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
        activeOpacity={0.9}
      >
        <View style={styles.productImageWrapper}>
          <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
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
        <Text style={styles.productPrice}>${item.price}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{''} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Products</Text>
      </View>

      <Animated.View
        style={[
          styles.searchWrapper,
          {
            borderColor: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['#e5e7eb', '#2563EB'],
            }),
            shadowOpacity: focusAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.12],
            }),
          },
        ]}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>

      <View style={styles.filtersRow}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Brand</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, selectedBrand === 'all' && styles.chipActive]}
              onPress={() => setSelectedBrand('all')}
            >
              <Text style={selectedBrand === 'all' ? styles.chipTextActive : styles.chipText}>All</Text>
            </TouchableOpacity>
            {brands.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.chip, selectedBrand === b.name && styles.chipActive]}
                onPress={() => setSelectedBrand(b.name)}
              >
                <Text style={selectedBrand === b.name ? styles.chipTextActive : styles.chipText}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Price</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, priceSort === 'none' && styles.chipActive]}
              onPress={() => setPriceSort('none')}
            >
              <Text style={priceSort === 'none' ? styles.chipTextActive : styles.chipText}>Default</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, priceSort === 'low' && styles.chipActive]}
              onPress={() => setPriceSort('low')}
            >
              <Text style={priceSort === 'low' ? styles.chipTextActive : styles.chipText}>Low → High</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, priceSort === 'high' && styles.chipActive]}
              onPress={() => setPriceSort('high')}
            >
              <Text style={priceSort === 'high' ? styles.chipTextActive : styles.chipText}>High → Low</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.chipRow}>
            {[{ id: 'all', label: 'All' }, { id: 'clothes', label: 'Clothes' }, { id: 'shoes', label: 'Shoes' }, { id: 'coats', label: 'Coats' }, { id: 'phones', label: 'Phones' }, { id: 'laptops', label: 'Laptops' }, { id: 'bags', label: 'Bags' }].map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, selectedCategory === cat.id && styles.chipActive]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={selectedCategory === cat.id ? styles.chipTextActive : styles.chipText}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Audience</Text>
          <View style={styles.chipRow}>
            {[{ id: 'all', label: 'All' }, { id: 'men', label: 'Men' }, { id: 'women', label: 'Women' }, { id: 'kids', label: 'Kids' }].map((aud) => (
              <TouchableOpacity
                key={aud.id}
                style={[styles.chip, selectedAudience === aud.id && styles.chipActive]}
                onPress={() => setSelectedAudience(aud.id)}
              >
                <Text style={selectedAudience === aud.id ? styles.chipTextActive : styles.chipText}>
                  {aud.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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

export default AllProductsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchWrapper: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
    color: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#2563EB'
  },
  backButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  filtersRow: {
    marginBottom: 12,
  },
  filterGroup: {
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginRight: 8,
    marginBottom: 6,
  },
  chipActive: {
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '600',
  },
  chipTextActive: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productCard: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  productImageWrapper: {
    height: 128,
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  wishlistIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  wishlistIconText: {
    fontSize: 14,
  },
  productBrand: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productName: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 4,
  },
  productPrice: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 4,
  },
});
