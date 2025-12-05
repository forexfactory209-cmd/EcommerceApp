import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, TextInput, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ShoppingBag, Heart, Bell, Star } from 'lucide-react-native';
import { useStore } from '../store/store';
import { fetchManyProductRatingSummaries } from '../services/ratings';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';
import { fetchProductsFromSupabase } from '../services/products';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const HomeScreen = ({ navigation }) => {
  const products = useStore((state) => state.products);
  const wishlist = useStore((state) => state.wishlist);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const userName = useStore((state) => state.userName);
  const userType = useStore((state) => state.userType);
  const authRole = useStore((state) => state.authRole);
  const brandLogoUrl = useStore((state) => state.brandLogoUrl);
  const authUserId = useStore((state) => state.authUserId);
  const setBrandLogoUrl = useStore((state) => state.setBrandLogoUrl);
  const loadFollowedBrands = useStore((state) => state.loadFollowedBrands);
  const [searchCode, setSearchCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteProducts, setRemoteProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [ratingStats, setRatingStats] = useState({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAudience, setSelectedAudience] = useState('all');

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

  const loadUnreadNotifications = useCallback(async () => {
    try {
      if (!authUserId) {
        setUnreadNotifications(0);
        return;
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authUserId)
        .eq('is_read', false);

      if (error) {
        console.warn('Failed to load unread notifications count', error.message || error);
        return;
      }

      setUnreadNotifications(count || 0);
    } catch (e) {
      console.warn('Failed to load unread notifications count', e.message || e);
    }
  }, [authUserId]);

  const loadBrands = useCallback(async () => {
    try {
      setBrandsLoading(true);
      const data = await fetchApprovedBrandsFromSupabase();
      if (Array.isArray(data)) {
        setBrands(data);
      }
    } catch (e) {
      console.warn('Supabase brands error', e.message || e);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadBrands();
      loadUnreadNotifications();
    }, [loadProducts, loadBrands]),
  );

  useEffect(() => {
    const loadBrandLogoForAvatar = async () => {
      try {
        if (authRole !== 'brand') return;
        if (!authUserId) return;
        if (brandLogoUrl) return;

        const { data, error } = await supabase
          .from('brands')
          .select('logo_url')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('Failed to load brand logo for avatar', error.message || error);
          return;
        }

        if (data?.logo_url) {
          setBrandLogoUrl(data.logo_url);
        }
      } catch (e) {
        console.warn('Failed to load brand logo for avatar', e.message || e);
      }
    };

    loadBrandLogoForAvatar();
  }, [authRole, authUserId, brandLogoUrl, setBrandLogoUrl]);

  useEffect(() => {
    if (authUserId) {
      loadFollowedBrands();
    }
  }, [authUserId, loadFollowedBrands]);

  useEffect(() => {
    // Reload unread notifications when auth user changes
    loadUnreadNotifications();
  }, [authUserId, loadUnreadNotifications]);

  const baseProducts = (remoteProducts.length > 0 ? remoteProducts : products) || [];

  const filterByCategory = (item) => {
    if (selectedCategory === 'all') return true;

    const explicit = (item.category || '').toString().toLowerCase();
    if (explicit) {
      if (selectedCategory === 'clothes') return explicit === 'clothes';
      if (selectedCategory === 'shoes') return explicit === 'shoes';
      if (selectedCategory === 'coats') return explicit === 'coats';
      if (selectedCategory === 'phones') return explicit === 'phones';
      if (selectedCategory === 'laptops') return explicit === 'laptops';
      if (selectedCategory === 'bags') return explicit === 'bags';
    }

    const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();

    switch (selectedCategory) {
      case 'clothes':
        return (
          text.includes('shirt') ||
          text.includes('t-shirt') ||
          text.includes('hoodie') ||
          text.includes('dress') ||
          text.includes('coat') ||
          text.includes('jacket')
        );
      case 'shoes':
        return (
          text.includes('shoe') ||
          text.includes('sneaker') ||
          text.includes('boots') ||
          text.includes('trainer')
        );
      case 'coats':
        return text.includes('coat') || text.includes('jacket');
      case 'phones':
        return text.includes('phone') || text.includes('iphone') || text.includes('galaxy');
      case 'laptops':
        return text.includes('laptop') || text.includes('macbook') || text.includes('notebook');
      case 'bags':
        return text.includes('bag') || text.includes('backpack') || text.includes('handbag');
      default:
        return true;
    }
  };

  const filterByAudience = (item) => {
    if (selectedAudience === 'all') return true;

    const explicit = (item.audience || '').toString().toLowerCase();
    if (explicit) {
      if (selectedAudience === 'men') return explicit === 'men';
      if (selectedAudience === 'women') return explicit === 'women';
      if (selectedAudience === 'kids') return explicit === 'kids';
      if (selectedAudience === 'all') return true;
    }

    const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();

    if (selectedAudience === 'men') {
      return text.includes("men's") || text.includes('men ') || text.includes('male');
    }
    if (selectedAudience === 'women') {
      return text.includes("women's") || text.includes('women ') || text.includes('female') || text.includes('lady');
    }
    if (selectedAudience === 'kids') {
      return text.includes('kid') || text.includes('child') || text.includes('children') || text.includes('boys') || text.includes('girls');
    }

    return true;
  };

  const filterBySearch = (item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const name = (item.name || '').toString().toLowerCase();
    return name.includes(q);
  };

  const filteredProducts = baseProducts.filter(
    (item) => filterByCategory(item) && filterByAudience(item) && filterBySearch(item),
  );

  const myBrandProducts = useMemo(() => {
    const isBrandUser = userType === 'brand' || authRole === 'brand';
    if (!isBrandUser || !authUserId) return [];

    const currentBrand = (brands || []).find((b) => b.user_id === authUserId) || null;
    const currentBrandName = (currentBrand?.name || '').toString();

    return baseProducts.filter((p) => {
      const owned = (() => {
        if (p.brand_user_id && p.brand_user_id === authUserId) {
          return true;
        }

        if (!p.brand_user_id && currentBrandName) {
          return (p.brand || '') === currentBrandName;
        }

        return false;
      })();

      if (!owned) return false;

      // Apply same filters as main grid
      return filterByCategory(p) && filterByAudience(p) && filterBySearch(p);
    });
  }, [baseProducts, brands, userType, authRole, authUserId, filterByCategory, filterByAudience, filterBySearch]);

  const brandDiscountLookup = useMemo(() => {
    const map = {};

    (brands || []).forEach((b) => {
      const raw = b && typeof b.discount_percentage === 'number' ? b.discount_percentage : null;
      if (raw == null) return;

      const value = Number(raw);
      if (Number.isNaN(value) || value <= 0 || value >= 100) return;

      if (b.user_id) {
        map[`user:${b.user_id}`] = value;
      }
      if (b.name) {
        map[`name:${b.name}`] = value;
      }
    });

    return map;
  }, [brands]);

  useEffect(() => {
    const loadRatingStats = async () => {
      try {
        const ids = baseProducts
          .filter((item) => filterByCategory(item) && filterByAudience(item) && filterBySearch(item))
          .map((p) => p.id)
          .filter(Boolean);

        if (ids.length === 0) {
          setRatingStats({});
          return;
        }

        const result = await fetchManyProductRatingSummaries(ids);
        setRatingStats(result || {});
      } catch (e) {
        console.warn('Failed to load rating stats', e.message || e);
      }
    };

    loadRatingStats();
  }, [baseProducts, selectedCategory, selectedAudience, searchQuery]);

  const handleFindByCode = () => {
    const trimmed = searchCode.trim();
    if (!trimmed) return;

    const target = trimmed.toUpperCase();
    const list = remoteProducts.length > 0 ? remoteProducts : products;
    const product = list.find(
      (p) => (p.code || '').toString().toUpperCase() === target,
    );

    if (product) {
      navigation.navigate('ProductDetails', { product });
      setSearchCode('');
    } else {
      Alert.alert('Not found', 'No product found for this code.');
    }
  };
  
  const renderProduct = ({ item }) => {
    const inWishlist = wishlist.some((w) => w.id === item.id);
    const stats = ratingStats[item.id];
    const rating = stats?.avg ?? 0;
    const ratingCount = stats?.count ?? 0;

    const currentPrice = Number(item.price) || 0;
    const flashPrice =
      item.flash_price != null && item.flash_price !== ''
        ? Number(item.flash_price)
        : null;

    let isFlashActive = false;
    if (flashPrice != null && !Number.isNaN(flashPrice) && flashPrice > 0) {
      try {
        const now = new Date();
        const start = item.flash_start_at ? new Date(item.flash_start_at) : null;
        const end = item.flash_end_at ? new Date(item.flash_end_at) : null;
        const hasQty = item.flash_quantity != null;
        const sold = Number(item.flash_sold) || 0;
        const qtyOk = !hasQty || sold < item.flash_quantity;

        if (start && end && qtyOk && start <= now && end > now) {
          isFlashActive = true;
        }
      } catch (e) {
        // ignore date parse errors
      }
    }

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
            <Heart
              size={18}
              color={inWishlist ? '#ef4444' : '#9ca3af'}
              fill={inWishlist ? '#ef4444' : 'transparent'}
            />
          </TouchableOpacity>
          {isFlashActive && (
            <View style={styles.flashBadge}>
              <Text style={styles.flashBadgeText}>Flash Sale</Text>
            </View>
          )}
        </View>
        <Text style={styles.productBrand}>{item.brand}</Text>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.productFooterRow}>
          <View style={styles.productRatingRow}>
            <Star
              size={14}
              color={rating ? '#FBBF24' : '#D1D5DB'}
              fill={rating ? '#FBBF24' : 'transparent'}
            />
            <Text style={styles.productRatingText}>
              {rating ? rating.toFixed(1) : '0.0'}
              {ratingCount > 0 ? ` (${ratingCount})` : ''}
            </Text>
          </View>
          {(() => {
            if (isFlashActive && flashPrice != null && flashPrice > 0) {
              const original = currentPrice > 0 ? currentPrice : flashPrice;
              return (
                <View style={styles.productPriceCol}>
                  <Text style={styles.productPriceOriginal}>${original.toFixed(2)}</Text>
                  <Text style={styles.productPriceDiscount}>${flashPrice.toFixed(2)}</Text>
                </View>
              );
            }

            const byUser = item.brand_user_id
              ? brandDiscountLookup[`user:${item.brand_user_id}`]
              : null;
            const byName = !byUser && item.brand
              ? brandDiscountLookup[`name:${item.brand}`]
              : null;
            const discount = byUser != null ? byUser : byName;

            if (!discount || currentPrice <= 0) {
              return <Text style={styles.productPrice}>${currentPrice.toFixed(2)}</Text>;
            }

            const factor = 1 - discount / 100;
            if (factor <= 0) {
              return <Text style={styles.productPrice}>${currentPrice.toFixed(2)}</Text>;
            }

            const originalPrice = Number((currentPrice / factor).toFixed(2));

            return (
              <View style={styles.productPriceCol}>
                <Text style={styles.productPriceOriginal}>${originalPrice.toFixed(2)}</Text>
                <Text style={styles.productPriceDiscount}>${currentPrice.toFixed(2)}</Text>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.titleText}>{userName || 'Discover Store'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                // Optimistically clear badge, NotificationsScreen will mark as read
                setUnreadNotifications(0);
                navigation.navigate('Notifications');
              }}
            >
              <View>
                <Bell color="#111827" size={20} />
                {unreadNotifications > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={() => navigation.navigate('Profile')}
            >
              <Image
                source={{
                  uri:
                    authRole === 'brand' && brandLogoUrl
                      ? brandLogoUrl
                      : 'https://randomuser.me/api/portraits/men/32.jpg',
                }}
                style={styles.avatarImage}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Supabase debug info */}
        <Text style={{ color: '#6b7280', marginBottom: 8, fontSize: 12 }}>
          Supabase products: {remoteProducts.length} (loading: {loading ? 'yes' : 'no'})
        </Text>

        {/* Code Search */}
        <View style={styles.codeSearchRow}>
          <TextInput
            style={styles.codeInput}
            placeholder="Enter product code"
            value={searchCode}
            onChangeText={setSearchCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity style={styles.codeButton} onPress={handleFindByCode}>
            <Text style={styles.codeButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search color="gray" size={20} />
          <TextInput
            placeholder="Search products..."
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories */}
        <View style={{ marginBottom: 16 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'clothes', label: 'Clothes' },
              { id: 'shoes', label: 'Shoes' },
              { id: 'coats', label: 'Coats' },
              { id: 'phones', label: 'Phones' },
              { id: 'laptops', label: 'Laptops' },
              { id: 'bags', label: 'Bags' },
            ].map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Text
                    style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Audience Filters */}
        <View style={{ marginBottom: 24 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.audienceRow}
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'men', label: 'Men' },
              { id: 'women', label: 'Women' },
              { id: 'kids', label: 'Kids' },
            ].map((aud) => {
              const active = selectedAudience === aud.id;
              return (
                <TouchableOpacity
                  key={aud.id}
                  onPress={() => setSelectedAudience(aud.id)}
                  style={[styles.audienceChip, active && styles.audienceChipActive]}
                >
                  <Text
                    style={[styles.audienceChipText, active && styles.audienceChipTextActive]}
                  >
                    {aud.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Your products - only visible for brand users */}
        {(userType === 'brand' || authRole === 'brand') && myBrandProducts.length > 0 && (
          <>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Your Products</Text>
            </View>
            <View style={styles.productsGrid}>
              {myBrandProducts.map((item) => (
                <View key={item.id} style={styles.productWrapper}>
                  {renderProduct({ item })}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Brands - only visible for normal customers (not brand, not admin) */}
        {userType !== 'brand' && authRole !== 'admin' && brands.length > 0 && (
          <>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Popular Brands</Text>
              {brands.length > 8 && (
                <TouchableOpacity onPress={() => navigation.navigate('AllBrands')}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandsScroll}>
              {brands.slice(0, 8).map((brand) => (
                <TouchableOpacity
                  key={brand.id}
                  style={styles.brandItem}
                  onPress={() => navigation.navigate('Brand', { brandId: brand.id, brand })}
                >
                  <View style={styles.brandIconWrapper}>
                    {(
                      brand.logo_url ||
                      (authRole === 'brand' && brand.user_id === authUserId && brandLogoUrl)
                    ) ? (
                      <Image
                        source={{
                          uri:
                            brand.logo_url ||
                            (authRole === 'brand' && brand.user_id === authUserId && brandLogoUrl) ||
                            '',
                        }}
                        style={styles.brandLogo}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.brandIconText}>
                        {(brand.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.brandName}>{brand.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Products Grid - hidden for brand users */}
        {userType !== 'brand' && authRole !== 'brand' && (
          <>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>New Arrivals</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllProducts')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.productsGrid}>
              {filteredProducts.map((item) => (
                <View key={item.id} style={styles.productWrapper}>
                  {renderProduct({ item })}
                </View>
              ))}
            </View>
          </>
        )}
        <View style={styles.bottomSpacer} /> 
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // gray-50
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginRight: 8,
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 999,
    backgroundColor: '#ef4444', // red-500
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  codeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  codeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  codeButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  welcomeText: {
    color: '#6b7280', // gray-500
    fontSize: 18,
  },
  titleText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827', // dark
  },
  avatarWrapper: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 999,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6', // gray-100
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  brandLogo: {
    width: 40,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  brandsScroll: {
    marginBottom: 32,
  },
  brandItem: {
    marginRight: 16,
    alignItems: 'center',
  },
  brandIconWrapper: {
    width: 64,
    height: 64,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  brandIconText: {
    fontWeight: '700',
    fontSize: 20,
    color: '#111827',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563', // gray-600
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#2563EB', // primary
    fontWeight: '700',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productWrapper: {
    width: '48%',
  },
  productCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
  flashBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flashBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  wishlistIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBrand: {
    color: '#9ca3af', // gray-400
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
  },
  productPriceCol: {
    alignItems: 'flex-end',
  },
  productPriceOriginal: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  productPriceDiscount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  productFooterRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productRatingText: {
    marginLeft: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  categoriesRow: {
    paddingHorizontal: 2,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  audienceRow: {
    paddingHorizontal: 2,
  },
  audienceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  audienceChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  audienceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  audienceChipTextActive: {
    color: '#ffffff',
  },
  bottomSpacer: {
    height: 80,
  },
});
