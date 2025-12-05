import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';

const AllBrandsScreen = ({ navigation }) => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadBrands = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApprovedBrandsFromSupabase();
      setBrands(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('AllBrands: failed to load brands', e.message || e);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBrands();
    }, [loadBrands]),
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.brandRow}
      onPress={() => navigation.navigate('Brand', { brandId: item.id, brand: item })}
      activeOpacity={0.8}
    >
      <View style={styles.brandIconWrapper}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.brandLogo} resizeMode="contain" />
        ) : (
          <Text style={styles.brandIconText}>
            {(item.name || '?').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.brandInfo}>
        <Text style={styles.brandName}>{item.name}</Text>
        {item.contact_email ? (
          <Text style={styles.brandMeta}>{item.contact_email}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.title}>All Brands</Text>
      </View>

      {brands.length === 0 && !loading ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>No brands available yet.</Text>
        </View>
      ) : (
        <FlatList
          data={brands}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          onRefresh={loadBrands}
          refreshing={loading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default AllBrandsScreen;

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
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  brandIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandLogo: {
    width: 40,
    height: 40,
  },
  brandIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  brandMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9ca3af',
  },
});
