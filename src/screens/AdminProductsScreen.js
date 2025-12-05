import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { fetchProductsFromSupabase } from '../services/products';

const AdminProductsScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAudience, setSelectedAudience] = useState('all');

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProductsFromSupabase();
      setProducts(Array.isArray(data) ? data : []);
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

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.productRow}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('EditProduct', { product: item })}
      >
        <Image source={{ uri: item.image }} style={styles.productImage} />
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productBrand}>{item.brand}</Text>
          <Text style={styles.productMeta}>${item.price}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProduct', { product: item })}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const brands = useMemo(() => {
    const names = new Set();
    (products || []).forEach((p) => {
      const name = (p.brand || '').toString().trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = products || [];

    if (selectedCategory !== 'all') {
      list = list.filter((p) => {
        const cat = (p.category || '').toString().toLowerCase();
        if (!cat) return false;
        return cat === selectedCategory;
      });
    }

    if (selectedAudience !== 'all') {
      list = list.filter((p) => {
        const aud = (p.audience || '').toString().toLowerCase();
        if (!aud) return false;
        return aud === selectedAudience;
      });
    }

    if (selectedBrand !== 'all') {
      list = list.filter((p) => (p.brand || '').toString() === selectedBrand);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((p) => (p.name || '').toString().toLowerCase().includes(q));
    }

    return list;
  }, [products, selectedCategory, selectedAudience, selectedBrand, searchQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin: All Products</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Brand</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, selectedBrand === 'all' && styles.chipActive]}
            onPress={() => setSelectedBrand('all')}
          >
            <Text style={selectedBrand === 'all' ? styles.chipTextActive : styles.chipText}>
              All
            </Text>
          </TouchableOpacity>
          {brands.map((name) => (
            <TouchableOpacity
              key={name}
              style={[styles.chip, selectedBrand === name && styles.chipActive]}
              onPress={() => setSelectedBrand(name)}
            >
              <Text style={selectedBrand === name ? styles.chipTextActive : styles.chipText}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Category</Text>
        <View style={styles.chipRow}>
          {[ 
            { id: 'all', label: 'All' },
            { id: 'clothes', label: 'Clothes' },
            { id: 'shoes', label: 'Shoes' },
            { id: 'coats', label: 'Coats' },
            { id: 'phones', label: 'Phones' },
            { id: 'laptops', label: 'Laptops' },
            { id: 'bags', label: 'Bags' },
          ].map((cat) => (
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

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Audience</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'men', label: 'Men' },
            { id: 'women', label: 'Women' },
            { id: 'kids', label: 'Kids' },
          ].map((aud) => (
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

      {loading && products.length === 0 ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }}
          renderItem={renderItem}
          onRefresh={loadProducts}
          refreshing={loading}
          ListEmptyComponent={!loading && (
            <Text style={styles.emptyText}>No products found.</Text>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default AdminProductsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#2563EB',
  },
  backButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginRight: 12,
  },
  searchRow: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  filterRow: {
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
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontWeight: '700',
    color: '#111827',
  },
  productBrand: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  productMeta: {
    fontSize: 13,
    color: '#2563EB',
    marginTop: 4,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9ca3af',
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
