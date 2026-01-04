import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Star } from 'lucide-react-native';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';
import { useStore } from '../store/store';

const AllBrandsScreen = ({ navigation, route }) => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState('all');
  const [sortMode, setSortMode] = useState('popular');

  const followedBrandIds = useStore((state) => state.followedBrandIds || []);
  const toggleFollowBrand = useStore((state) => state.toggleFollowBrand);

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

  useEffect(() => {
    const initial = route?.params?.initialAudience;
    if (initial && typeof initial === 'string') {
      setSelectedAudience(initial);
    }
  }, [route]);

  const filteredBrands = brands.filter((brand) => {
    if (selectedAudience === 'all') return true;

    const explicit = (brand.audience || brand.category || '').toString().toLowerCase();
    if (explicit) {
      if (selectedAudience === 'men') return explicit === 'men';
      if (selectedAudience === 'women') return explicit === 'women';
      if (selectedAudience === 'kids') return explicit === 'kids';
      if (selectedAudience === 'cosmetics_beauty') {
        return (
          explicit === 'cosmetics_beauty' ||
          explicit === 'cosmetics' ||
          explicit === 'beauty'
        );
      }
    }

    const text = `${brand.name || ''}`.toLowerCase();

    if (selectedAudience === 'men') {
      return text.includes("men's") || text.includes('men ') || text.includes('male');
    }
    if (selectedAudience === 'women') {
      return (
        text.includes("women's") ||
        text.includes('women ') ||
        text.includes('female') ||
        text.includes('lady')
      );
    }
    if (selectedAudience === 'kids') {
      return (
        text.includes('kid') ||
        text.includes('child') ||
        text.includes('children') ||
        text.includes('boys') ||
        text.includes('girls')
      );
    }
    if (selectedAudience === 'cosmetics_beauty') {
      return (
        text.includes('cosmetic') ||
        text.includes('makeup') ||
        text.includes('beauty') ||
        text.includes('skincare')
      );
    }

    return true;
  });

  const sortedBrands = useMemo(() => {
    const list = [...filteredBrands];

    if (sortMode === 'new') {
      return list.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });
    }

    if (sortMode === 'top_rated') {
      return list.sort((a, b) => {
        const aRating =
          typeof a.rating_average === 'number' && !Number.isNaN(a.rating_average)
            ? a.rating_average
            : 0;
        const bRating =
          typeof b.rating_average === 'number' && !Number.isNaN(b.rating_average)
            ? b.rating_average
            : 0;
        return bRating - aRating;
      });
    }

    if (sortMode === 'followers') {
      return list.sort((a, b) => {
        const aFollowers =
          typeof a.followers_count === 'number' && !Number.isNaN(a.followers_count)
            ? a.followers_count
            : 0;
        const bFollowers =
          typeof b.followers_count === 'number' && !Number.isNaN(b.followers_count)
            ? b.followers_count
            : 0;
        return bFollowers - aFollowers;
      });
    }

    // 'popular' default – keep server ordering but prefer followers when available
    return list.sort((a, b) => {
      const aFollowers =
        typeof a.followers_count === 'number' && !Number.isNaN(a.followers_count)
          ? a.followers_count
          : 0;
      const bFollowers =
        typeof b.followers_count === 'number' && !Number.isNaN(b.followers_count)
          ? b.followers_count
          : 0;

      if (bFollowers !== aFollowers) return bFollowers - aFollowers;
      const aName = (a.name || '').toString().toLowerCase();
      const bName = (b.name || '').toString().toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [filteredBrands, sortMode]);

  const renderItem = ({ item }) => {
    const rating =
      typeof item.rating_average === 'number' && !Number.isNaN(item.rating_average)
        ? item.rating_average
        : null;
    const followers =
      typeof item.followers_count === 'number' && !Number.isNaN(item.followers_count)
        ? item.followers_count
        : null;

    const isFollowed = followedBrandIds.includes(item.id);

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
                <Text style={styles.ratingText}>
                  {rating ? rating.toFixed(1) : 'New'}
                </Text>
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
            style={[styles.followButton, isFollowed && styles.followButtonActive]}
            activeOpacity={0.9}
            onPress={() => toggleFollowBrand(item.id)}
          >
            <Text
              style={[styles.followButtonText, isFollowed && styles.followButtonTextActive]}
            >
              {isFollowed ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const audienceTitle = useMemo(() => {
    switch (selectedAudience) {
      case 'men':
        return 'Men';
      case 'women':
        return 'Women';
      case 'kids':
        return 'Kids';
      case 'cosmetics_beauty':
        return 'Cosmetics & Beauty';
      default:
        return 'Brands';
    }
  }, [selectedAudience]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#090966" size={20} />
        </TouchableOpacity>
        <Text style={styles.title}>{audienceTitle}</Text>
      </View>

      <View style={styles.sortChipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortChipsContent}
        >
          {[
            { id: 'popular', label: 'Popular' },
            { id: 'new', label: 'New' },
            { id: 'top_rated', label: 'Top Rated' },
            { id: 'followers', label: 'Followers' },
          ].map((chip) => {
            const active = sortMode === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSortMode(chip.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.sortChipText, active && styles.sortChipTextActive]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {brands.length === 0 && !loading ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyText}>No brands available yet.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={sortedBrands}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            onRefresh={loadBrands}
            refreshing={loading}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </SafeAreaView>
  );
};

export default AllBrandsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FF',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap:8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#090966',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 12,
    marginBottom: 15,
    //  gap:12,
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
    backgroundColor: '#EEF2FF',
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
    color: '#090966',
  },
  cardInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#090966',
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
    justifyContent: 'center',
  },
  followButton: {
    backgroundColor: '#090966',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
  },
  followButtonActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#090966',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  followButtonTextActive: {
    color: '#090966',
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9ca3af',
  },
  sortChipsRow: {
    marginBottom: 12,
  },
  sortChipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: '#090966',
    borderColor: '#090966',
  },
  sortChipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
});
