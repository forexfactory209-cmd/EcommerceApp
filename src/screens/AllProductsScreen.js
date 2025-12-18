import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { fetchProductsFromSupabase } from '../services/products';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';

const AllProductsScreen = ({ navigation }) => {
  const products = useStore((state) => state.products);
  const deletedProductIds = useStore((state) => state.deletedProductIds || []);

  const [remoteProducts, setRemoteProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [brands, setBrands] = useState([]);

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

  const baseDataRaw = remoteProducts.length > 0 ? remoteProducts : products;
  const baseData = (baseDataRaw || []).filter((p) => !deletedProductIds.includes(p.id));

  const categories = useMemo(() => {
    const map = new Map();

    (baseData || []).forEach((p) => {
      const raw = (p.category || 'Other').toString();
      const id = raw.toLowerCase();
      const name = raw.charAt(0).toUpperCase() + raw.slice(1);

      if (!map.has(id)) {
        map.set(id, {
          id,
          name,
          image: p.image,
          count: 1,
        });
      } else {
        const existing = map.get(id);
        map.set(id, { ...existing, count: existing.count + 1 });
      }
    });

    let list = Array.from(map.values());

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }

    return list;
  }, [baseData, searchQuery]);

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('CategoryProducts', { categoryId: item.id, categoryName: item.name })}
    >
      <View style={styles.categoryImageWrapper}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.categoryImage} resizeMode="cover" />
        ) : (
          <View style={styles.categoryPlaceholder} />
        )}
      </View>
      <View style={styles.categoryOverlay}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categoryCount}>{item.count} Products</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Categories</Text>
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
          placeholder="Search Categories"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={renderCategoryItem}
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
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchWrapper: {
    marginBottom: 30,
    marginTop: 16,
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
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  categoryCard: {
    flex: 1,
    maxWidth: '48%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginBottom: 18,
  },
  categoryImageWrapper: {
    height: 190,
    width: '100%',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryPlaceholder: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  categoryOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  categoryCount: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});
