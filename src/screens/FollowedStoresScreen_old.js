import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Search, Heart, Star } from 'lucide-react-native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const FollowedStoresScreen = ({ navigation }) => {
  const followedBrandIds = useStore((state) => state.followedBrandIds || []);
  const loadFollowedBrands = useStore((state) => state.loadFollowedBrands);

  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchFollowedBrands = useCallback(async () => {
    try {
      setLoading(true);

      if (!followedBrandIds || followedBrandIds.length === 0) {
        setBrands([]);
        return;
      }

      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .in('id', followedBrandIds);

      if (error) {
        console.warn('FollowedStores: failed to load brands', error.message || error);
        setBrands([]);
        return;
      }

      setBrands(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('FollowedStores: unexpected error loading brands', e.message || e);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [followedBrandIds]);

  useEffect(() => {
    loadFollowedBrands?.();
  }, [loadFollowedBrands]);

  useEffect(() => {
    fetchFollowedBrands();
  }, [fetchFollowedBrands]);

  const filteredBrands = brands.filter((b) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (b.name || '').toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q)
    );
  });

  const renderItem = ({ item }) => {
    const rating = typeof item.rating_average === 'number' ? item.rating_average : null;
    const followers = typeof item.followers_count === 'number' ? item.followers_count : null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('Brand', { brandId: item.id, brand: item })}
      >
        <View style={styles.cardLeft}>
          <View style={styles.thumbnailWrapper}>
            {item.logo_url ? (
              <Image
                source={{ uri: item.logo_url }}
                style={styles.thumbnail}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Text style={styles.thumbnailInitial}>
                  {(item.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.brandName} numberOfLines={1}>
              {item.name || 'Store'}
            </Text>
            {item.category ? (
              <Text style={styles.brandCategory} numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <View style={styles.ratingPill}>
                <Star
                  size={12}
                  color={rating ? '#FBBF24' : '#D1D5DB'}
                  fill={rating ? '#FBBF24' : 'transparent'}
                />
                <Text style={styles.ratingText}>{rating ? rating.toFixed(1) : 'New'}</Text>
              </View>
              {followers != null && followers > 0 && (
                <Text style={styles.followersText} numberOfLines={1}>
                  {followers.toLocaleString()} Followers
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          <TouchableOpacity
            style={styles.shopNowButton}
            onPress={() => navigation.navigate('Brand', { brandId: item.id, brand: item })}
          >
            <Text style={styles.shopNowText}>Shop Now</Text>
          </TouchableOpacity>
          <View style={styles.heartWrapper}>
            <Heart size={18} color="#EC4899" fill="#EC4899" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followed Stores</Text>
      </View>

      <View style={styles.searchWrapper}>
        <Search size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search my stores..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filteredBrands.length === 0 && !loading ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>You haven't followed any stores yet.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBrands}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default FollowedStoresScreen;

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
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#11146E',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  thumbnailWrapper: {
    width: 68,
    height: 68,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  cardInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  brandCategory: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  followersText: {
    fontSize: 12,
    color: '#6B7280',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  shopNowButton: {
    backgroundColor: '#11146E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  shopNowText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  heartWrapper: {
    marginTop: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
