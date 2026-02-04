import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  SafeAreaView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Search, X, Menu, Bell, ArrowRight, Star, Heart, Plus, Package, ShoppingBag, Clock, TrendingUp, CheckCircle, BarChart3, Settings, Truck } from 'lucide-react-native';
import { useStore } from '../store/store';
import { fetchProductsFromSupabase } from '../services/products';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';
import { getFlashSaleState, getProductThumbUri, getProductCardUri } from '../utils/productHelpers';

const windowWidth = Dimensions.get('window').width;
const windowHeight = Dimensions.get('window').height;

// Brand colors
const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';
const SUCCESS_COLOR = '#10B981';
const BACKGROUND_COLOR = '#ffffff'; // Set background to white as in screenshot

const PRODUCTS_TTL_MS = 60000;
const BRANDS_TTL_MS = 60000;

const HomeScreen = ({ navigation }) => {
  const products = useStore((state) => state.products);
  const brands = useStore((state) => state.brands);
  const wishlist = useStore((state) => state.wishlist);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const setProducts = useStore((state) => state.setProducts);
  const setBrands = useStore((state) => state.setBrands);
  const authRole = useStore((state) => state.authRole);
  const authUserId = useStore((state) => state.authUserId);
  const userType = useStore((state) => state.userType);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [trendingIndex, setTrendingIndex] = useState(0);
  const productsLoadedAtRef = useRef(null);
  const brandsLoadedAtRef = useRef(null);
  const trendingScrollRef = useRef(null);
  const [unreadNotifications, setUnreadNotifications] = useState(3);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    if (!products.length) {
      try {
        await loadProducts({ reset: false });
      } catch (e) {
        console.error('Failed to load products for search:', e);
      }
    }

    const filtered = products.filter((product) => {
      const searchStr = query.toLowerCase();
      return (
        product.name?.toLowerCase().includes(searchStr) ||
        product.code?.toLowerCase().includes(searchStr) ||
        product.brand?.toLowerCase().includes(searchStr)
      );
    });

    if (filtered.length > 0) {
      navigation.navigate('AllProducts', {
        searchQuery: query,
        filteredProducts: filtered
      });
    } else {
      Alert.alert('No results', 'No products found matching your search.');
    }
  }, [searchQuery, products, navigation]);

  const loadProducts = useCallback(async ({ reset = false } = {}) => {
    try {
      const now = Date.now();
      if (!reset && productsLoadedAtRef.current && now - productsLoadedAtRef.current < PRODUCTS_TTL_MS) {
        return;
      }
      setLoading(true);
      const data = await fetchProductsFromSupabase();
      setProducts(data);
      productsLoadedAtRef.current = now;
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
    }
  }, [setProducts]);

  const loadBrands = useCallback(async ({ reset = false } = {}) => {
    try {
      const now = Date.now();
      if (!reset && brandsLoadedAtRef.current && now - brandsLoadedAtRef.current < BRANDS_TTL_MS) {
        return;
      }
      const data = await fetchApprovedBrandsFromSupabase();
      setBrands(data);
      brandsLoadedAtRef.current = now;
    } catch (e) {
      console.error('Failed to load brands:', e);
    }
  }, [setBrands]);

  useEffect(() => {
    loadProducts({ reset: false });
    loadBrands({ reset: false });
  }, [loadProducts, loadBrands]);

  const trendingProducts = products.slice(0, 5);

  const getBrandLogoThumbUri = (brand) => {
    if (brand.logo_full_url) return brand.logo_full_url;
    if (brand.logo_url) return brand.logo_url;
    if (brand.logo_thumb_url) return brand.logo_thumb_url;
    return '';
  };

  const renderListHeader = useMemo(() => (
    <View style={styles.listHeaderWrapper}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconButton}>
          <Menu color="#111827" size={24} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.appTitle}>Beegso</Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.headerIconButton}
        >
          <Bell color="#111827" size={24} />
          {unreadNotifications > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products or enter code"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending products</Text>
      </View>

      {trendingProducts.length > 0 && (
        <View style={styles.trendingContainer}>
          <ScrollView
            ref={trendingScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const index = Math.round(offsetX / (windowWidth - 32));
              setTrendingIndex(index);
            }}
          >
            {trendingProducts.map((item, index) => (
              <TouchableOpacity
                key={item.id || index}
                activeOpacity={0.9}
                style={[styles.trendingCard, { width: windowWidth - 32 }]}
                onPress={() => navigation.navigate('ProductDetails', { product: item })}
              >
                {item.image ? (
                  <Image
                    source={{ uri: getProductThumbUri(item) }}
                    style={styles.trendingImage}
                  />
                ) : null}
                <View style={styles.trendingOverlay} />
                <View style={styles.trendingContent}>
                  <Text style={styles.trendingHeadline}>New Collection</Text>
                  <Text style={styles.trendingSubtext}>Hore U Adeego</Text>
                  <TouchableOpacity
                    style={styles.shopNowButton}
                    onPress={() => navigation.navigate('ProductDetails', { product: item })}
                  >
                    <Text style={styles.shopNowText}>Shop now</Text>
                    <ArrowRight size={16} color="#090966" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.paginationRow}>
            {trendingProducts.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === trendingIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top brands</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AllBrands')}>
          <Text style={styles.seeAllText}>See all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.brandsContainer}
      >
        {brands.map((brand, index) => (
          <TouchableOpacity
            key={brand.id || index}
            style={styles.brandItem}
            onPress={() => navigation.navigate('Brand', { brandId: brand.id, brand })}
          >
            <View style={styles.brandRing}>
              <View style={styles.brandLogoContainer}>
                {brand.logo_url ? (
                  <Image
                    source={{ uri: getBrandLogoThumbUri(brand) }}
                    style={styles.brandLogo}
                  />
                ) : (
                  <Text style={styles.brandInitial}>
                    {(brand.name || 'B')[0].toUpperCase()}
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.brandName} numberOfLines={1}>
              {brand.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  ), [searchQuery, trendingIndex, brands, trendingProducts, unreadNotifications]);

  const renderProduct = useCallback(({ item }) => (
    <View style={styles.productWrapper}>
      <ProductCard
        item={item}
        navigation={navigation}
        wishlist={wishlist}
        addToWishlist={addToWishlist}
        removeFromWishlist={removeFromWishlist}
        getProductCardUri={getProductCardUri}
      />
    </View>
  ), [navigation, wishlist, addToWishlist, removeFromWishlist]);

  return (
    <SafeAreaView style={styles.container}>
      <FlashList
        data={products}
        renderItem={renderProduct}
        numColumns={2}
        estimatedItemSize={250}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const ProductCard = React.memo(({ item, navigation, wishlist, addToWishlist, removeFromWishlist, getProductCardUri }) => {
  const inWishlist = wishlist.some((w) => w.id === item.id);
  const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProductDetails', { product: item })}
    >
      <View style={styles.cardImageWrapper}>
        <Image source={{ uri: getProductCardUri(item) }} style={styles.cardImage} />
        <TouchableOpacity
          style={styles.wishlistBtn}
          onPress={() => inWishlist ? removeFromWishlist(item.id) : addToWishlist(item)}
        >
          <Heart
            size={18}
            color={inWishlist ? '#ef4444' : '#9ca3af'}
            fill={inWishlist ? '#ef4444' : 'transparent'}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardBrand}>{item.brand}</Text>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardPrice}>${currentPrice.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  listHeaderWrapper: {
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 5,
  },
  headerIconButton: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#090966',
    letterSpacing: -0.5,
  },
  notificationBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 15,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 55,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#090966',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090966',
  },
  trendingContainer: {
    paddingHorizontal: 16,
    marginBottom: 25,
  },
  trendingCard: {
    height: 200,
    borderRadius: 25,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 16,
  },
  trendingImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  trendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 102, 0.65)',
  },
  trendingContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  trendingHeadline: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 5,
  },
  trendingSubtext: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 15,
    opacity: 0.9,
  },
  shopNowButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  shopNowText: {
    color: '#090966',
    fontWeight: '800',
    fontSize: 14,
    marginRight: 8,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#6366f1',
    width: 8,
  },
  brandsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  brandItem: {
    alignItems: 'center',
    marginRight: 20,
    width: 80,
  },
  brandRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandLogoContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  brandInitial: {
    fontSize: 24,
    fontWeight: '900',
    color: '#090966',
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 40,
  },
  productWrapper: {
    width: '50%',
    padding: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardImageWrapper: {
    height: 180,
    backgroundColor: '#F9FAFB',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#ffffff',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  cardInfo: {
    padding: 12,
  },
  cardBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginVertical: 4,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#090966',
  },
});

export default HomeScreen;
