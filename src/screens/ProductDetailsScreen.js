import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert, ActivityIndicator, TextInput, Modal, FlatList, Animated } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShoppingCart, ShoppingBag, Heart, Star, FileText, MessageSquare, ChevronLeft, ChevronRight, ZoomIn, Package, Truck, Shield, Copy, Check } from 'lucide-react-native';
import { useStore } from '../store/store';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUserProductRating, upsertUserProductRating, fetchProductRatingSummary } from '../services/ratings';
import { fetchProductReviews, createProductReview, fetchReviewReplies, addReviewReply, updateProductReview, deleteProductReview } from '../services/reviews';
import { fetchProductQuestions, createProductQuestion, fetchAnswersForQuestions, createProductAnswer, updateProductAnswer, deleteProductAnswer } from '../services/questions';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';
const SUCCESS_COLOR = '#10B981';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ScalePress = ({ onPress, style, children, activeOpacity = 0.9 }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 22,
      bounciness: 0,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
};

const ProductDetailsScreen = ({ route, navigation }) => {
  const { product, initialTab, focusQuestionId } = route.params || {};
  const addToCart = useStore((state) => state.addToCart);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const cart = useStore((state) => state.cart);
  const wishlist = useStore((state) => state.wishlist);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const userType = useStore((state) => state.userType);
  const authRole = useStore((state) => state.authRole);
  const products = useStore((state) => state.products);
  const deletedProductIds = useStore((state) => state.deletedProductIds || []);
  const productRatings = useStore((state) => state.productRatings);
  const setProductRating = useStore((state) => state.setProductRating);
  const authUserId = useStore((state) => state.authUserId);
  const userName = useStore((state) => state.userName);
  const orders = useStore((state) => state.orders) || [];

  // A user is considered to have purchased a product if they have
  // at least one order with a delivered-like status that contains
  // this product in its items list.
  const hasPurchasedProduct = useMemo(
    () =>
      orders.some((order) => {
        if (!order || !Array.isArray(order.items)) return false;

        const raw = (order.status || '').toString().toLowerCase();
        const isDeliveredLike =
          raw === 'delivered' ||
          raw === 'customer_confirmed' ||
          raw === 'completed';

        if (!isDeliveredLike) return false;

        return order.items.some(
          (item) =>
            item &&
            (item.id === product.id || item.product_id === product.id),
        );
      }),
    [orders, product.id],
  );

  const inWishlist = wishlist.some((item) => item.id === product.id);

  const quantity = Number(product.quantity ?? 0);
  const availabilityLabel = quantity > 0 ? `${quantity} in stock` : 'Out of stock';

  const baseProducts = Array.isArray(products) ? products : [];

  const isBrandUser = userType === 'brand' || authRole === 'brand';
  const isAdminUser = authRole === 'admin';
  const ownsProduct = !!(authUserId && product.brand_user_id && product.brand_user_id === authUserId);

  const currentRating = productRatings[product.id] || 0;

  const currentCategoryId = product.category_id || product.categoryId || null;
  const currentCategoryName = product.category_name || product.category || null;

  const similarProducts = useMemo(() => {
    if (!Array.isArray(baseProducts) || baseProducts.length === 0) return [];

    const categoryKey = (currentCategoryName || '').toLowerCase();

    return baseProducts.filter((p) => {
      if (!p || p.id === product.id) return false;
      if (deletedProductIds.includes(p.id)) return false;

      const sameIdCategory =
        currentCategoryId &&
        (p.category_id === currentCategoryId || p.categoryId === currentCategoryId);

      const sameNameCategory =
        categoryKey && typeof p.category === 'string' && p.category.toLowerCase() === categoryKey;

      return sameIdCategory || sameNameCategory;
    });
  }, [baseProducts, product, currentCategoryId, currentCategoryName, deletedProductIds]);

  const handleCopyCode = async () => {
    if (!product.code) return;
    await Clipboard.setStringAsync(product.code.toString());
    Alert.alert('Copied', 'Product code copied to clipboard.');
  };

  // Enhanced image navigation
  const scrollToImage = (index) => {
    setSelectedImageIndex(index);
    imageScrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  };

  const goToPreviousImage = () => {
    if (selectedImageIndex > 0) {
      scrollToImage(selectedImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (selectedImageIndex < images.length - 1) {
      scrollToImage(selectedImageIndex + 1);
    }
  };

  const images = useMemo(() => {
    // Start from any explicit images array saved on the product
    let list = [];

    if (Array.isArray(product.images) && product.images.length > 0) {
      list = product.images.filter(Boolean);
    } else if (product.image_full_url) {
      list = [product.image_full_url];
    } else if (product.image) {
      list = [product.image];
    }

    // Ensure the primary full image URL (if any) is first in the list
    if (product.image_full_url) {
      const primary = product.image_full_url;
      list = [primary, ...list.filter((uri) => uri && uri !== primary)];
    }

    return list;
  }, [product]);

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const deliveryOptions = Array.isArray(product.deliveryOptions) ? product.deliveryOptions : [];

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(colors[0] || null);
  const [selectedSize, setSelectedSize] = useState(sizes[0] || null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(
    deliveryOptions[0]?.id || null,
  );

  const [fulfillmentMode, setFulfillmentMode] = useState('delivery');
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);

  useEffect(() => {
    const picked = route?.params?.selectedAddress || null;
    if (picked) {
      setSelectedAddress(picked);
    }
  }, [route?.params?.selectedAddress]);

  const normalizeCity = (value) => (value || '').trim().toLowerCase();

  const fulfillmentEtaLabel = useMemo(() => {
    if (fulfillmentMode !== 'delivery') return null;
    const city = normalizeCity(selectedAddress?.city);
    if (!city) return null;
    if (city === 'hargeisa' || city === 'hargeysa') return 'Hargeisa: delivery in about 3 hours';
    return 'Other city: delivery as soon as possible';
  }, [fulfillmentMode, selectedAddress]);

  const getReadableTextColor = (hex) => {
    const value = (hex || '').trim();
    const m = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return '#090966';
    const raw = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.7 ? '#111827' : '#ffffff';
  };

  const resolveNamedColor = (name) => {
    const key = (name || '').trim().toLowerCase();
    const map = {
      white: '#ffffff',
      black: '#111827',
      red: '#ef4444',
      blue: '#3b82f6',
      green: '#22c55e',
      yellow: '#facc15',
      orange: '#fb923c',
      purple: '#a855f7',
      pink: '#ec4899',
      gray: '#9ca3af',
      grey: '#9ca3af',
      brown: '#92400e',
      beige: '#f5f5dc',
      gold: '#fbbf24',
      silver: '#d1d5db',
    };
    return map[key] || null;
  };

  const resolveColorBackground = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
    return resolveNamedColor(value);
  };

  const loadPrimaryAddress = useCallback(async () => {
    if (!authUserId) {
      setSelectedAddress(null);
      return;
    }
    try {
      setAddressLoading(true);
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('id, name, country, city, district, phone, secondary_phone, address_line, address_descr, is_primary')
        .eq('user_id', authUserId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('ProductDetails: failed to load addresses', error.message || error);
        setSelectedAddress(null);
        return;
      }

      const list = Array.isArray(data) ? data : [];
      const primary = list.find((a) => a.is_primary);
      setSelectedAddress(primary || list[0] || null);
    } catch (e) {
      console.warn('ProductDetails: unexpected error loading addresses', e.message || e);
      setSelectedAddress(null);
    } finally {
      setAddressLoading(false);
    }
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      loadPrimaryAddress();
    }, [loadPrimaryAddress]),
  );

  // Animation states
  const scrollX = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1)).current;
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [zoomedImageIndex, setZoomedImageIndex] = useState(0);

  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);

  const imageScrollRef = useRef(null);
  const tabIndicatorRef = useRef(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState(null);
  const [withPhotosFilter, setWithPhotosFilter] = useState(false);
  const [withSizeInfoFilter, setWithSizeInfoFilter] = useState(false);
  const [reviewsSortBy, setReviewsSortBy] = useState('recent');
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewSizeFeedback, setReviewSizeFeedback] = useState(null);
  const [reviewTags, setReviewTags] = useState([]);
  const [reviewPhotos, setReviewPhotos] = useState([]);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewRepliesMap, setReviewRepliesMap] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [previewImageUri, setPreviewImageUri] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [questionsPage, setQuestionsPage] = useState(1);
  const [questionsHasMore, setQuestionsHasMore] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [answersMap, setAnswersMap] = useState({});
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [submittingAnswerIds, setSubmittingAnswerIds] = useState({});
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');
  const [similarLimit, setSimilarLimit] = useState(10);

  const [activeInfoTab, setActiveInfoTab] = useState(
    initialTab === 'description' || initialTab === 'reviews' ? initialTab : 'description',
  );
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // initialTab is intentionally ignored here: this screen now displays Reviews only.

  // Derive average rating and count from loaded reviews so the detail header
  // stays in sync with the review section. This is read-only display data.
  const { reviewsAvgRating, reviewsRatingCount } = useMemo(() => {
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return { reviewsAvgRating: null, reviewsRatingCount: 0 };
    }

    let sum = 0;
    let count = 0;

    reviews.forEach((r) => {
      if (r && typeof r.rating === 'number') {
        sum += r.rating;
        count += 1;
      }
    });

    if (count === 0) {
      return { reviewsAvgRating: null, reviewsRatingCount: 0 };
    }

    return { reviewsAvgRating: sum / count, reviewsRatingCount: count };
  }, [reviews]);

  // Decide what to display in the header: prefer review-based summary so it
  // matches the review section. Fall back to rating summary if needed.
  const displayAvgRating =
    reviewsAvgRating != null
      ? reviewsAvgRating
      : avgRating != null
      ? avgRating
      : 0;

  const displayRatingCount =
    reviewsTotal > 0
      ? reviewsTotal
      : reviewsRatingCount > 0
      ? reviewsRatingCount
      : ratingCount > 0
      ? ratingCount
      : 0;

  const inCart = useMemo(
    () => Array.isArray(cart) && cart.some((item) => item.id === product.id),
    [cart, product.id],
  );

  const addToCartAnim = useRef(new Animated.Value(1)).current;
  const addToCartOpacity = useRef(new Animated.Value(1)).current;

  const currentPrice = Number(product.price) || 0;
  const flashPriceRaw =
    product.flash_price != null && product.flash_price !== ''
      ? Number(product.flash_price)
      : null;

  let isFlashActive = false;
  let flashPrice = null;
  if (flashPriceRaw != null && !Number.isNaN(flashPriceRaw) && flashPriceRaw > 0) {
    try {
      const now = new Date();
      const start = product.flash_start_at ? new Date(product.flash_start_at) : null;
      const end = product.flash_end_at ? new Date(product.flash_end_at) : null;
      const hasQty = product.flash_quantity != null;
      const sold = Number(product.flash_sold) || 0;
      const qtyOk = !hasQty || sold < product.flash_quantity;

      if (start && end && start <= now && end > now) {
        if (qtyOk) {
          isFlashActive = true;
          flashPrice = flashPriceRaw;
        }
      }
    } catch (e) {
      // ignore date parse errors
    }
  }

  const isFlashSoldOut = (() => {
    if (!product.flash_price) return false;
    const now = new Date();
    const start = product.flash_start_at ? new Date(product.flash_start_at) : null;
    const end = product.flash_end_at ? new Date(product.flash_end_at) : null;
    if (!start || !end || start > now || end <= now) return false;
    if (product.flash_quantity == null) return false;
    const sold = Number(product.flash_sold) || 0;
    return sold >= product.flash_quantity;
  })();

  const canReview = !!authUserId && hasPurchasedProduct;

  const MAX_SIMILAR_ITEMS = 4;
  const visibleSimilarProducts = useMemo(
    () => similarProducts.slice(0, MAX_SIMILAR_ITEMS),
    [similarProducts],
  );

  const handleSeeAllSimilar = useCallback(() => {
    if (currentCategoryId || currentCategoryName) {
      navigation.push('CategoryProducts', {
        categoryId: currentCategoryId,
        categoryName: currentCategoryName,
      });
      return;
    }

    navigation.push('AllProducts');
  }, [navigation, currentCategoryId, currentCategoryName]);

  const handleLoadMoreSimilar = useCallback(() => {
    if (similarLimit >= MAX_SIMILAR_ITEMS) return;
    if (similarLimit >= similarProducts.length) return;

    const next = Math.min(similarLimit + 10, similarProducts.length, MAX_SIMILAR_ITEMS);
    setSimilarLimit(next);
  }, [similarLimit, similarProducts.length]);

  const renderSimilarItem = useCallback(
    ({ item, index }) => {
      const coverImage =
        (Array.isArray(item.images) && item.images[0]) || item.image || null;
      const priceValue =
        typeof item.price === 'number' ? item.price : Number(item.price) || 0;

      const inSimilarWishlist = wishlist.some((w) => w.id === item.id);

      return (
        <TouchableOpacity
          style={styles.similarCard}
          onPress={() => navigation.push('ProductDetails', { product: item })}
          activeOpacity={0.9}
        >
          <View style={styles.similarImageWrapper}>
            {coverImage ? (
              <Image
                source={{ uri: coverImage }}
                style={styles.similarImage}
                contentFit="cover"
                cachePolicy="disk"
                transition={200}
              />
            ) : (
              <View style={styles.similarImagePlaceholder}>
                <Text style={styles.similarImagePlaceholderText}>No image</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.similarWishlistIcon}
              onPress={(e) => {
                e.stopPropagation();
                if (inSimilarWishlist) {
                  removeFromWishlist(item.id);
                } else {
                  addToWishlist(item);
                }
              }}
              activeOpacity={0.9}
            >
              <Heart
                size={16}
                color={inSimilarWishlist ? '#ef4444' : '#9ca3af'}
                fill={inSimilarWishlist ? '#ef4444' : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          {item.brand ? (
            <Text style={styles.similarBrand} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}

          <Text style={styles.similarName} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.similarPriceRow}>
            <Text style={styles.similarPrice}>
              {priceValue > 0 ? `$${priceValue.toFixed(2)}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.similarAddButton}
              onPress={(e) => {
                e.stopPropagation();
                addToCart(item);
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.similarAddButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [navigation, wishlist, addToWishlist, removeFromWishlist, addToCart],
  );

  // Animation functions
  const handleImageScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleImageZoom = (imageIndex) => {
    setZoomedImageIndex(imageIndex);
    setIsImageZoomed(true);
    Animated.spring(imageScale, {
      toValue: 1.5,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  // Description expand/collapse removed (Reviews-only info section).

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      const diffWeek = Math.floor(diffDay / 7);
      const diffMonth = Math.floor(diffDay / 30);
      const diffYear = Math.floor(diffDay / 365);

      if (diffSec < 60) return 'just now';
      if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
      if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
      if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
      if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
      if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;
      return `${diffYear} year${diffYear === 1 ? '' : 's'} ago`;
    } catch (e) {
      return '';
    }
  };

  const toggleTag = (tag) => {
    setReviewTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  };

  const getFeaturedReviews = (allReviews) => {
    if (!allReviews || allReviews.length === 0) return [];
    const byRating = {
      5: allReviews.filter((r) => r.rating === 5),
      4: allReviews.filter((r) => r.rating === 4),
      3: allReviews.filter((r) => r.rating === 3),
    };

    const picks = [];
    [5, 4, 3].forEach((score) => {
      if (byRating[score] && byRating[score].length > 0 && picks.length < 3) {
        picks.push(byRating[score][0]);
      }
    });

    if (picks.length < 3) {
      allReviews.forEach((r) => {
        if (picks.length >= 3) return;
        if (!picks.find((p) => p.id === r.id)) {
          picks.push(r);
        }
      });
    }

    return picks;
  };

  const loadReviews = async (resetPage = true) => {
    if (!product?.id) return;
    setReviewsLoading(true);
    try {
      const page = resetPage ? 1 : reviewsPage + 1;
      const { items, hasMore, total } = await fetchProductReviews({
        productId: product.id,
        page,
        ratingFilter,
        withPhotos: withPhotosFilter,
        withSizeInfo: withSizeInfoFilter,
        sortBy: reviewsSortBy,
      });

      setReviews((prev) => (resetPage ? items : [...prev, ...items]));
      setReviewsPage(page);
      setReviewsHasMore(hasMore);
      const nextTotal =
        typeof total === 'number'
          ? total
          : resetPage
          ? items.length
          : (reviews || []).length + items.length;
      setReviewsTotal(nextTotal);

      const ids = (resetPage ? items : [...reviews, ...items]).map((r) => r.id);
      if (ids.length > 0) {
        const map = await fetchReviewReplies(ids);
        setReviewRepliesMap(map);
      }
    } catch (e) {
      console.warn('Failed to load reviews', e.message || e);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadQuestions = async (resetPage = true) => {
    if (!product?.id) return;
    setQuestionsLoading(true);
    try {
      const page = resetPage ? 1 : questionsPage + 1;
      const { items, hasMore } = await fetchProductQuestions({
        productId: product.id,
        page,
      });

      setQuestions((prev) => (resetPage ? items : [...prev, ...items]));
      setQuestionsPage(page);
      setQuestionsHasMore(hasMore);

      const ids = (resetPage ? items : [...questions, ...items]).map((q) => q.id);
      if (ids.length > 0) {
        const map = await fetchAnswersForQuestions(ids);
        setAnswersMap(map);
      }
    } catch (e) {
      console.warn('Failed to load questions', e.message || e);
    } finally {
      setQuestionsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadRating = async () => {
        try {
          if (!product?.id) return;

          if (authUserId) {
            const existing = await fetchUserProductRating(product.id, authUserId);
            if (!isActive) return;
            if (typeof existing === 'number') {
              setProductRating(product.id, existing);
            }
          }

          const summary = await fetchProductRatingSummary(product.id);
          if (!isActive) return;
          setAvgRating(summary.avg);
          setRatingCount(summary.count);
        } catch (e) {
          console.warn('Failed to load product rating', e.message || e);
        }
      };

      loadRating();
      loadReviews(true);
      loadQuestions(true);

      return () => {
        isActive = false;
      };
    }, [authUserId, product?.id, setProductRating])
  );

  const featuredReviews = getFeaturedReviews(reviews);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      {/* Enhanced Image Header with swipe navigation */}
      <View style={styles.imageHeader}>
        {images.length > 0 && (
          <View style={styles.slideWrapper}>
            <ScrollView
              ref={imageScrollRef}
              horizontal
              pagingEnabled
              snapToInterval={screenWidth}
              snapToAlignment="start"
              decelerationRate="fast"
              disableIntervalMomentum
              showsHorizontalScrollIndicator={false}
              directionalLockEnabled
              nestedScrollEnabled
              onScroll={handleImageScroll}
              scrollEventThrottle={16}
            >
              {images.map((uri, index) => (
                <TouchableOpacity
                  key={uri + index}
                  style={styles.imageSlide}
                  activeOpacity={1}
                  onPress={() => handleImageZoom(index)}
                >
                  <Animated.View style={{ transform: [{ scale: imageScale }] }}>
                    <Image
                      source={{ uri }}
                      style={styles.headerImage}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={250}
                    />
                  </Animated.View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Image indicators */}
            {images.length > 1 && (
              <View style={styles.imageIndicators}>
                {images.map((_, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.indicatorDot,
                      index === selectedImageIndex && styles.indicatorDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}
        
        <View style={styles.headerOverlay}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.iconButton}
          >
            <ArrowLeft color={BRAND_COLOR} size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (authRole === 'admin') {
                return;
              }
              if (inWishlist) {
                removeFromWishlist(product.id);
              } else {
                addToWishlist(product);
              }
            }}
          >
            <Heart
              size={24}
              color={inWishlist ? '#ef4444' : '#9ca3af'}
              fill={inWishlist ? '#ef4444' : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentPanel}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {activeInfoTab !== 'reviews' && (
            <>
              {/* Enhanced Product Title and Rating */}
              <View style={styles.titleRow}>
                <View style={styles.titleContainer}>
                  <View style={styles.titleTopRow}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <View style={styles.ratingContainer}>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = displayAvgRating >= star;
                          return (
                            <Animated.View key={star} style={styles.ratingStarButton}>
                              <Star
                                size={14}
                                color={active ? ACCENT_COLOR : '#D1D5DB'}
                                fill={active ? ACCENT_COLOR : 'transparent'}
                              />
                            </Animated.View>
                          );
                        })}
                      </View>
                      <Text style={styles.ratingText}>
                        {displayAvgRating > 0 ? displayAvgRating.toFixed(1) : '0.0'}
                        {displayRatingCount > 0 ? ` (${displayRatingCount})` : ''}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.productBrand} numberOfLines={1}>
                    {product.brand}
                  </Text>

                  {/* Product badges */}
                  <View style={styles.badgesContainer}>
                    {isFlashActive && (
                      <View style={styles.flashBadgeDetail}>
                        <Text style={styles.flashBadgeDetailText}>Flash Sale</Text>
                      </View>
                    )}
                    {isFlashSoldOut && (
                      <View style={styles.flashSoldOutBadge}>
                        <Text style={styles.flashSoldOutBadgeText}>Sold out</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Enhanced Thumbnails */}
              {images.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbRow}
                  contentContainerStyle={styles.thumbRowContent}
                >
                  {images.map((uri, index) => (
                    <TouchableOpacity
                      key={uri + index}
                      style={[
                        styles.thumbWrapper,
                        index === selectedImageIndex && styles.thumbWrapperActive,
                      ]}
                      onPress={() => scrollToImage(index)}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri }}
                        style={styles.thumbImage}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={200}
                      />
                      {index === selectedImageIndex && (
                        <View style={styles.thumbActiveIndicator} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          <View style={styles.infoTabsSection}>
            <View style={styles.infoTabsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.infoTabButton,
                  activeInfoTab === 'description' && styles.infoTabButtonActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setActiveInfoTab('description')}
              >
                <FileText
                  size={16}
                  color={activeInfoTab === 'description' ? '#ffffff' : BRAND_COLOR}
                  style={styles.infoTabIcon}
                />
                <Text
                  style={[
                    styles.infoTabLabel,
                    activeInfoTab === 'description' && styles.infoTabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  Description
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.infoTabButton,
                  activeInfoTab === 'reviews' && styles.infoTabButtonActive,
                ]}
                activeOpacity={0.85}
                onPress={() => setActiveInfoTab('reviews')}
              >
                <MessageSquare
                  size={16}
                  color={activeInfoTab === 'reviews' ? '#ffffff' : BRAND_COLOR}
                  style={styles.infoTabIcon}
                />
                <Text
                  style={[
                    styles.infoTabLabel,
                    activeInfoTab === 'reviews' && styles.infoTabLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  Reviews
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoTabBody}>
              {activeInfoTab === 'description' ? (
                <View style={styles.descriptionContainer}>
                  <View style={styles.descriptionTextWrapper}>
                    <Text
                      style={styles.description}
                      numberOfLines={isDescriptionExpanded ? undefined : 4}
                    >
                      {product.description || ''}
                    </Text>
                  </View>
                  {product.description ? (
                    <TouchableOpacity
                      style={styles.descriptionSeeMoreButton}
                      activeOpacity={0.85}
                      onPress={() => setIsDescriptionExpanded((prev) => !prev)}
                    >
                      <Text style={styles.descriptionSeeMoreText}>
                        {isDescriptionExpanded ? 'See less' : 'See more'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <>
                  <View style={styles.reviewsHeaderSection}>
                    <View style={styles.reviewsHeaderTop}>
                      <View style={styles.reviewsTitleContainer}>
                        <MessageSquare size={20} color={BRAND_COLOR} />
                        <Text style={styles.reviewsTitle}>Customer Reviews</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {hasPurchasedProduct && (
                          <TouchableOpacity
                            style={styles.seeAllButton}
                            onPress={() =>
                              navigation.navigate('ProductWriteReview', {
                                productId: product.id,
                                productName: product.name,
                              })
                            }
                            activeOpacity={0.8}
                          >
                            <Text style={styles.seeAllButtonText}>Write</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.seeAllButton, { marginLeft: hasPurchasedProduct ? 8 : 0 }]}
                          onPress={() =>
                            navigation.navigate('ProductReviews', {
                              productId: product.id,
                              productName: product.name,
                            })
                          }
                          activeOpacity={0.8}
                        >
                          <Text style={styles.seeAllButtonText}>See All</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.ratingSummaryContainer}>
                      <View style={styles.ratingSummaryLeft}>
                        <Text style={styles.ratingBigNumber}>
                          {displayAvgRating.toFixed(1)}
                        </Text>
                        <View style={styles.ratingBigStars}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const active = displayAvgRating >= star;
                            return (
                              <Star
                                key={star}
                                size={16}
                                color={active ? ACCENT_COLOR : '#D1D5DB'}
                                fill={active ? ACCENT_COLOR : 'transparent'}
                              />
                            );
                          })}
                        </View>
                        <Text style={styles.ratingCountText}>
                          {displayRatingCount}{' '}
                          {displayRatingCount === 1 ? 'Review' : 'Reviews'}
                        </Text>
                      </View>

                      <View style={styles.ratingDistribution}>
                        {[5, 4, 3, 2, 1].map((rating) => {
                          const totalForBars =
                            reviewsTotal > 0
                              ? reviewsTotal
                              : Array.isArray(reviews)
                              ? reviews.length
                              : 0;

                          const matchingCount = Array.isArray(reviews)
                            ? reviews.filter(
                                (r) => r && Math.floor(Number(r.rating) || 0) === rating,
                              ).length
                            : 0;

                          const percentage =
                            totalForBars > 0 ? (matchingCount / totalForBars) * 100 : 0;

                          return (
                            <View key={rating} style={styles.ratingBarRow}>
                              <Text style={styles.ratingBarLabel}>{rating}</Text>
                              <View style={styles.ratingBarTrack}>
                                <Animated.View
                                  style={[
                                    styles.ratingBarFill,
                                    { width: `${percentage}%` },
                                  ]}
                                />
                              </View>
                              <Text style={styles.ratingBarPercent}>
                                {Math.round(percentage)}%
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.reviewsWriteSection}>
                      <View style={styles.reviewsWriteCard}>
                        <View style={styles.reviewsWriteHeader}>
                          <View style={styles.reviewsWriteIconWrapper}>
                            <MessageSquare size={18} color={ACCENT_COLOR} />
                          </View>
                          <View style={styles.reviewsWriteTitleWrapper}>
                            <Text style={styles.reviewsWriteTitle}>Share your experience</Text>
                            <Text style={styles.reviewsWriteSub}>
                              {canReview
                                ? 'Help others by reviewing this product'
                                : 'Purchase required to leave a review'}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.reviewsWriteButton,
                            !canReview && styles.reviewsWriteButtonDisabled,
                          ]}
                          disabled={!canReview}
                          onPress={() => {
                            if (!canReview) {
                              Alert.alert(
                                'Purchase required',
                                'You can only review products you have purchased.',
                              );
                              return;
                            }
                            navigation.navigate('ProductWriteReview', {
                              productId: product.id,
                              productName: product.name,
                            });
                          }}
                          activeOpacity={canReview ? 0.85 : 1}
                        >
                          <Star
                            size={14}
                            color={canReview ? BRAND_COLOR : '#9CA3AF'}
                            fill={canReview ? BRAND_COLOR : 'transparent'}
                          />
                          <Text
                            style={[
                              styles.reviewsWriteButtonText,
                              !canReview && { color: '#9CA3AF' },
                            ]}
                          >
                            {canReview ? 'Write a review' : 'Purchase required'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={styles.reviewsListSection}>
                    {reviewsLoading && featuredReviews.length === 0 ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={BRAND_COLOR} />
                        <Text style={styles.loadingText}>Loading reviews...</Text>
                      </View>
                    ) : (
                      <>
                        {featuredReviews.slice(0, 3).map((review) => (
                          <Animated.View
                            key={review.id}
                            style={[
                              styles.reviewCard,
                              {
                                opacity: 0,
                                transform: [{ translateY: 20 }],
                              },
                            ]}
                          >
                            <View style={styles.reviewHeader}>
                              <View style={styles.reviewAuthor}>
                                <View style={styles.reviewAvatar}>
                                  <Text style={styles.reviewAvatarText}>
                                    {(review.user_display_name || 'C')
                                      .charAt(0)
                                      .toUpperCase()}
                                  </Text>
                                </View>
                                <View style={styles.reviewAuthorInfo}>
                                  <Text style={styles.reviewAuthorName}>
                                    {review.user_display_name || 'Customer'}
                                  </Text>
                                  <Text style={styles.reviewDate}>
                                    {formatTimeAgo(review.created_at)}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.reviewRatingContainer}>
                                <Text style={styles.reviewRatingValue}>
                                  {review.rating.toFixed(1)}
                                </Text>
                                <View style={styles.reviewStars}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      size={12}
                                      color={
                                        review.rating >= star
                                          ? ACCENT_COLOR
                                          : '#D1D5DB'
                                      }
                                      fill={
                                        review.rating >= star
                                          ? ACCENT_COLOR
                                          : 'transparent'
                                      }
                                    />
                                  ))}
                                </View>
                              </View>
                            </View>

                            <Text style={styles.reviewText} numberOfLines={3}>
                              {review.text}
                            </Text>

                            {review.photos && review.photos.length > 0 ? (
                              <ScrollView
                                horizontal
                                style={styles.reviewPhotos}
                                showsHorizontalScrollIndicator={false}
                              >
                                {review.photos.map((photo, idx) => (
                                  <TouchableOpacity
                                    key={idx}
                                    style={styles.reviewPhoto}
                                    onPress={() => setPreviewImageUri(photo)}
                                    activeOpacity={0.9}
                                  >
                                    <Image
                                      source={{ uri: photo }}
                                      style={styles.reviewPhotoImage}
                                      contentFit="cover"
                                    />
                                  </TouchableOpacity>
                                ))}
                              </ScrollView>
                            ) : null}
                          </Animated.View>
                        ))}
                      </>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>

          {activeInfoTab !== 'reviews' && (
            <>
              {product.code ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Product code</Text>
                  <View style={styles.codeRow}>
                    <View style={styles.codePill}>
                      <Text style={styles.codePillLabel}>CODE</Text>
                      <Text style={styles.codePillValue} numberOfLines={1}>
                        {product.code}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.codeCopyButton}
                      onPress={handleCopyCode}
                      activeOpacity={0.85}
                    >
                      <Copy size={16} color="#ffffff" />
                      <Text style={styles.codeCopyButtonText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Availability</Text>
                <Text style={styles.availabilityText}>{availabilityLabel}</Text>
              </View>

              <View style={styles.section}>
                <View style={styles.sellerRow}>
                  <View>
                    <Text style={styles.sectionLabel}>Seller</Text>
                  </View>
                  {product.brand ? (
                    <TouchableOpacity
                      style={styles.viewStoreButton}
                      onPress={() =>
                        navigation.navigate('Brand', {
                          brand: {
                            name: product.brand,
                            user_id: product.brand_user_id || null,
                          },
                        })
                      }
                    >
                      <Text style={styles.viewStoreButtonText}>View Store</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.fulfillmentCard}>
                  <Text style={styles.fulfillmentTitle}>Delivery & Pickup</Text>
                  <Text style={styles.fulfillmentSubtitle}>
                    Choose delivery to your address or pickup from the store.
                  </Text>

                  <View style={styles.fulfillmentRow}>
                    <TouchableOpacity
                      style={[
                        styles.fulfillmentOption,
                        fulfillmentMode === 'delivery' && styles.fulfillmentOptionActive,
                      ]}
                      onPress={() => setFulfillmentMode('delivery')}
                      activeOpacity={0.85}
                    >
                      <Truck
                        size={16}
                        color={fulfillmentMode === 'delivery' ? '#ffffff' : BRAND_COLOR}
                        style={styles.fulfillmentOptionIcon}
                      />
                      <Text
                        style={[
                          styles.fulfillmentOptionText,
                          fulfillmentMode === 'delivery' && styles.fulfillmentOptionTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        Delivery
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.fulfillmentOption,
                        fulfillmentMode === 'store' && styles.fulfillmentOptionActive,
                      ]}
                      onPress={() => setFulfillmentMode('store')}
                      activeOpacity={0.85}
                    >
                      <Package
                        size={16}
                        color={fulfillmentMode === 'store' ? '#ffffff' : BRAND_COLOR}
                        style={styles.fulfillmentOptionIcon}
                      />
                      <Text
                        style={[
                          styles.fulfillmentOptionText,
                          fulfillmentMode === 'store' && styles.fulfillmentOptionTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        Pickup
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {fulfillmentMode === 'store' ? (
                    <View style={styles.pickupInfoBox}>
                      <Text style={styles.pickupInfoTitle}>Pickup</Text>
                      <Text style={styles.pickupInfoText}>
                        You can pick up this item from the store.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.deliveryAddressBox}>
                      <View style={styles.deliveryAddressHeaderRow}>
                        <Text style={styles.deliveryAddressLabel}>Deliver to</Text>
                        <TouchableOpacity
                          onPress={() =>
                            navigation.navigate('Addresses', {
                              selectMode: true,
                              returnTo: 'ProductDetails',
                            })
                          }
                          activeOpacity={0.85}
                        >
                          <Text style={styles.deliveryAddressAction}>Change</Text>
                        </TouchableOpacity>
                      </View>

                      {addressLoading ? (
                        <View style={styles.deliveryAddressLoadingRow}>
                          <ActivityIndicator size="small" color={BRAND_COLOR} />
                          <Text style={styles.deliveryAddressLoadingText}>Loading address…</Text>
                        </View>
                      ) : selectedAddress ? (
                        <>
                          <Text style={styles.deliveryAddressLine} numberOfLines={2}>
                            {selectedAddress.address_line}
                          </Text>
                          <Text style={styles.deliveryAddressMeta} numberOfLines={1}>
                            {selectedAddress.city}
                            {selectedAddress.city && selectedAddress.country ? ', ' : ''}
                            {selectedAddress.country}
                          </Text>
                          {fulfillmentEtaLabel ? (
                            <Text style={styles.deliveryEtaText}>{fulfillmentEtaLabel}</Text>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Text style={styles.deliveryAddressEmptyText}>
                            Add your delivery address to continue.
                          </Text>
                          <TouchableOpacity
                            style={styles.addAddressInlineButton}
                            onPress={() =>
                              navigation.navigate('AddAddress', {
                                returnTo: 'ProductDetails',
                              })
                            }
                            activeOpacity={0.85}
                          >
                            <Text style={styles.addAddressInlineButtonText}>Add Address</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {colors.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.colorHeaderRow}>
                    <Text style={styles.sectionLabel}>Color</Text>
                    {selectedColor ? (() => {
                      const selectedLabel = String(selectedColor);
                      const selectedBg = resolveColorBackground(selectedLabel) || '#ffffff';
                      const selectedBorder = selectedBg.toLowerCase() === '#ffffff' ? '#e5e7eb' : 'transparent';
                      return (
                        <View style={styles.colorSelectedPill}>
                          <View
                            style={[
                              styles.colorSelectedDot,
                              { backgroundColor: selectedBg, borderColor: selectedBorder },
                            ]}
                          />
                          <Text style={styles.colorSelectedText} numberOfLines={1}>
                            {selectedLabel}
                          </Text>
                        </View>
                      );
                    })() : null}
                  </View>

                  <View style={styles.colorGrid}>
                    {colors.map((color) => {
                      const value = String(color);
                      const isActive = selectedColor === color;
                      const bg = resolveColorBackground(value);
                      const bgSafe = bg || '#ffffff';
                      const borderColor = bgSafe.toLowerCase() === '#ffffff' ? '#e5e7eb' : 'transparent';
                      return (
                        <ScalePress
                          key={value}
                          onPress={() => setSelectedColor(color)}
                        >
                          <View style={[styles.colorTile, isActive && styles.colorTileActive]}>
                            <View style={[styles.colorDotWrap, isActive && styles.colorDotWrapActive]}>
                              <View style={[styles.colorDot, { backgroundColor: bgSafe, borderColor }]}>
                                {isActive && (
                                  <View style={styles.colorCheckBadge}>
                                    <Check size={12} color={BRAND_COLOR} />
                                  </View>
                                )}
                              </View>
                            </View>
                            <Text
                              style={[styles.colorTileLabel, isActive && styles.colorTileLabelActive]}
                              numberOfLines={1}
                            >
                              {value}
                            </Text>
                          </View>
                        </ScalePress>
                      );
                    })}
                  </View>
                </View>
              )}

              {sizes.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Size</Text>
                  <View style={styles.optionRow}>
                    {sizes.map((size) => {
                      const isActive = selectedSize === size;
                      return (
                        <ScalePress
                          key={size}
                          onPress={() => setSelectedSize(size)}
                        >
                          <View style={[styles.sizeOption, isActive && styles.sizeOptionActive]}>
                            <Text
                              style={[styles.sizeOptionText, isActive && styles.sizeOptionTextActive]}
                              numberOfLines={1}
                            >
                              {size}
                            </Text>
                          </View>
                        </ScalePress>
                      );
                    })}
                  </View>
                </View>
              )}

          {!isBrandUser && similarProducts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.similarHeaderRow}>
                <Text style={styles.sectionLabel}>You might also like</Text>
                <TouchableOpacity onPress={handleSeeAllSimilar} activeOpacity={0.8}>
                  <Text style={styles.similarSeeAllText}>See All</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={visibleSimilarProducts}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                renderItem={renderSimilarItem}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.similarRow}
                contentContainerStyle={styles.similarListContent}
                onEndReached={handleLoadMoreSimilar}
                onEndReachedThreshold={0.5}
              />
            </View>
          )}

            </>
          )}
        </ScrollView>
      </View>

      <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.previewOverlay}>
            <TouchableOpacity
              style={styles.previewBackdrop}
              activeOpacity={1}
              onPress={() => setPreviewVisible(false)}
            />
            <View style={styles.previewContent}>
              <TouchableOpacity
                style={styles.previewCloseButton}
                onPress={() => setPreviewVisible(false)}
              >
                <Text style={styles.previewCloseText}>×</Text>
              </TouchableOpacity>
              {previewImageUri ? (
                <Image
                  source={{ uri: previewImageUri }}
                  style={styles.previewImage}
                  contentFit="contain"
                  cachePolicy="disk"
                  transition={200}
                />
              ) : null}
            </View>
          </View>
        </Modal>

      {activeInfoTab !== 'reviews' && (
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceRow}>
          <View>
            <Text style={styles.bottomPriceLabel}>Total Price</Text>
            <Text style={styles.bottomPriceMeta}>incl. VAT, SD</Text>
          </View>
          <View style={styles.bottomPriceValueCol}>
            {isFlashActive && flashPrice != null ? (
              <>
                <Text style={styles.bottomPriceOld}>${currentPrice.toFixed(2)}</Text>
                <Text style={styles.bottomPriceValue}>${flashPrice.toFixed(2)}</Text>
              </>
            ) : (
              <Text style={styles.bottomPriceValue}>${currentPrice.toFixed(2)}</Text>
            )}
          </View>
        </View>
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={[
              styles.bottomSecondaryButton,
              (quantity <= 0 || isAdminUser || isBrandUser) && styles.bottomButtonDisabled,
            ]}
            activeOpacity={0.9}
            disabled={quantity <= 0 || isAdminUser || isBrandUser}
            onPress={() => {
              const chosenDelivery = deliveryOptions.find((opt) => opt.id === selectedDeliveryId) || null;

              addToCart({
                ...product,
                selectedColor,
                selectedSize,
                selectedDeliveryId,
                deliveryOptions: deliveryOptions.length > 0 ? deliveryOptions : product.delivery_options || [],
                selectedDeliveryOption: chosenDelivery,
              });
              navigation.navigate('Billing');
            }}
          >
            <View style={styles.bottomButtonContentRow}>
              <ShoppingBag size={16} color={BRAND_COLOR} />
              <Text style={styles.bottomSecondaryText}>Buy Now</Text>
            </View>
          </TouchableOpacity>
          <Animated.View
            style={{
              transform: [{ scale: addToCartAnim }],
              opacity: addToCartOpacity,
              flex: 1,
            }}
          >
            <TouchableOpacity
              style={[
                styles.bottomPrimaryButton,
                (quantity <= 0 || isAdminUser || isBrandUser) && styles.bottomButtonDisabled,
              ]}
              activeOpacity={0.9}
              disabled={quantity <= 0 || isAdminUser || isBrandUser}
              onPress={() => {
                const chosenDelivery =
                  deliveryOptions.find((opt) => opt.id === selectedDeliveryId) || null;

                if (inCart) {
                  removeFromCart(product.id);
                } else {
                  addToCart({
                    ...product,
                    selectedColor,
                    selectedSize,
                    selectedDeliveryId,
                    deliveryOptions:
                      deliveryOptions.length > 0
                        ? deliveryOptions
                        : product.delivery_options || [],
                    selectedDeliveryOption: chosenDelivery,
                  });
                }

                Animated.parallel([
                  Animated.sequence([
                    Animated.timing(addToCartAnim, {
                      toValue: 0.9,
                      duration: 60,
                      useNativeDriver: true,
                    }),
                    Animated.timing(addToCartAnim, {
                      toValue: 1.05,
                      duration: 100,
                      useNativeDriver: true,
                    }),
                    Animated.timing(addToCartAnim, {
                      toValue: 1,
                      duration: 80,
                      useNativeDriver: true,
                    }),
                  ]),
                  Animated.sequence([
                    Animated.timing(addToCartOpacity, {
                      toValue: 0.85,
                      duration: 60,
                      useNativeDriver: true,
                    }),
                    Animated.timing(addToCartOpacity, {
                      toValue: 1,
                      duration: 140,
                      useNativeDriver: true,
                    }),
                  ]),
                ]).start();
              }}
            >
              <View style={styles.bottomButtonContentRow}>
                <ShoppingCart size={16} color="#ffffff" />
                <Text style={styles.bottomPrimaryText}>
                  {inCart ? 'Added ✔' : 'Add to Cart'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
      )}
    </SafeAreaView>
  );
};

export default ProductDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  // Enhanced Image Styles
  imageHeader: {
    height: '48%',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  slideWrapper: {
    width: screenWidth,
    height: '100%',
  },
  imageSlide: {
    width: screenWidth,
    height: '100%',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  navArrowLeft: {
    left: 16,
  },
  navArrowRight: {
    right: 16,
  },
  navArrowDisabled: {
    opacity: 0.4,
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  indicatorDotActive: {
    backgroundColor: BRAND_COLOR,
    width: 24,
  },
  
  // Enhanced Header
  headerOverlay: {
    position: 'absolute',
    top: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  
  // Enhanced Title Section
  titleRow: {
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  titleTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  productName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_COLOR,
    lineHeight: 22,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  ratingStarButton: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4B5563',
  },
  productBrand: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(9,9,102,0.72)',
    marginBottom: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  
  // Enhanced Tabs
  infoTabsSection: {
    marginTop: 20,
    marginBottom: 20,
    position: 'relative',
  },
  infoTabsHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  infoTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 12,
  },
  infoTabIcon: {
    marginRight: 8,
  },
  infoTabButtonActive: {
    backgroundColor: BRAND_COLOR,
  },
  infoTabLabel: {
    minWidth: 0,
    flexShrink: 1,
    includeFontPadding: false,
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  infoTabLabelActive: {
    color: '#ffffff',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: '50%',
    height: 'calc(100% - 8px)',
    backgroundColor: BRAND_COLOR,
    borderRadius: 12,
  },
  
  // Enhanced Description
  descriptionContainer: {
    marginTop: 16,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  descriptionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  descriptionExpandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptionExpandText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  descriptionTextWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
  },
  descriptionGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  productFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: SUCCESS_COLOR,
  },
  
  // Enhanced Reviews
  reviewsWriteSection: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  reviewsWriteCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 2,
    borderTopColor: ACCENT_COLOR,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewsWriteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 8,
  },
  reviewsWriteIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewsWriteTitleWrapper: {
    flex: 1,
  },
  reviewsWriteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginBottom: 1,
  },
  reviewsWriteSub: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  reviewsWriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: ACCENT_COLOR,
    borderRadius: 10,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reviewsWriteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  reviewsHeaderSection: {
    marginBottom: 20,
  },
  reviewsHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  ratingSummaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    gap: 20,
  },
  ratingSummaryLeft: {
    alignItems: 'center',
  },
  ratingBigNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: BRAND_COLOR,
  },
  ratingBigStars: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  ratingCountText: {
    fontSize: 12,
    color: '#6B7280',
  },
  ratingDistribution: {
    flex: 1,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 16,
  },
  ratingBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginHorizontal: 8,
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: ACCENT_COLOR,
    borderRadius: 3,
  },
  ratingBarPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 32,
    textAlign: 'right',
  },
  reviewsListSection: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reviewAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  reviewAuthorInfo: {
    flex: 1,
  },
  reviewAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  reviewRatingContainer: {
    alignItems: 'center',
  },
  reviewRatingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  reviewStars: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    marginBottom: 12,
  },
  reviewPhotos: {
    flexDirection: 'row',
    marginTop: 8,
  },
  reviewPhoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
  },
  reviewPhotoImage: {
    width: '100%',
    height: '100%',
  },
  
  // Enhanced Thumbnails
  thumbRow: {
    marginTop: 16,
    marginBottom: 16,
  },
  thumbRowContent: {
    paddingHorizontal: 2,
  },
  thumbWrapper: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  thumbWrapperActive: {
    borderColor: BRAND_COLOR,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: BRAND_COLOR,
  },
  
  // Enhanced Content Panel
  contentPanel: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: -40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  
  // Enhanced Info Tab Body
  infoTabBody: {
    paddingTop: 16,
  },
  
  // Enhanced Button Styles
  seeAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: BRAND_COLOR,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  seeAllButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  
  // Enhanced Badges
  flashBadgeDetail: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: ACCENT_COLOR,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  flashBadgeDetailText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  flashSoldOutBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#EF4444',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  flashSoldOutBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
  },
  codePillLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#6b7280',
    marginRight: 10,
  },
  codePillValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  codeValueWrapper: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  codeValue: {
    fontWeight: '700',
    color: '#111827',
  },
  codeCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#090966',
  },
  codeCopyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  fulfillmentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  fulfillmentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#090966',
  },
  fulfillmentSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    lineHeight: 16,
  },
  fulfillmentRow: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 4,
    marginTop: 6,
  },
  fulfillmentOption: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fulfillmentOptionIcon: {
    marginRight: 8,
  },
  fulfillmentOptionActive: {
    backgroundColor: '#090966',
  },
  fulfillmentOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#090966',
  },
  fulfillmentOptionTextActive: {
    color: '#ffffff',
  },
  openStoreButton: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,9,102,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(9,9,102,0.18)',
  },
  openStoreButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#090966',
  },
  pickupInfoBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 12,
  },
  pickupInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#090966',
    marginBottom: 6,
  },
  pickupInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    lineHeight: 16,
  },
  deliveryAddressBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 12,
  },
  deliveryAddressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  deliveryAddressLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.4,
  },
  deliveryAddressAction: {
    fontSize: 12,
    fontWeight: '800',
    color: '#090966',
  },
  deliveryAddressLine: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 18,
  },
  deliveryAddressMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  deliveryAddressEmptyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    lineHeight: 16,
  },
  addAddressInlineButton: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#090966',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAddressInlineButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  deliveryAddressLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryAddressLoadingText: {
    marginLeft: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
  },
  deliveryCityBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  deliveryCityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 8,
  },
  deliveryCityInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  deliveryEtaText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#090966',
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  infoTabsSection: {
    marginTop: 12,
    marginBottom: 12,
  },
  infoTabsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 2,
    marginBottom: 8,
  },
  infoTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 10,
  },
  infoTabButtonActive: {
    backgroundColor: '#090966',
  },
  infoTabLabel: {
    minWidth: 0,
    flexShrink: 1,
    includeFontPadding: false,
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  infoTabLabelActive: {
    color: '#ffffff',
  },
  infoTabBody: {
    paddingTop: 8,
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sellerValue: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
  },
  viewStoreButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#090966',
  },
  viewStoreButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  editButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  imageHeader: {
    height: '48%',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  slideWrapper: {
    width: Dimensions.get('window').width,
    height: '100%',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 16,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: '#2563EB',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  contentPanel: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: -40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  previewContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: Dimensions.get('window').height * 0.6,
    borderRadius: 16,
    backgroundColor: '#000',
  },
  previewCloseButton: {
    alignSelf: 'flex-end',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17,24,39,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  previewCloseText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  thumbRow: {
    marginTop: 16,
    marginBottom: 8,
  },
  thumbRowContent: {
    paddingHorizontal: 2,
  },
  thumbWrapper: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  thumbWrapperActive: {
    borderColor: '#090966',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    marginBottom: 16,
  },
  productName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_COLOR,
    lineHeight: 22,
  },
  productBrand: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(9,9,102,0.72)',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  ratingStarButton: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4B5563',
  },
  description: {
    color: '#090966',
    lineHeight: 22,
    marginTop: 0,
    marginBottom: 0,
  },
  descriptionContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  descriptionTextWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  descriptionGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  descriptionSeeMoreButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9,9,102,0.06)',
  },
  descriptionSeeMoreText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#090966',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 19,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#090966',
  },
  colorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  colorSelectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#090966',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.65)',
  },
  colorSelectedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorSelectedText: {
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 140,
    color: '#FFFFFF',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  colorTile: {
    width: 72,
    paddingVertical: 9,
    borderRadius: 16,
    marginHorizontal: 5,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  colorTileActive: {
    borderColor: '#FBBF24',
    backgroundColor: 'rgba(251,191,36,0.10)',
  },
  colorDotWrap: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  colorDotWrapActive: {
    backgroundColor: 'rgba(251,191,36,0.18)',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  colorCheckBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.92)',
  },
  colorTileLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '800',
    color: '#111827',
    maxWidth: 66,
    textAlign: 'center',
  },
  colorTileLabelActive: {
    color: '#090966',
  },
  colorSwatchItem: {
    width: 76,
    paddingVertical: 10,
    borderRadius: 14,
    marginHorizontal: 4,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  colorSwatchItemActive: {
    borderColor: '#090966',
    backgroundColor: 'rgba(9,9,102,0.04)',
  },
  colorSwatchCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  colorSwatchCircleActive: {
    borderColor: '#090966',
  },
  colorSwatchLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    maxWidth: 68,
    textAlign: 'center',
  },
  colorOption: {
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginHorizontal: 4,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  colorOptionActive: {
    borderColor: '#090966',
    backgroundColor: 'rgba(9,9,102,0.06)',
  },
  colorSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  colorSwatchActive: {
    borderColor: '#090966',
  },
  colorOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#090966',
  },
  colorOptionTextActive: {
    color: '#090966',
  },
  sizeOption: {
    minWidth: 52,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginHorizontal: 4,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sizeOptionActive: {
    borderColor: '#090966',
    backgroundColor: '#090966',
  },
  sizeOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#090966',
  },
  sizeOptionTextActive: {
    color: '#ffffff',
  },
  chip: {
    minWidth: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 0,
    marginHorizontal: 4,
    marginBottom: 8,
    marginRight: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#090966',
  },
  chipText: {
    color: '#090966',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 25,
    backgroundColor: '#ffffff',
  },
  deliveryRowActive: {
    borderColor: '#090966',
    backgroundColor: '#eff6ff',
  },
  deliveryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#090966',
  },
  deliveryMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  deliveryPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090966',
  },
  deliveryTimeTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#090966',
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  bottomPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bottomPriceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#090966',
  },
  bottomPriceMeta: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  bottomPriceValueCol: {
    alignItems: 'flex-end',
  },
  bottomPriceOld: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  bottomPriceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#090966',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  bottomButtonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  bottomSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#090966',
    backgroundColor: ACCENT_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#090966',
  },
  bottomPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#090966',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bottomPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  bottomButtonDisabled: {
    opacity: 0.5,
  },
  flashSoldOutBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  flashSoldOutBadgeText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  filtersRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  sortOptionActive: {
    backgroundColor: '#111827',
  },
  sortOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  sortOptionTextActive: {
    color: '#ffffff',
  },
  reviewForm: {
    marginTop: 8,
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reviewFormTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    color: '#090966',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  textArea: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    fontSize: 13,
    marginBottom: 8,
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    fontSize: 13,
    flex: 1,
  },
  submitButton: {
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  reviewCard: {
    marginTop: 8,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  reviewDateText: {
    fontSize: 11,
    color: '#6b7280',
  },
  countryBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  countryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4f46e5',
  },
  reviewStarsRowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 6,
  },
  sizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    marginRight: 6,
    marginBottom: 4,
  },
  sizeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  reviewText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 20,
  },
  photoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  photoPickerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  photoPickerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  reviewPhotoWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  removePhotoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  brandReplyBubble: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  userReplyBubble: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  replyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  replyUserName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  brandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  replyText: {
    fontSize: 12,
    color: '#111827',
    lineHeight: 18,
    marginTop: 2,
  },
  replyDateText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  replyFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  smallSubmitButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  smallSubmitButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  loadMoreButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  loadMoreButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  reviewsSummaryText: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  seeAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#090966',
  },
  seeAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  reviewPreviewRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 15,
  },
  reviewAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  reviewAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
  },
  reviewPreviewContent: {
    flex: 1,
  },
  reviewPreviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  reviewPreviewRatingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewPreviewRatingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  reviewPreviewRatingLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  reviewPreviewText: {
    marginTop: 4,
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 18,
  },
  qaForm: {
    marginTop: 4,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  questionCard: {
    marginTop: 8,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  similarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  similarSeeAllText: {
    color: '#090966',
    fontWeight: '700',
    fontSize: 13,
  },
  similarListContent: {
    paddingBottom: 8,
  },
  similarRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  similarCard: {
    flex: 1,
    marginRight: 12,
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
  similarImageWrapper: {
    height: 140,
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  similarImage: {
    width: '100%',
    height: '100%',
  },
  similarImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarImagePlaceholderText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  similarWishlistIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarBrand: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  similarName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  similarPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  similarPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  similarAddButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarAddButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
});
