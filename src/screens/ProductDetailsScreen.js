import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShoppingCart, Heart, Star } from 'lucide-react-native';
import { useStore } from '../store/store';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUserProductRating, upsertUserProductRating, fetchProductRatingSummary } from '../services/ratings';
import { fetchProductReviews, createProductReview, fetchReviewReplies, addReviewReply, updateProductReview, deleteProductReview } from '../services/reviews';
import { fetchProductQuestions, createProductQuestion, fetchAnswersForQuestions, createProductAnswer } from '../services/questions';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

const ProductDetailsScreen = ({ route, navigation }) => {
  const { product } = route.params;
  const addToCart = useStore((state) => state.addToCart);
  const wishlist = useStore((state) => state.wishlist);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const userType = useStore((state) => state.userType);
  const authRole = useStore((state) => state.authRole);
  const products = useStore((state) => state.products);
  const productRatings = useStore((state) => state.productRatings);
  const setProductRating = useStore((state) => state.setProductRating);
  const authUserId = useStore((state) => state.authUserId);
  const userName = useStore((state) => state.userName);

  const inWishlist = wishlist.some((item) => item.id === product.id);

  const quantity = Number(product.quantity ?? 0);
  const availabilityLabel = quantity > 0 ? `${quantity} in stock` : 'Out of stock';

  const baseProducts = Array.isArray(products) ? products : [];

  const isBrandUser = userType === 'brand' || authRole === 'brand';
  const isAdminUser = authRole === 'admin';
  const ownsProduct = !!(authUserId && product.brand_user_id && product.brand_user_id === authUserId);

  const currentRating = productRatings[product.id] || 0;

  const similarProducts = useMemo(() => {
    const brandName = product.brand || '';
    const brandUserId = product.brand_user_id || null;

    if (!Array.isArray(baseProducts) || baseProducts.length === 0) return [];

    const scored = baseProducts
      .filter((p) => p && p.id !== product.id)
      .map((p) => {
        let score = 0;

        const sameBrand = brandName && (p.brand || '') === brandName;
        const sameStore = brandUserId && p.brand_user_id === brandUserId;

        if (sameBrand) score += 3;
        if (sameStore) score += 1;

        // Light boost for products with images and price defined
        if (p.image || (Array.isArray(p.images) && p.images.length > 0)) score += 0.5;
        if (p.price != null) score += 0.5;

        return { product: p, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.map((row) => row.product);
  }, [baseProducts, product]);

  const handleCopyCode = async () => {
    if (!product.code) return;
    await Clipboard.setStringAsync(product.code.toString());
    Alert.alert('Copied', 'Product code copied to clipboard.');
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

  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);

  const imageScrollRef = useRef(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
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
  const [showAllSimilar, setShowAllSimilar] = useState(false);
  const [activeInfoTab, setActiveInfoTab] = useState('description'); // 'description' | 'reviews'

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

  const VISIBLE_SIMILAR_COUNT = 8;
  const visibleSimilarProducts = showAllSimilar
    ? similarProducts
    : similarProducts.slice(0, VISIBLE_SIMILAR_COUNT);
  const hasMoreSimilar = similarProducts.length > VISIBLE_SIMILAR_COUNT;

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
      const { items, hasMore } = await fetchProductReviews({
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
    <View style={styles.container}>
      {/* Image Header - single hero image */}
      <View style={styles.imageHeader}>
        {images.length > 0 && (
          <View style={styles.slideWrapper}>
            <Image
              source={{ uri: images[selectedImageIndex] }}
              style={styles.headerImage}
              contentFit="cover"
              cachePolicy="disk"
              transition={250}
            />
          </View>
        )}
        <SafeAreaView style={styles.headerOverlay}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.iconButton}
          >
            <ArrowLeft color="black" size={24} />
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
        </SafeAreaView>
      </View>

      {/* Content */}
      <View style={styles.contentPanel}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.productName}>{product.name}</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = currentRating ? currentRating >= star : avgRating >= star;

                  // For normal customers: interactive rating
                  if (!isBrandUser && !isAdminUser) {
                    return (
                      <TouchableOpacity
                        key={star}
                        onPress={async () => {
                          setProductRating(product.id, star);
                          try {
                            if (authUserId) {
                              await upsertUserProductRating(product.id, authUserId, star);
                            }
                          } catch (e) {
                            console.warn('Failed to save product rating', e.message || e);
                          }
                        }}
                        style={styles.ratingStarButton}
                      >
                        <Star
                          size={20}
                          color={active ? '#FBBF24' : '#D1D5DB'}
                          fill={active ? '#FBBF24' : 'transparent'}
                        />
                      </TouchableOpacity>
                    );
                  }

                  // For brand/admin: read-only stars (no onPress)
                  return (
                    <View key={star} style={styles.ratingStarButton}>
                      <Star
                        size={20}
                        color={active ? '#FBBF24' : '#D1D5DB'}
                        fill={active ? '#FBBF24' : 'transparent'}
                      />
                    </View>
                  );
                })}
                <Text style={styles.ratingText}>
                  {currentRating
                    ? currentRating.toFixed(1)
                    : avgRating != null
                    ? avgRating.toFixed(1)
                    : '0.0'}
                  {ratingCount > 0 ? ` (${ratingCount})` : ''}
                </Text>
              </View>
              <Text style={styles.productBrand}>{product.brand}</Text>
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

          {/* Thumbnails */}
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
                  style={[styles.thumbWrapper, index === selectedImageIndex && styles.thumbWrapperActive]}
                  onPress={() => setSelectedImageIndex(index)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri }}
                    style={styles.thumbImage}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={200}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {product.code ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Product code</Text>
              <View style={styles.codeRow}>
                <View style={styles.codeValueWrapper}>
                  <Text style={styles.codeValue}>{product.code}</Text>
                </View>
                <TouchableOpacity style={styles.codeCopyButton} onPress={handleCopyCode}>
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

          {colors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Color</Text>
              <View style={styles.chipRow}>
                {colors.map((color, index) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.chip,
                      selectedColor === color && styles.chipActive,
                    ]}
                    onPress={() => {
                      setSelectedColor(color);
                      setSelectedImageIndex(index);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedColor === color && styles.chipTextActive,
                      ]}
                    >
                      {color}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {sizes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Size</Text>
              <View style={styles.chipRow}>
                {sizes.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.chip,
                      selectedSize === size && styles.chipActive,
                    ]}
                    onPress={() => setSelectedSize(size)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedSize === size && styles.chipTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {deliveryOptions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Delivery</Text>
              {deliveryOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.deliveryRow,
                    selectedDeliveryId === opt.id && styles.deliveryRowActive,
                  ]}
                  onPress={() => setSelectedDeliveryId(opt.id)}
                >
                  <View>
                    <Text style={styles.deliveryTitle}>{opt.label}</Text>
                    {opt.eta ? (
                      <Text style={styles.deliveryMeta}>{opt.eta}</Text>
                    ) : null}
                  </View>
                  {typeof opt.price === 'number' && (
                    <Text style={styles.deliveryPrice}>${opt.price}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Info tabs: Description / Reviews */}
          <View style={styles.infoTabsSection}>
            <View style={styles.infoTabsHeaderRow}>
              <TouchableOpacity
                style={[
                  styles.infoTabButton,
                  activeInfoTab === 'description' && styles.infoTabButtonActive,
                ]}
                onPress={() => setActiveInfoTab('description')}
              >
                <Text
                  style={[
                    styles.infoTabLabel,
                    activeInfoTab === 'description' && styles.infoTabLabelActive,
                  ]}
                >
                  Description
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.infoTabButton,
                  activeInfoTab === 'reviews' && styles.infoTabButtonActive,
                ]}
                onPress={() => setActiveInfoTab('reviews')}
              >
                <Text
                  style={[
                    styles.infoTabLabel,
                    activeInfoTab === 'reviews' && styles.infoTabLabelActive,
                  ]}
                >
                  Reviews
                </Text>
              </TouchableOpacity>
            </View>

            {activeInfoTab === 'description' ? (
              <View style={styles.infoTabBody}>
                <Text style={styles.description}>{product.description}</Text>
              </View>
            ) : (
              <View style={styles.infoTabBody}>
                <View style={styles.section}>
                  <View style={styles.reviewsHeaderRow}>
                    <View>
                      <Text style={styles.sectionLabel}>Reviews</Text>
                      <Text style={styles.reviewsSummaryText}>
                        {ratingCount} Reviews · {avgRating != null ? avgRating.toFixed(1) : '0.0'} ★
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.seeAllButton}
                      onPress={() =>
                        navigation.navigate('ProductReviews', {
                          productId: product.id,
                          productName: product.name,
                        })
                      }
                    >
                      <Text style={styles.seeAllButtonText}>See all</Text>
                    </TouchableOpacity>
                  </View>

                  {reviewsLoading && featuredReviews.length === 0 ? (
                    <ActivityIndicator style={{ marginTop: 12 }} />
                  ) : null}

                  {featuredReviews.slice(0, 3).map((review) => (
                    <View key={review.id} style={styles.reviewPreviewRow}>
                      <View style={styles.reviewAvatarCircle}>
                        <Text style={styles.reviewAvatarInitial}>
                          {(review.user_display_name || 'C').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.reviewPreviewContent}>
                        <View style={styles.reviewPreviewHeaderRow}>
                          <Text style={styles.reviewUserName} numberOfLines={1}>
                            {review.user_display_name || 'Customer'}
                          </Text>
                          <View style={styles.reviewPreviewRatingBlock}>
                            <Text style={styles.reviewPreviewRatingValue}>
                              {review.rating.toFixed(1)}
                            </Text>
                            <Text style={styles.reviewPreviewRatingLabel}> rating</Text>
                          </View>
                        </View>
                        <View style={styles.reviewMetaRow}>
                          <Text style={styles.reviewDateText}>
                            {formatTimeAgo(review.created_at)}
                          </Text>
                        </View>
                        <View style={styles.reviewStarsRowStatic}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={14}
                              color={review.rating >= star ? '#FBBF24' : '#D1D5DB'}
                              fill={review.rating >= star ? '#FBBF24' : 'transparent'}
                            />
                          ))}
                        </View>
                        <Text style={styles.reviewPreviewText} numberOfLines={2}>
                          {review.text}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Questions & Answers</Text>

                  {!isAdminUser && authUserId && (
                    <View style={styles.qaForm}>
                      <TextInput
                        style={styles.textArea}
                        placeholder="Ask about size, material, delivery..."
                        value={questionText}
                        onChangeText={setQuestionText}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.submitButton}
                        disabled={submittingQuestion || !questionText}
                        onPress={async () => {
                          try {
                            setSubmittingQuestion(true);
                            const deviceLang =
                              typeof Intl !== 'undefined' && Intl.DateTimeFormat
                                ? Intl.DateTimeFormat().resolvedOptions().locale
                                : null;
                            await createProductQuestion({
                              productId: product.id,
                              userId: authUserId,
                              text: questionText,
                              countryCode: null,
                              deviceLang,
                            });
                            setQuestionText('');
                            loadQuestions(true);
                          } catch (e) {
                            Alert.alert('Error', 'Failed to submit question.');
                          } finally {
                            setSubmittingQuestion(false);
                          }
                        }}
                      >
                        {submittingQuestion ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.submitButtonText}>Ask question</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {questionsLoading && questions.length === 0 ? (
                    <ActivityIndicator style={{ marginTop: 12 }} />
                  ) : null}

                  {questions.map((q) => {
                    const answers = answersMap[q.id] || [];
                    const brandAnswers = answers.filter((a) => a.is_brand_owner);
                    const otherAnswers = answers.filter((a) => !a.is_brand_owner);
                    return (
                      <View key={q.id} style={styles.questionCard}>
                        <View style={styles.questionHeaderRow}>
                          <View>
                            <Text style={styles.reviewUserName}>{userName || 'Customer'}</Text>
                            <View style={styles.reviewMetaRow}>
                              <Text style={styles.reviewDateText}>
                                {formatTimeAgo(q.created_at)}
                              </Text>
                              {q.country_code ? (
                                <View style={styles.countryBadge}>
                                  <Text style={styles.countryBadgeText}>{q.country_code}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                        </View>
                        <Text style={styles.questionText}>{q.text}</Text>

                        {brandAnswers.map((a) => (
                          <View key={a.id} style={styles.brandReplyBubble}>
                            <View style={styles.replyHeaderRow}>
                              <Text style={styles.replyUserName}>Brand Owner</Text>
                              <View style={styles.brandBadge}>
                                <Text style={styles.brandBadgeText}>Brand Owner</Text>
                              </View>
                            </View>
                            <Text style={styles.replyText}>{a.text}</Text>
                            <Text style={styles.replyDateText}>
                              {formatTimeAgo(a.created_at)}
                            </Text>
                          </View>
                        ))}

                        {otherAnswers.map((a) => (
                          <View key={a.id} style={styles.userReplyBubble}>
                            <View style={styles.replyHeaderRow}>
                              <Text style={styles.replyUserName}>User</Text>
                            </View>
                            <Text style={styles.replyText}>{a.text}</Text>
                            <Text style={styles.replyDateText}>
                              {formatTimeAgo(a.created_at)}
                            </Text>
                          </View>
                        ))}

                        {authUserId && (
                          <View style={styles.replyFormRow}>
                            <TextInput
                              style={styles.textInput}
                              placeholder={
                                ownsProduct && (isBrandUser || isAdminUser)
                                  ? 'Answer as brand owner...'
                                  : 'Add an answer...'
                              }
                              value={answerDrafts[q.id] || ''}
                              onChangeText={(text) =>
                                setAnswerDrafts((prev) => ({ ...prev, [q.id]: text }))
                              }
                            />
                            <TouchableOpacity
                              style={styles.smallSubmitButton}
                              onPress={async () => {
                                const text = answerDrafts[q.id];
                                if (!text) return;
                                try {
                                  setSubmittingAnswerIds((prev) => ({
                                    ...prev,
                                    [q.id]: true,
                                  }));
                                  const created = await createProductAnswer({
                                    questionId: q.id,
                                    userId: authUserId,
                                    text,
                                    isBrandOwner: ownsProduct && (isBrandUser || isAdminUser),
                                  });
                                  setAnswersMap((prev) => ({
                                    ...prev,
                                    [q.id]: [...(prev[q.id] || []), created],
                                  }));
                                  setAnswerDrafts((prev) => ({ ...prev, [q.id]: '' }));
                                } catch (e) {
                                  Alert.alert('Error', 'Failed to submit answer.');
                                } finally {
                                  setSubmittingAnswerIds((prev) => ({
                                    ...prev,
                                    [q.id]: false,
                                  }));
                                }
                              }}
                            >
                              {submittingAnswerIds[q.id] ? (
                                <ActivityIndicator color="#ffffff" />
                              ) : (
                                <Text style={styles.smallSubmitButtonText}>Send</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {questionsHasMore && !questionsLoading ? (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={() => loadQuestions(false)}
                    >
                      <Text style={styles.loadMoreButtonText}>Load more questions</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          </View>

          {similarProducts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Similar products</Text>
              <View style={styles.similarGrid}>
                {visibleSimilarProducts.map((item, index) => {
                  const coverImage =
                    (Array.isArray(item.images) && item.images[0]) || item.image || null;
                  const priceValue =
                    typeof item.price === 'number'
                      ? item.price
                      : Number(item.price) || 0;

                  return (
                    <TouchableOpacity
                      key={`${item.id}-${index}`}
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
                      </View>
                      {item.brand ? (
                        <Text style={styles.similarBrand} numberOfLines={1}>
                          {item.brand}
                        </Text>
                      ) : null}
                      <Text style={styles.similarName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.similarPrice}>
                        {priceValue > 0 ? `$${priceValue.toFixed(2)}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {hasMoreSimilar && !showAllSimilar && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() => setShowAllSimilar(true)}
                >
                  <Text style={styles.loadMoreButtonText}>Show more</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

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
        {/* Sticky bottom bar is rendered outside ScrollView */}
      </View>

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
                selectedDeliveryId,
                deliveryOptions: deliveryOptions.length > 0 ? deliveryOptions : product.delivery_options || [],
                selectedDeliveryOption: chosenDelivery,
              });
              navigation.navigate('Billing');
            }}
          >
            <Text style={styles.bottomSecondaryText}>Buy Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.bottomPrimaryButton,
              (quantity <= 0 || isAdminUser || isBrandUser) && styles.bottomButtonDisabled,
            ]}
            activeOpacity={0.9}
            disabled={quantity <= 0 || isAdminUser || isBrandUser}
            onPress={() => {
              const chosenDelivery = deliveryOptions.find((opt) => opt.id === selectedDeliveryId) || null;

              addToCart({
                ...product,
                selectedDeliveryId,
                deliveryOptions: deliveryOptions.length > 0 ? deliveryOptions : product.delivery_options || [],
                selectedDeliveryOption: chosenDelivery,
              });
              navigation.navigate('Main', { screen: 'Cart' });
            }}
          >
            <Text style={styles.bottomPrimaryText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ProductDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  codeCopyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  infoTabsSection: {
    marginTop: 8,
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
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTabButtonActive: {
    backgroundColor: '#2563EB',
  },
  infoTabLabel: {
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
    backgroundColor: '#111827',
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
    borderColor: '#2563EB',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  productBrand: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStarButton: {
    marginLeft: 2,
  },
  ratingText: {
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 4,
  },
  description: {
    color: '#6b7280',
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
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
    backgroundColor: '#111827',
  },
  chipText: {
    color: '#111827',
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
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  deliveryRowActive: {
    borderColor: '#2563EB',
    backgroundColor: '#eff6ff',
  },
  deliveryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  deliveryMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  deliveryPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
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
    color: '#111827',
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
    color: '#111827',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  bottomSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#8b5cf6',
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4c1d95',
  },
  bottomPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
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
    color: '#111827',
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
    marginTop: 4,
  },
  reviewPhotosRow: {
    marginTop: 8,
  },
  reviewPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
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
    backgroundColor: '#111827',
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
  questionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  questionText: {
    fontSize: 13,
    color: '#111827',
    lineHeight: 20,
    marginTop: 2,
  },
  similarList: {
    paddingVertical: 4,
  },
  similarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  similarCard: {
    width: '48%',
    marginHorizontal: 6,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  similarImageWrapper: {
    width: '100%',
    height: 120,
    backgroundColor: '#f3f4f6',
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
  similarBrand: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 8,
    marginHorizontal: 10,
  },
  similarName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
    marginHorizontal: 10,
  },
  similarPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginTop: 6,
    marginBottom: 10,
    marginHorizontal: 10,
  },
});
