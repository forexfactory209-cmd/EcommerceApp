import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, Dimensions, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { 
  ChevronLeft, 
  Search, 
  Heart, 
  Star, 
  ShoppingBag, 
  TrendingUp, 
  Users, 
  MapPin,
  Crown,
  Sparkles,
  Filter,
  Grid3X3,
  List
} from 'lucide-react-native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const BRAND_COLOR = '#090966';
const PRIMARY_COLOR = '#090966';

const FollowedStoresScreen = ({ navigation }) => {
  const followedBrandIds = useStore((state) => state.followedBrandIds || []);
  const loadFollowedBrands = useStore((state) => state.loadFollowedBrands);

  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

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

      // Check which brands have products
      const brandsWithProductCount = await Promise.all(
        (Array.isArray(data) ? data : []).map(async (brand) => {
          const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brand.id);
          
          return {
            ...brand,
            hasProducts: count > 0,
            productCount: count
          };
        })
      );

      setBrands(brandsWithProductCount);
    } catch (e) {
      console.warn('FollowedStores: unexpected error loading brands', e.message || e);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [followedBrandIds]);

  useEffect(() => {
    loadFollowedBrands?.();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
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

  const renderListItem = ({ item, index }) => {
    const rating = typeof item.rating_average === 'number' ? item.rating_average : null;
    const followers = typeof item.followers_count === 'number' ? item.followers_count : null;

    return (
      <TouchableOpacity
        style={styles.storeCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Brand', { brandId: item.id, brand: item })}
      >
        <View style={styles.cardContent}>
          <View style={styles.storeHeader}>
            <View style={styles.storeInfo}>
              <View style={styles.logoContainer}>
                {item.logo_url ? (
                  <Image
                    source={{ uri: item.logo_url }}
                    style={styles.storeLogo}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Text style={styles.logoInitial}>
                      {(item.name || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.storeDetails}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {item.name || 'Store'}
                </Text>
                {item.category && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.storeStats}>
            <View style={styles.statItem}>
              <Star size={14} color={rating ? '#FBBF24' : '#D1D5DB'} fill={rating ? '#FBBF24' : 'transparent'} />
              <Text style={styles.statText}>{rating ? rating.toFixed(1) : 'New'}</Text>
            </View>
            {followers != null && followers > 0 && (
              <View style={styles.statItem}>
                <Users size={14} color="#6B7280" />
                <Text style={styles.statText}>{followers.toLocaleString()}</Text>
              </View>
            )}
            <View style={styles.statItem}>
              <MapPin size={14} color="#10B981" />
              <Text style={styles.statText}>Active</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            {item.hasProducts && (
              <View style={styles.quickInfo}>
                <ShoppingBag size={14} color={PRIMARY_COLOR} />
                <Text style={styles.quickInfoText}>Products Available</Text>
              </View>
            )}
            {item.hasProducts && (
              <ChevronLeft size={16} color={PRIMARY_COLOR} style={{ transform: [{ rotate: '180deg' }] }} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGridItem = ({ item, index }) => {
    const rating = typeof item.rating_average === 'number' ? item.rating_average : null;

    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Brand', { brandId: item.id, brand: item })}
      >
        <View style={styles.gridCardContent}>
          <View style={styles.gridLogoContainer}>
            {item.logo_url ? (
              <Image
                source={{ uri: item.logo_url }}
                style={styles.gridLogo}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.gridLogoPlaceholder}>
                <Text style={styles.gridLogoInitial}>
                  {(item.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.gridInfo}>
            <Text style={styles.gridStoreName} numberOfLines={1}>
              {item.name || 'Store'}
            </Text>
            {item.category && (
              <Text style={styles.gridCategory} numberOfLines={1}>
                {item.category}
              </Text>
            )}
            <View style={styles.gridStats}>
              {rating && (
                <View style={styles.gridStat}>
                  <Star size={12} color="#FBBF24" fill="#FBBF24" />
                  <Text style={styles.gridStatText}>{rating.toFixed(1)}</Text>
                </View>
              )}
              {item.hasProducts && (
                <View style={styles.gridStat}>
                  <ShoppingBag size={12} color={PRIMARY_COLOR} />
                  <Text style={styles.gridStatText}>Available</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_COLOR} />
      
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favorite Stores</Text>
        <TouchableOpacity
          style={styles.viewModeButton}
          onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
        >
          {viewMode === 'list' ? <Grid3X3 size={20} color="#FFFFFF" /> : <List size={20} color="#FFFFFF" />}
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6B7280" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your favorite stores..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearButton}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your favorite stores...</Text>
        </View>
      ) : filteredBrands.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Heart size={48} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>No favorite stores yet</Text>
          <Text style={styles.emptySubtitle}>
            Start following stores to see them here and get updates on new products
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('AllBrands')}
          >
            <Sparkles size={18} color="#FFFFFF" />
            <Text style={styles.exploreButtonText}>Explore Stores</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          {viewMode === 'list' ? (
            <FlatList
              data={filteredBrands}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderListItem}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <FlatList
              data={filteredBrands}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderGridItem}
              contentContainerStyle={styles.gridContainer}
              showsVerticalScrollIndicator={false}
              numColumns={2}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

export default FollowedStoresScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: BRAND_COLOR,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewModeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  clearButton: {
    fontSize: 16,
    color: '#6B7280',
    paddingHorizontal: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  gridContainer: {
    paddingBottom: 20,
    gap: 12,
  },
  storeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardContent: {
    padding: 16,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  storeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  storeLogo: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
  },
  logoInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storeDetails: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  brandCategory: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  categoryBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  followButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  followIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  storeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  quickInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickInfoText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  quickInfoTextEmpty: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  shopButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gridCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  gridCardContent: {
    padding: 12,
  },
  gridLogoContainer: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
    position: 'relative',
  },
  gridLogo: {
    width: '100%',
    height: '100%',
  },
  gridLogoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
  },
  gridLogoInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  followBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  gridInfo: {
    flex: 1,
  },
  gridStoreName: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginBottom: 2,
  },
  gridCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  gridStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  gridStatText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
