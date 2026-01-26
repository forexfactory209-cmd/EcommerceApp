import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, StyleSheet, Alert, Dimensions, Modal, Animated } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ShoppingBag, Heart, Bell, Star, Mic, Menu, Package, Truck, CheckCircle, Clock, Flame, Sparkles, LayoutGrid, Shirt, Footprints, ThermometerSnowflake, Smartphone, Laptop, ArrowRight } from 'lucide-react-native';
import { useStore } from '../store/store';
import { fetchManyProductRatingSummaries } from '../services/ratings';
import { fetchApprovedBrandsFromSupabase } from '../services/brands';
import { fetchProductsFromSupabase } from '../services/products';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getFlashSaleState } from '../utils/flashSale';

const windowWidth = Dimensions.get('window').width;

const PRODUCTS_TTL_MS = 60000; // 60 seconds
const BRANDS_TTL_MS = 60000;

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
  const orders = useStore((state) => state.orders || []); // still available for legacy flows
  const setBrandLogoUrl = useStore((state) => state.setBrandLogoUrl);
  const loadFollowedBrands = useStore((state) => state.loadFollowedBrands);
  const setProducts = useStore((state) => state.setProducts);
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
  const hotAnim = useRef(new Animated.Value(1)).current;
  const newAnim = useRef(new Animated.Value(0)).current;
  const productsLoadedAtRef = useRef(null);
  const brandsLoadedAtRef = useRef(null);
  const trendingScrollRef = useRef(null);
  const [brandOrderStats, setBrandOrderStats] = useState({
    todaysOrders: 0,
    pending: 0,
    newOrders: 0,
    packing: 0,
    shipped: 0,
    completed: 0,
  });

  const loadProducts = useCallback(async ({ reset = false } = {}) => {
    try {
      const now = Date.now();
      if (!reset && productsLoadedAtRef.current && now - productsLoadedAtRef.current < PRODUCTS_TTL_MS) {
        return;
      }

      setLoading(true);
      const data = await fetchProductsFromSupabase();
      if (Array.isArray(data) && data.length > 0) {
        setRemoteProducts(data);
        setProducts(data);
        productsLoadedAtRef.current = now;

        const urls = data
          .map((item) => getProductCardUri(item))
          .filter((u) => typeof u === 'string' && u.length > 0);

        urls.forEach((uri) => {
          Image.prefetch(uri);
        });
      }
    } catch (e) {
      Alert.alert('Supabase error', e.message || 'Failed to load products from Supabase');
    } finally {
      setLoading(false);
    }
  }, [setProducts]);

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
      const now = Date.now();
      if (brandsLoadedAtRef.current && now - brandsLoadedAtRef.current < BRANDS_TTL_MS) {
        return;
      }

      setBrandsLoading(true);
      const data = await fetchApprovedBrandsFromSupabase();
      if (Array.isArray(data)) {
        setBrands(data);
        brandsLoadedAtRef.current = now;

        const logoUrls = data
          .map((brand) => getBrandLogoThumbUri(brand))
          .filter((u) => typeof u === 'string' && u.length > 0);

        logoUrls.forEach((uri) => {
          Image.prefetch(uri);
        });
      }
    } catch (e) {
      console.warn('Supabase brands error', e.message || e);
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Run initial loads once when Home gains focus
      loadProducts({ reset: true });
      loadBrands();
      loadUnreadNotifications();
    }, []),
  );

  useEffect(() => {
    // Hot Animation: Pulse Scale
    Animated.loop(
      Animated.sequence([
        Animated.timing(hotAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(hotAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // New Animation: Wiggle / Rotate
    Animated.loop(
      Animated.sequence([
        Animated.timing(newAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(newAnim, {
          toValue: -1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(newAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    ).start();
  }, []);

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
    const isBrand = userType === 'brand' || authRole === 'brand';
    if (!isBrand || !authUserId) return;

    let cancelled = false;

    const loadBrandOrdersFromSupabase = async () => {
      try {
        // Derive brand orders from order_items so we always use the correct
        // brand_user_id attached to each item, not the legacy field on orders.
        const { data, error } = await supabase
          .from('order_items')
          .select(
            `
            id,
            order_id,
            brand_user_id,
            orders:orders (
              id,
              placed_at,
              brand_accepted_at,
              on_the_way_at,
              delivered_at
            )
          `,
          )
          .eq('brand_user_id', authUserId)
          .order('order_id', { ascending: false });

        if (error) {
          console.warn('Failed to load brand orders from Supabase', error.message || error);
          return;
        }

        const rows = Array.isArray(data) ? data : [];
        if (rows.length === 0) {
          console.warn('[BrandDashboard] No orders found for brand_user_id', authUserId);
        }
        const todayStr = new Date().toDateString();

        // Collapse potential duplicate rows per order id coming from order_items
        const byOrderId = rows.reduce((acc, row) => {
          const o = row.orders;
          if (!o) return acc;
          const orderId = o.id;
          if (!acc[orderId]) {
            acc[orderId] = o;
          }
          return acc;
        }, {});

        const uniqueOrders = Object.values(byOrderId);

        let todaysOrders = 0;
        let newOrders = 0;
        let pending = 0;
        let packing = 0;
        let shipped = 0;
        let completed = 0;

        uniqueOrders.forEach((o) => {
          const placedAt = o.placed_at ? new Date(o.placed_at) : null;
          const brandAcceptedAt = o.brand_accepted_at ? new Date(o.brand_accepted_at) : null;
          const onTheWayAt = o.on_the_way_at ? new Date(o.on_the_way_at) : null;
          const deliveredAt = o.delivered_at ? new Date(o.delivered_at) : null;

          if (placedAt && placedAt.toDateString() === todayStr) {
            todaysOrders += 1;
          }

          if (!brandAcceptedAt && !onTheWayAt && !deliveredAt) {
            // created but not accepted yet
            newOrders += 1;
            pending += 1;
            return;
          }

          if (brandAcceptedAt && !onTheWayAt && !deliveredAt) {
            // accepted / preparing
            packing += 1;
            return;
          }

          if (onTheWayAt && !deliveredAt) {
            // out for delivery
            shipped += 1;
            return;
          }

          if (deliveredAt) {
            completed += 1;
          }
        });

        if (!cancelled) {
          setBrandOrderStats({
            todaysOrders,
            pending,
            newOrders,
            packing,
            shipped,
            completed,
          });
        }
      } catch (e) {
        console.warn('Error loading brand orders from Supabase', e.message || e);
      }
    };

    loadBrandOrdersFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [userType, authRole, authUserId]);

  useEffect(() => {
    Animated.timing(categorySlide, {
      toValue: categorySheetVisible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [categorySheetVisible, categorySlide]);

  const rawBaseProducts = (remoteProducts.length > 0 ? remoteProducts : products) || [];
  const baseProducts = useMemo(
    () => rawBaseProducts.filter((p) => !deletedProductIds.includes(p.id)),
    [rawBaseProducts, deletedProductIds]
  );

  const filterByCategory = useCallback((item) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'hot') return true; // TODO: Implement hot logic
    if (selectedCategory === 'new') return true; // TODO: Implement new logic

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
  }, [selectedCategory]);

  const categories = useMemo(() => [
    { id: 'all', label: 'All', icon: LayoutGrid },
    { id: 'hot', label: 'Hot', icon: Flame, isAnimated: true, animValue: hotAnim, animStyle: 'scale', color: '#F97316' },
    { id: 'new', label: 'New', icon: Sparkles, isAnimated: true, animValue: newAnim, animStyle: 'rotate', color: '#8B5CF6' },
    { id: 'clothes', label: 'Clothes', icon: Shirt },
    { id: 'shoes', label: 'Shoes', icon: Footprints },
    { id: 'coats', label: 'Coats', icon: ThermometerSnowflake },
    { id: 'phones', label: 'Phones', icon: Smartphone },
    { id: 'laptops', label: 'Laptops', icon: Laptop },
    { id: 'bags', label: 'Bags', icon: ShoppingBag },
  ], [hotAnim, newAnim]);

  const filterByAudience = useCallback((item) => {
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
  }, [selectedAudience]);

  const filterBySearch = useCallback((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const name = (item.name || '').toString().toLowerCase();
    return name.includes(q);
  }, [searchQuery]);

  const filteredProducts = useMemo(
    () =>
      baseProducts.filter(
        (item) => filterByCategory(item) && filterByAudience(item) && filterBySearch(item),
      ),
    [baseProducts, filterByCategory, filterByAudience, filterBySearch],
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
    let isActive = true;

    const handle = setTimeout(async () => {
      try {
        // Only consider the currently visible filtered products, and cap the number of IDs
        const ids = filteredProducts
          .slice(0, 100)
          .map((p) => p.id)
          .filter(Boolean);

        if (!isActive) return;

        if (ids.length === 0) {
          setRatingStats({});
          return;
        }

        const result = await fetchManyProductRatingSummaries(ids);
        if (!isActive) return;
        setRatingStats(result || {});
      } catch (e) {
        if (isActive) {
          console.warn('Failed to load rating stats', e.message || e);
        }
      }
    }, 250); // debounce slightly so we don't refetch on every keystroke

    return () => {
      isActive = false;
      clearTimeout(handle);
    };
  }, [filteredProducts]);

  useEffect(() => {
    if (!trendingProducts.length) return;

    const interval = setInterval(() => {
      setTrendingIndex((prevIndices) => {
        let nextIndex = prevIndices + 1;
        if (nextIndex >= trendingProducts.length) {
          nextIndex = 0;
        }

        if (trendingScrollRef.current) {
          trendingScrollRef.current.scrollTo({
            x: nextIndex * (windowWidth - 32),
            animated: true,
          });
        }

        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [trendingProducts]);

  const handleFindByCode = useCallback(async () => {
    const trimmed = searchCode.trim();
    if (!trimmed) return;

    const target = trimmed.toUpperCase();

    // Ensure we have a fresh list of products at least once so that
    // a single tap on the search icon can immediately find the code.
    if (!remoteProducts.length && !products.length) {
      try {
        await loadProducts({ reset: false });
      } catch (e) {
        // If loading fails, we'll still fall back to whatever is in store.
      }
    }

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
  }, [searchCode, remoteProducts, products, loadProducts, navigation]);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    // Ensure we have products loaded
    if (!remoteProducts.length && !products.length) {
      try {
        await loadProducts({ reset: false });
      } catch (e) {
        // If loading fails, we'll still fall back to whatever is in store.
      }
    }

    // Search in both remote and local products
    const allProducts = [...remoteProducts, ...products];
    const filtered = allProducts.filter((product) => {
      const searchStr = query.toLowerCase();
      return (
        product.name?.toLowerCase().includes(searchStr) ||
        product.code?.toLowerCase().includes(searchStr) ||
        product.brand?.toLowerCase().includes(searchStr)
      );
    });

    if (filtered.length > 0) {
      // Navigate to filtered results or update state
      navigation.navigate('AllProducts', { 
        searchQuery: query,
        filteredProducts: filtered 
      });
    } else {
      Alert.alert('No results', 'No products found matching your search.');
    }
  }, [searchQuery, remoteProducts, products, loadProducts, navigation]);

  const getProductThumbUri = (item) => {
    const toThumbCdn = (url) => {
      if (!url) return '';
      if (url.includes('/storage/v1/object/')) {
        return url
          .replace('/storage/v1/object/', '/storage/v1/render/image/')
          .concat('?width=400&height=400&resize=contain&quality=75');
      }
      return url;
    };

    if (item.image_thumb_url) return toThumbCdn(item.image_thumb_url);
    if (item.image_full_url) return toThumbCdn(item.image_full_url);
    return toThumbCdn(item.image || '');
  };

  // Use a stronger, full image for the main product cards on HomeScreen
  const getProductCardUri = (item) => {
    const toProductCdn = (url) => {
      if (!url) return '';
      if (url.includes('/storage/v1/object/')) {
        return url
          .replace('/storage/v1/object/', '/storage/v1/render/image/')
          .concat('?width=720&height=720&resize=contain&quality=80');
      }
      return url;
    };

    if (item.image_full_url) return toProductCdn(item.image_full_url);
    if (item.image) return toProductCdn(item.image);
    if (item.image_thumb_url) return toProductCdn(item.image_thumb_url);
    return '';
  };

  const getBrandLogoThumbUri = (brand) => {
    // Use the raw URLs so anything that works in a browser also renders in the app.
    if (brand.logo_full_url) return brand.logo_full_url;
    if (brand.logo_url) return brand.logo_url;
    if (brand.logo_thumb_url) return brand.logo_thumb_url;
    return '';
  };
  const renderListHeader = useMemo(() => (
    <View style={styles.listHeaderWrapper}>
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
      <View style={styles.scroll}>
        <View style={styles.topBarRow}>
          <TouchableOpacity
            style={styles.categoryIconButton}
            activeOpacity={0.85}
            onPress={() => {
              setPendingCategory(selectedCategory);
              setCategorySheetVisible(true);
            }}
          >
            <Menu color="#111827" size={22} />
          </TouchableOpacity>

          <Text style={styles.exploreTitleTop}>Beegso</Text>

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

          </View>
        </View>


        <View style={styles.searchCard}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Search color="#9ca3af" size={18} style={styles.searchIcon} />
              <TextInput
                placeholder="Search products or enter code"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => {
                  if (searchQuery.trim()) {
                    handleSearch();
                  }
                }}
              />
            </View>
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              activeOpacity={0.8}
            >
              <Search color="#ffffff" size={16} />
            </TouchableOpacity>
          </View>
        </View>

        {authRole !== 'brand' && userType !== 'brand' && trendingProducts.length > 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Trending products</Text>
            </View>
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
                      activeOpacity={0.9}
                      onPress={() => navigation.navigate('ProductDetails', { product: item })}
                    >
                      <Text style={styles.trendingButtonText}>Shop now</Text>
                      <ArrowRight size={16} color="#090966" strokeWidth={2.5} />
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
                  <ProductCard
                    item={item}
                    navigation={navigation}
                    wishlist={wishlist}
                    ratingStats={ratingStats}
                    brandDiscountLookup={brandDiscountLookup}
                    authRole={authRole}
                    addToWishlist={addToWishlist}
                    removeFromWishlist={removeFromWishlist}
                    getProductCardUri={getProductCardUri}
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {userType !== 'brand' && authRole !== 'admin' && brands.length > 0 && (
          <>
            <View style={styles.productsHeader}>
              <Text style={styles.sectionTitle}>Top brands</Text>
              {brands.length > 0 && (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('AllBrandCategories', {
                      brands,
                    })
                  }
                >
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
              {brands.slice(0, 7).map((brand, index) => (
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
                {categories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  const IconComponent = cat.icon;

                  let iconStyle = {};
                  if (cat.isAnimated) {
                    if (cat.animStyle === 'scale') {
                      iconStyle = { transform: [{ scale: cat.animValue }] };
                    } else if (cat.animStyle === 'rotate') {
                      iconStyle = {
                        transform: [{
                          rotate: cat.animValue.interpolate({
                            inputRange: [-1, 1],
                            outputRange: ['-15deg', '15deg']
                          })
                        }]
                      }
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                        !active && cat.id === 'hot' && { borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }, // custom styles for Hot inactive
                        !active && cat.id === 'new' && { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }, // custom styles for New inactive
                      ]}
                    >
                      {cat.isAnimated ? (
                        <Animated.View style={iconStyle}>
                          <IconComponent
                            size={18}
                            color={active ? '#ffd60a' : (cat.color || '#090966')}
                            fill={active ? '#ffd60a' : (cat.id === 'hot' ? cat.color : 'transparent')}
                          />
                        </Animated.View>
                      ) : (
                        <IconComponent size={18} color={active ? '#ffd60a' : '#090966'} />
                      )}
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
          </>
        )}
      </View>
    </View>
  ), [
    categorySheetVisible,
    pendingCategory,
    selectedCategory,
    // selectedAudience,
    searchMode,
    searchCode,
    searchQuery,
    trendingProducts,
    trendingIndex,
    unreadNotifications,
    brands,
    userType,
    authRole,
    authUserId,
    myBrandProducts,
    wishlist,
    ratingStats,
    brandDiscountLookup,
    brandLogoUrl,
    navigation,
    categories,
    hotAnim,
    newAnim,
    categorySlide
  ]);

  const renderProductItem = useCallback(
    ({ item }) => (
      <View style={styles.productWrapper}>
        <ProductCard
          item={item}
          navigation={navigation}
          wishlist={wishlist}
          ratingStats={ratingStats}
          brandDiscountLookup={brandDiscountLookup}
          authRole={authRole}
          addToWishlist={addToWishlist}
          removeFromWishlist={removeFromWishlist}
          getProductCardUri={getProductCardUri}
        />
      </View>
    ),
    [
      navigation,
      wishlist,
      ratingStats,
      brandDiscountLookup,
      authRole,
      addToWishlist,
      removeFromWishlist,
      getProductCardUri,
    ],
  );

  const isBrandUser = userType === 'brand' || authRole === 'brand';

  if (isBrandUser) {
    const brand = (brands || []).find((b) => b.user_id === authUserId) || null;
    const {
      todaysOrders,
      pending: pendingOrdersCount,
      newOrders: newOrdersCount,
      packing: packingOrdersCount,
      shipped: shippedOrdersCount,
      completed: completedOrdersCount,
    } = brandOrderStats;

    return (
      <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
        <ScrollView
          style={styles.brandHomeScroll}
          contentContainerStyle={styles.brandHomeContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.brandHeaderCard}>
            <View style={styles.brandHeaderRow}>
              <View style={styles.brandAvatarWrapper}>
                {brandLogoUrl || brand?.logo_url ? (
                  <Image
                    source={{ uri: brandLogoUrl || brand?.logo_url || '' }}
                    style={styles.brandAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.brandAvatarInitial}>
                    {(brand?.name || 'Store').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <View style={styles.brandHeaderTextCol}>
                <View style={styles.brandHeaderTitleRow}>
                  <Text style={styles.brandHeaderName}>{brand?.name || 'Style Boutique'}</Text>
                  <View style={styles.brandActivePill}>
                    <Text style={styles.brandActivePillText}>ACTIVE</Text>
                  </View>
                </View>
                <Text style={styles.brandHeaderSubtitle}>
                  Welcome back, {userName || 'Sarah'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setUnreadNotifications(0);
                  navigation.navigate('Notifications');
                }}
                style={styles.brandHeaderBell}
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
            </View>
          </View>

          {/* Top stats row */}
          <View style={styles.brandTopStatsRow}>
            <View style={styles.brandStatCardPrimary}>
              <View style={styles.brandStatIconCircle}>
                <ShoppingBag color="#090966" size={20} />
              </View>
              <Text style={styles.brandStatLabel}>Today's Orders</Text>
              <Text style={styles.brandStatValue}>{todaysOrders}</Text>
              <Text style={styles.brandStatChange}>+24% vs yesterday</Text>
            </View>

            <View style={styles.brandStatCardSecondary}>
              <View style={styles.brandStatIconCircleSecondary}>
                <Clock color="#F97316" size={20} />
              </View>
              <Text style={styles.brandStatLabelSecondary}>Pending</Text>
              <Text style={styles.brandStatValueSecondary}>{pendingOrdersCount}</Text>
              <Text style={styles.brandStatWarning}>Action Needed</Text>
            </View>
          </View>

          {/* Balance card */}
          <View style={styles.brandBalanceCard}>
            <View style={styles.brandBalanceTopRow}>
              <View>
                <Text style={styles.brandBalanceLabel}>Available Balance</Text>
              </View>
              <View style={styles.brandBalanceIconBadge}>
                <View style={styles.brandBalanceIconInner}>
                  <Package size={16} color="#EEF2FF" />
                </View>
              </View>
            </View>
            <Text style={styles.brandBalanceValue}>$1,240.50</Text>
            <Text style={styles.brandBalanceSubLabel}>On-Hold Balance</Text>
            <Text style={styles.brandBalanceSubValue}>$350.00</Text>
            <TouchableOpacity
              style={styles.brandBalanceButton}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('BrandWallet')}
            >
              <Text style={styles.brandBalanceButtonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>

          {/* Orders Summary */}
          <View style={styles.brandSectionHeaderRow}>
            <Text style={styles.brandSectionTitle}>Orders Summary</Text>
            <TouchableOpacity onPress={() => navigation.navigate('BrandOrders')}>
              <Text style={styles.brandSectionLink}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.brandOrdersSummaryRow}>
            <View style={styles.brandSummaryCardNew}>
              <View style={styles.brandSummaryHeaderRow}>
                <View style={styles.brandSummaryIconBadgeNew}>
                  <Text style={styles.brandSummaryIconBadgeText}>NEW</Text>
                </View>
              </View>
              <Text style={styles.brandSummaryLabel}>New</Text>
              <Text style={styles.brandSummaryCount}>{newOrdersCount}</Text>
              <Text style={styles.brandSummarySub}>Orders</Text>
            </View>

            <View style={styles.brandSummaryCardProcessing}>
              <View style={styles.brandSummaryHeaderRow}>
                <View style={styles.brandSummaryIconCircleProcessing}>
                  <Clock size={16} color="#6366F1" />
                </View>
              </View>
              <Text style={styles.brandSummaryLabel}>Processing</Text>
              <Text style={styles.brandSummaryCount}>{packingOrdersCount}</Text>
              <Text style={styles.brandSummarySub}>Orders</Text>
            </View>

            <View style={styles.brandSummaryCardShipped}>
              <View style={styles.brandSummaryHeaderRow}>
                <View style={styles.brandSummaryIconCircleShipped}>
                  <Truck size={16} color="#0EA5E9" />
                </View>
              </View>
              <Text style={styles.brandSummaryLabel}>Shipped</Text>
              <Text style={styles.brandSummaryCount}>{shippedOrdersCount}</Text>
              <Text style={styles.brandSummarySub}>Orders</Text>
            </View>

            <View style={styles.brandSummaryCardCompleted}>
              <View style={styles.brandSummaryHeaderRow}>
                <View style={styles.brandSummaryIconCircleCompleted}>
                  <CheckCircle size={16} color="#16A34A" />
                </View>
              </View>
              <Text style={styles.brandSummaryLabel}>Completed</Text>
              <Text style={styles.brandSummaryCount}>{completedOrdersCount}</Text>
              <Text style={styles.brandSummarySub}>Orders</Text>
            </View>
          </View>

          {/* Primary / secondary CTAs */}
          <View style={styles.brandPrimaryCtasRow}>
            <TouchableOpacity
              style={styles.brandPrimaryCta}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('AddProduct')}
            >
              <Text style={styles.brandPrimaryCtaText}>Add Product</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.brandSecondaryCta}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('BrandOrders')}
            >
              <Text style={styles.brandSecondaryCtaText}>View Orders</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Activity */}
          <View style={styles.brandRecentHeaderRow}>
            <Text style={styles.brandSectionTitle}>Recent Activity</Text>
          </View>

          <View style={styles.brandRecentList}>
            <View style={styles.brandRecentItem}>
              <View style={styles.brandRecentDotNew} />
              <View style={styles.brandRecentTextCol}>
                <View style={styles.brandRecentTitleRow}>
                  <Text style={styles.brandRecentTitle}>New Order #1023 Received</Text>
                  <Text style={styles.brandRecentTime}>10m ago</Text>
                </View>
                <Text style={styles.brandRecentBody}>
                  Order for "Vintage Leather Jacket" is pending confirmation.
                </Text>
              </View>
            </View>

            <View style={styles.brandRecentItem}>
              <View style={styles.brandRecentDotEscrow} />
              <View style={styles.brandRecentTextCol}>
                <View style={styles.brandRecentTitleRow}>
                  <Text style={styles.brandRecentTitle}>Escrow Released</Text>
                  <Text style={styles.brandRecentTime}>2h ago</Text>
                </View>
                <Text style={styles.brandRecentBody}>
                  Funds for Order #1010 have been added to your available balance.
                </Text>
              </View>
            </View>

            <View style={styles.brandRecentItem}>
              <View style={styles.brandRecentDotAdmin} />
              <View style={styles.brandRecentTextCol}>
                <View style={styles.brandRecentTitleRow}>
                  <Text style={styles.brandRecentTitle}>Admin Announcement</Text>
                  <Text style={styles.brandRecentTime}>1d ago</Text>
                </View>
                <Text style={styles.brandRecentBody}>
                  Platform maintenance scheduled for Sunday at 2:00 AM UTC.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <FlashList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProductItem}
        numColumns={2}
        columnWrapperStyle={styles.productsGrid}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderListHeader}
        estimatedItemSize={260}
      />
    </SafeAreaView>
  );
}

export default HomeScreen;

const ProductCard = React.memo(
  ({
    item,
    navigation,
    wishlist,
    ratingStats,
    brandDiscountLookup,
    authRole,
    addToWishlist,
    removeFromWishlist,
    getProductCardUri,
  }) => {
    const inWishlist = wishlist.some((w) => w.id === item.id);
    const stats = ratingStats[item.id];
    const rating = stats?.avg ?? 0;
    const ratingCount = stats?.count ?? 0;
    const { currentPrice, flashPrice, isFlashActive } = getFlashSaleState(item);
    const isOutOfStock = Number(item.quantity) === 0;
    const byUser = item.brand_user_id ? brandDiscountLookup[`user:${item.brand_user_id}`] : null;
    const byName = !byUser && item.brand ? brandDiscountLookup[`name:${item.brand}`] : null;
    const brandDiscount = byUser != null ? byUser : byName;

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
          {isFlashActive && (
            <View style={styles.flashBadge}>
              <Text style={styles.flashBadgeText}>Flash Sale</Text>
            </View>
          )}
          {!isFlashActive && brandDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{Math.round(brandDiscount)}%</Text>
            </View>
          )}
          {isOutOfStock && !isFlashActive && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockBadgeText}>Out of stock</Text>
            </View>
          )}
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
        </View>
        <Text style={styles.productBrand}>{item.brand}</Text>
        <Text style={styles.productName} numberOfLines={1}>
          {item.name}
        </Text>
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

            const discount = brandDiscount;

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
  },
);

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
  // 
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#090966',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    flex: 1,
  },
  micButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#090966',
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#090966',
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
    width: 62,
    height: 62,
    backgroundColor: '#090966',
    borderRadius: 31,
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
    fontSize: 18,
    color: '#ffffff',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#090966',
    marginTop: 6,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    color: '#090966',
    fontWeight: '700',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productWrapper: {
    width: '95%',
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
    fontWeight: '800',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: '#090966',
    borderColor: '#090966',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#090966',
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
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  searchModeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  searchModeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  searchModeChipActive: {
    backgroundColor: '#090966',
  },
  searchModeText: {
    fontSize: 11,
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
    backgroundColor: 'rgba(9, 9, 102, 0.75)', // Brand color overlay
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  trendingButtonText: {
    color: '#090966',
    fontWeight: '800',
    fontSize: 14,
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
  brandHomeScroll: {
    flex: 1,
  },
  brandHomeContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: '#F3F4F6',
  },
  brandHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
  },
  brandAvatarInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  brandHeaderTextCol: {
    flex: 1,
  },
  brandHeaderName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  brandHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandActivePill: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  brandActivePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  brandHeaderSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  brandStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  brandStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  brandStatusText: {
    fontSize: 12,
    color: '#6B7280',
  },
  brandHeaderBell: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandHeaderSettings: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  brandHeaderButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  brandStatusButtonPrimary: {
    flex: 1,
    backgroundColor: '#090966',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandStatusButtonPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  brandStatusButtonSecondary: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandStatusButtonSecondaryText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  brandSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 8,
  },
  brandSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  brandSectionSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  brandSectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#090966',
  },
  brandOverviewRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 12,
  },
  brandTopStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  brandStatCardPrimary: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  brandStatIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandStatLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  brandStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  brandStatChange: {
    marginTop: 4,
    fontSize: 11,
    color: '#16A34A',
  },
  brandStatCardSecondary: {
    flex: 1,
    backgroundColor: '#FFF7ED',
    borderRadius: 20,
    padding: 16,
  },
  brandStatIconCircleSecondary: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  brandStatLabelSecondary: {
    fontSize: 13,
    color: '#FB923C',
    marginBottom: 4,
  },
  brandStatValueSecondary: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  brandStatWarning: {
    marginTop: 4,
    fontSize: 11,
    color: '#DC2626',
  },
  brandOverviewCardPrimary: {
    flex: 1,
    backgroundColor: '#090966',
    borderRadius: 20,
    padding: 16,
  },
  brandOverviewIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandOverviewLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    marginBottom: 6,
  },
  brandOverviewValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  brandOverviewCardSecondary: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
    padding: 16,
  },
  brandOverviewBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  brandOverviewBadgeText: {
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#fff',
    backgroundColor: '#090966',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  brandOverviewSecondaryLabel: {
    color: '#090966',
    fontSize: 13,
    marginBottom: 6,
  },
  brandOverviewSecondaryValue: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  brandAlertCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  brandBalanceCard: {
    marginTop: 4,
    marginBottom: 20,
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#090966',
  },
  brandBalanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBalanceLabel: {
    fontSize: 13,
    color: '#E5E7EB',
    marginBottom: 4,
  },
  brandBalanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  brandBalanceSubLabel: {
    fontSize: 12,
    color: '#CBD5F5',
  },
  brandBalanceSubValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  brandBalanceIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBalanceIconInner: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBalanceButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F9FAFB',
  },
  brandBalanceButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#090966',
  },
  brandAlertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#090966',
    marginBottom: 4,
  },
  brandAlertText: {
    fontSize: 13,
    color: '#090966',
    marginBottom: 10,
  },
  brandAlertButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#090966',
  },
  brandAlertButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  brandStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  brandOrdersSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  brandSummaryCardNew: {
    flexBasis: '48%',
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    padding: 14,
  },
  brandSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  brandSummaryIconBadgeNew: {
    width: 32,
    height: 24,
    borderRadius: 10,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSummaryIconBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  brandSummaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  brandSummaryCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  brandSummarySub: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  brandSummaryCardProcessing: {
    flexBasis: '48%',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    padding: 14,
  },
  brandSummaryCardShipped: {
    flexBasis: '48%',
    backgroundColor: '#ECFEFF',
    borderRadius: 18,
    padding: 14,
  },
  brandSummaryCardCompleted: {
    flexBasis: '48%',
    backgroundColor: '#ECFDF3',
    borderRadius: 18,
    padding: 14,
  },
  brandSummaryIconCircleProcessing: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSummaryIconCircleShipped: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSummaryIconCircleCompleted: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandStatusCardLive: {
    width: '48%',
    backgroundColor: '#EEF2FF',
    borderRadius: 18,
    padding: 14,
  },
  brandStatusCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
  },
  brandStatusCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandLiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  brandLiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    textTransform: 'uppercase',
  },
  brandStatusCardLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  brandStatusCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  brandPrimaryCtasRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  brandPrimaryCta: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPrimaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandSecondaryCta: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSecondaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  brandPrimaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090966',
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 14,
  },
  brandPrimaryActionIcon: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginRight: 6,
  },
  brandPrimaryActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  brandQuickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  brandSecondaryActionButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSecondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  brandRecentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  brandRecentList: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  brandRecentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  brandRecentDotNew: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    marginTop: 6,
    marginRight: 10,
  },
  brandRecentDotEscrow: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    marginTop: 6,
    marginRight: 10,
  },
  brandRecentDotAdmin: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F97316',
    marginTop: 6,
    marginRight: 10,
  },
  brandRecentTextCol: {
    flex: 1,
  },
  brandRecentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  brandRecentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  brandRecentTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  brandRecentBody: {
    fontSize: 12,
    color: '#4B5563',
  },
});
