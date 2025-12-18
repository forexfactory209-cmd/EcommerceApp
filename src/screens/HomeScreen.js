import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, StyleSheet, Alert, Dimensions, Modal, Animated } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ShoppingBag, Heart, Bell, Star, Mic } from 'lucide-react-native';
import { useStore } from '../store/store';
import { fetchManyProductRatingSummaries } from '../services/ratings';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';
import { fetchProductsFromSupabase } from '../services/products';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const windowWidth = Dimensions.get('window').width;

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
  const deletedProductIds = useStore((state) => state.deletedProductIds || []);
  const cartCount = useStore((state) => state.cart.length || 0);
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
  const [searchMode, setSearchMode] = useState('text');
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [pendingCategory, setPendingCategory] = useState('all');
  const categorySlide = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = visible

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

  useEffect(() => {
    Animated.timing(categorySlide, {
      toValue: categorySheetVisible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [categorySheetVisible, categorySlide]);

  const rawBaseProducts = (remoteProducts.length > 0 ? remoteProducts : products) || [];
  const baseProducts = rawBaseProducts.filter((p) => !deletedProductIds.includes(p.id));

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

  const trendingProducts = useMemo(() => {
    if (!Array.isArray(baseProducts)) return [];
    return baseProducts.slice(0, 5);
  }, [baseProducts]);

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
  
  const getProductThumbUri = (item) => {
    if (item.image_thumb_url) return item.image_thumb_url;
    if (item.image_full_url) return item.image_full_url;
    return item.image || '';
  };

  // Use a stronger, full image for the main product cards on HomeScreen
  const getProductCardUri = (item) => {
    if (item.image_full_url) return item.image_full_url;
    if (item.image) return item.image;
    if (item.image_thumb_url) return item.image_thumb_url;
    return '';
  };

  const getBrandLogoThumbUri = (brand) => {
    // Helper to turn any storage object URL into a square, contained CDN image
    const toSquareCdn = (url) => {
      if (!url) return '';
      if (url.includes('/storage/v1/object/')) {
        return url
          .replace('/storage/v1/object/', '/storage/v1/render/image/')
          .concat('?width=200&height=200&resize=contain&quality=80');
      }
      return url;
    };

    // Prefer an explicit full logo URL, but render it as a square contained image when possible
    if (brand.logo_full_url) {
      return toSquareCdn(brand.logo_full_url);
    }

    // Next, derive a square CDN-rendered image from the raw storage logo_url
    if (brand.logo_url) {
      return toSquareCdn(brand.logo_url);
    }

    // Fall back to any stored thumbnail URL
    if (brand.logo_thumb_url) return brand.logo_thumb_url;

    return '';
  };

  const renderProduct = ({ item }) => {
    const inWishlist = wishlist.some((w) => w.id === item.id);
    const stats = ratingStats[item.id];
    const rating = stats?.avg ?? 0;
    const ratingCount = stats?.count ?? 0;
    const isOutOfStock = Number(item.quantity) === 0;

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
          <Image
            source={{ uri: getProductCardUri(item) }}
            style={styles.productImage}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
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
          {isOutOfStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockBadgeText}>Out of stock</Text>
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
      <Modal
        visible={categorySheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategorySheetVisible(false)}
      >
        <SafeAreaView style={styles.categoryModalOverlay}>
          <Animated.View
            style={[
              styles.categoryModalContent,
              {
                transform: [
                  {
                    translateX: categorySlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-windowWidth * 0.75, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.categoryModalTitle}>Categories</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.categoryModalList}
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
                const active = pendingCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryModalItem, active && styles.categoryModalItemActive]}
                    onPress={() => setPendingCategory(cat.id)}
                  >
                    <Text
                      style={[styles.categoryModalItemText, active && styles.categoryModalItemTextActive]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.categoryModalApplyButton}
              onPress={() => {
                setSelectedCategory(pendingCategory);
                setCategorySheetVisible(false);
              }}
            >
              <Text style={styles.categoryModalApplyText}>Apply</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={styles.categoryModalBackdrop}
            activeOpacity={1}
            onPress={() => setCategorySheetVisible(false)}
          />
        </SafeAreaView>
      </Modal>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBarRow}>
          <TouchableOpacity
            style={styles.categoryIconButton}
            activeOpacity={0.85}
            onPress={() => {
              setPendingCategory(selectedCategory);
              setCategorySheetVisible(true);
            }}
          >
            <View style={styles.categoryIconInnerCircle} />
          </TouchableOpacity>

          <Text style={styles.exploreTitleTop}>Explore</Text>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.roundIconButton}
              onPress={() => {
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
            {/* <TouchableOpacity
              style={styles.roundIconButton}
              onPress={() => navigation.navigate('Cart')}
              activeOpacity={0.85}
            >
              <View>
                <ShoppingBag color="#111827" size={20} />
                {cartCount > 0 && (
                  <View style={styles.topCartBadge}>
                    <Text style={styles.topCartBadgeText}>
                      {cartCount > 9 ? '9+' : cartCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity> */}
          </View>
        </View>

        {/* <View style={styles.headerRow}>
          <View>
            <Text style={styles.helloTitle}>
              {userName ? `Hi, ${userName}` : 'Discover style'}
            </Text>
            <Text style={styles.helloSubtitle}>
              Shop the latest drops and trending picks
            </Text>
          </View>
        </View> */}

        <View style={styles.searchCard}>
          <View style={styles.searchModeRow}>
            <TouchableOpacity
              style={[styles.searchModeChip, searchMode === 'text' && styles.searchModeChipActive]}
              onPress={() => setSearchMode('text')}
            >
              <Text
                style={[styles.searchModeText, searchMode === 'text' && styles.searchModeTextActive]}
              >
                Search
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchModeChip, searchMode === 'code' && styles.searchModeChipActive]}
              onPress={() => setSearchMode('code')}
            >
              <Text
                style={[styles.searchModeText, searchMode === 'code' && styles.searchModeTextActive]}
              >
                Product code
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Search color="gray" size={20} />
              <TextInput
                placeholder={searchMode === 'code' ? 'Enter product code' : 'Search products'}
                style={styles.searchInput}
                value={searchMode === 'code' ? searchCode : searchQuery}
                onChangeText={(text) => {
                  if (searchMode === 'code') {
                    setSearchCode(text);
                  } else {
                    setSearchQuery(text);
                  }
                }}
                autoCapitalize={searchMode === 'code' ? 'characters' : 'none'}
              />
            </View>
            <TouchableOpacity
              style={styles.micButton}
              activeOpacity={0.85}
              onPress={() => {
                if (searchMode === 'code') {
                  handleFindByCode();
                }
              }}
            >
              <Search color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>
{/* 
          <View style={styles.headerCategoriesRow}>
            <TouchableOpacity
              style={styles.headerCategoryButton}
              onPress={() => navigation.navigate('AllProducts', { openCategories: true })}
            >
              <Text style={styles.headerCategoryText}>Categories</Text>
            </TouchableOpacity>
          </View> */}
        </View>

        {trendingProducts.length > 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Trending products</Text>
            </View>
            <ScrollView
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
                      style={styles.trendingImageBackground}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={250}
                    />
                  ) : null}
                  <View style={styles.trendingGradientOverlay} />
                  <View style={styles.trendingGradientBottom} />
                  <View style={styles.trendingContent}>
                    <Text style={styles.trendingTitle} numberOfLines={1}>
                      New Collection
                    </Text>
                    <Text style={styles.trendingSubtitle} numberOfLines={2}>
                      Hore U Adeego
                    </Text>
                    <TouchableOpacity
                      style={styles.trendingButton}
                      onPress={() => navigation.navigate('ProductDetails', { product: item })}
                    >
                      <Text style={styles.trendingButtonText}>Shop now</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.trendingDotsRow}>
              {trendingProducts.map((_, index) => {
                const active = index === trendingIndex;
                return <View key={index} style={[styles.trendingDot, active && styles.trendingDotActive]} />;
              })}
            </View>
          </View>
        )}

        {/* Audience Filters */}
        {/* <View style={{ marginBottom: 24 }}>
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
        </View> */}

        {/* Your products - only visible for brand users */}
        {(userType === 'brand' || authRole === 'brand') && myBrandProducts.length > 0 && (
          <>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Your Products</Text>
            </View>
            <View style={styles.productsGrid}>
              {myBrandProducts.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.productWrapper}>
                  {renderProduct({ item })}
                </View>
              ))}
            </View>
          </>
        )}

        {userType !== 'brand' && authRole !== 'admin' && brands.length > 0 && (
          <>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Top brands</Text>
              {brands.length > 8 && (
                <TouchableOpacity onPress={() => navigation.navigate('AllBrands')}>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.brandsScroll}
              contentContainerStyle={styles.brandsRow}
            >
              {brands.slice(0, 8).map((brand, index) => (
                <TouchableOpacity
                  key={`${brand.id}-${index}`}
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
                            getBrandLogoThumbUri(brand) ||
                            (authRole === 'brand' && brand.user_id === authUserId && brandLogoUrl) ||
                            '',
                        }}
                        style={styles.brandLogo}
                        contentFit="contain"
                        cachePolicy="disk"
                        transition={200}
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

        {userType !== 'brand' && authRole !== 'brand' && (
          <>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Popular products</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllProducts')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

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

            <View style={styles.productsGrid}>
              {filteredProducts.map((item, index) => (
                <View key={`${item.id}-${index}`} style={styles.productWrapper}>
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
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundIconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginLeft: 2,
    marginRight: 8,
  },
  menuLines: {
    width: 18,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  menuLine: {
    height: 2,
    borderRadius: 999,
    backgroundColor: '#111827',
    width: 18,
    marginVertical: 2,
  },
  menuLineShort: {
    width: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  helloTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  helloSubtitle: {
    marginTop: 4,
    color: '#9ca3af',
    fontSize: 14,
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
  topCartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCartBadgeText: {
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6', // gray-100
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    flex: 1,
  },
  micButton: {
    marginLeft: 12,
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  // Inner logo circle used in Top brands row (slightly smaller than outer to create ring)
  brandLogo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
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
  brandsRow: {
    paddingLeft: 2,
    paddingRight: 8,
  },
  brandItem: {
    marginRight: 12,
    alignItems: 'center',
  },
  // Outer dark circle behind brand logos in Top brands row (creates the ring effect)
  brandIconWrapper: {
    width: 72,
    height: 72,
    backgroundColor: '#111827',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  brandIconText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#111827',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4b5563', // gray-600
    marginTop: 6,
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
    marginBottom: 18,
  },
  productCard: {
    width: '100%',
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
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
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
  outOfStockBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(17,24,39,0.9)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  outOfStockBadgeText: {
    color: '#F9FAFB',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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
  productBrand: {
    color: '#9ca3af', // gray-400
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
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  productFooterRow: {
    marginTop: 8,
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
  categoryIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  categoryIconInnerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#111827',
  },
  categoryModalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  categoryModalBackdrop: {
    flex: 1,
  },
  categoryModalContent: {
    width: '75%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  categoryModalList: {
    flexGrow: 0,
    maxHeight: 300,
    marginBottom: 16,
  },
  categoryModalItem: {
    paddingVertical: 10,
    borderRadius: 999,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  categoryModalItemActive: {
    backgroundColor: '#111827',
  },
  categoryModalItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  categoryModalItemTextActive: {
    color: '#ffffff',
  },
  categoryModalApplyButton: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryModalApplyText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  exploreTitleTop: {
    fontSize: 23,
    fontWeight: '700',
    color: '#111827',
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
    marginTop: 22,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchModeRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchModeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  searchModeChipActive: {
    backgroundColor: '#111827',
  },
  searchModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  searchModeTextActive: {
    color: '#ffffff',
  },
  headerCategoriesRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  headerCategoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  headerCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
   
  },
  trendingSection: {
    marginBottom: 24,
  },
  trendingCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 24,
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    height: 190,
  },
  trendingImageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  trendingGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17,24,39,0.6)',
  },
  
  trendingContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
    justifyContent: 'flex-end',
  },
  trendingTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  trendingSubtitle: {
    color: '#E5E7EB',
    fontSize: 13,
    marginBottom: 14,
  },
  trendingButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  trendingButtonText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 13,
  },
  // trendingImageWrapper and trendingImage are no longer used in the new full-background layout
  trendingDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  trendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 3,
  },
  trendingDotActive: {
    backgroundColor: '#7C3AED',
  },
});
