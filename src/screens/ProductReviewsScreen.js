import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Star } from 'lucide-react-native';

import { useStore } from '../store/store';
import {
  fetchProductReviews,
  fetchReviewReplies,
  addReviewReply,
  createProductReview,
  updateProductReview,
  updateReviewReply,
  deleteReviewReply,
} from '../services/reviews';
import { supabase } from '../lib/supabase';

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

const ProductReviewsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, productName } = route.params || {};

  const authUserId = useStore((state) => state.authUserId);
  const userName = useStore((state) => state.userName);
  const authRole = useStore((state) => state.authRole);
  const products = useStore((state) => state.products) || [];
  const orders = useStore((state) => state.orders) || [];

  const isBrandRole = authRole === 'brand';
  const ownsProduct = !!(
    isBrandRole &&
    authUserId &&
    products.find((p) => p.id === productId && p.brand_user_id === authUserId)
  );

  const hasPurchasedProduct = orders.some((order) => {
    if (!order || !Array.isArray(order.items)) return false;
    const status = (order.status || '').toLowerCase();
    const isDeliveredLike = status === 'delivered' || status === 'customer_confirmed';
    if (!isDeliveredLike) return false;
    return order.items.some((item) => item && item.id === productId);
  });

  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRepliesMap, setReviewRepliesMap] = useState({});

  const [reviewsSortBy, setReviewsSortBy] = useState('recent');
  const [ratingFilter, setRatingFilter] = useState(null);
  const [withPhotosFilter, setWithPhotosFilter] = useState(false);
  const [withSizeInfoFilter, setWithSizeInfoFilter] = useState(false);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSizeFeedback, setReviewSizeFeedback] = useState(null);
  const [reviewTags, setReviewTags] = useState([]);
  const [reviewPhotos, setReviewPhotos] = useState([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);

  const [replyTextByReview, setReplyTextByReview] = useState({});
  const [submittingReplyId, setSubmittingReplyId] = useState(null);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyText, setEditingReplyText] = useState('');

  const toggleTag = (tag) => {
    setReviewTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  };

  const loadReviews = async (resetPage = true) => {
    if (!productId) return;
    setReviewsLoading(true);
    try {
      const page = resetPage ? 1 : reviewsPage + 1;
      const { items, hasMore } = await fetchProductReviews({
        productId,
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

  useFocusEffect(
    useCallback(() => {
      loadReviews(true);
    }, [productId, ratingFilter, withPhotosFilter, withSizeInfoFilter, reviewsSortBy])
  );

  const handleSubmitReply = async (reviewId) => {
    const text = (replyTextByReview[reviewId] || '').trim();
    if (!text || !authUserId || !isBrandRole || !ownsProduct) return;

    try {
      setSubmittingReplyId(reviewId);
      await addReviewReply({ reviewId, userId: authUserId, text, isBrandOwner: true });

      setReplyTextByReview((prev) => ({ ...prev, [reviewId]: '' }));

      const map = await fetchReviewReplies([reviewId]);
      setReviewRepliesMap((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.warn('Failed to submit review reply', e.message || e);
      Alert.alert('Error', 'Failed to submit reply.');
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleSubmitReview = async () => {
    try {
      setSubmittingReview(true);
      const uploadedUrls = [];
      for (let i = 0; i < (reviewPhotos || []).length; i += 1) {
        const uri = reviewPhotos[i];
        if (!uri) continue;
        try {
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const extMatch = uri.split('.').pop();
          const ext = extMatch && extMatch.length <= 5 ? extMatch : 'jpg';
          const filePath = `reviews/${authUserId || 'guest'}/${productId}-${Date.now()}-${i}.${ext}`;

          const { error: uploadError } = await supabase
            .storage
            .from('review-photos')
            .upload(filePath, bytes, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) {
            console.warn('Failed to upload review photo', uploadError.message || uploadError);
            Alert.alert('Photo upload error', uploadError.message || JSON.stringify(uploadError));
            continue;
          }

          const { data: publicData } = supabase
            .storage
            .from('review-photos')
            .getPublicUrl(filePath);

          if (publicData?.publicUrl) {
            uploadedUrls.push(publicData.publicUrl);
          }
        } catch (e) {
          console.warn('Error processing review photo', e?.message || e);
          Alert.alert('Photo upload error (catch)', e?.message || String(e));
        }
      }

      const photos = uploadedUrls;
      const deviceLang =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().locale
          : null;

      if (editingReviewId) {
        await updateProductReview({
          reviewId: editingReviewId,
          userId: authUserId,
          rating: reviewRating,
          text: reviewText,
          sizeFeedback: reviewSizeFeedback,
          tags: reviewTags,
          photos,
        });
      } else {
        await createProductReview({
          productId,
          userId: authUserId,
          userDisplayName: userName,
          rating: reviewRating,
          text: reviewText,
          sizeFeedback: reviewSizeFeedback,
          tags: reviewTags,
          photos,
          countryCode: null,
          deviceLang,
        });
      }

      setReviewText('');
      setReviewRating(0);
      setReviewSizeFeedback(null);
      setReviewTags([]);
      setReviewPhotos([]);
      setEditingReviewId(null);
      loadReviews(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryCount}>{reviews.length} Reviews</Text>
            <View style={styles.summaryRatingRow}>
              <Text style={styles.summaryRatingValue}>
                {reviews.length > 0
                  ? (
                      reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length
                    ).toFixed(1)
                  : '0.0'}
              </Text>
              <View style={styles.summaryStarsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    color="#FBBF24"
                    fill="#FBBF24"
                    style={{ marginLeft: star === 1 ? 8 : 2 }}
                  />
                ))}
              </View>
            </View>
          </View>
          {!isBrandRole && (
            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={styles.addReviewButton}
                onPress={() => {
                  if (!hasPurchasedProduct) {
                    Alert.alert(
                      'Order required',
                      'You can only review products you have purchased. Please place an order for this product first.',
                    );
                    return;
                  }

                  navigation.navigate('ProductWriteReview', {
                    productId,
                    productName,
                  });
                }}
              >
                <Text style={styles.addReviewButtonText}>Add Review</Text>
              </TouchableOpacity>
              {!hasPurchasedProduct && (
                <Text style={styles.addReviewHelperText}>Available after delivery</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.filtersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[null, 5, 4, 3, 2, 1].map((val) => (
              <TouchableOpacity
                key={val === null ? 'all' : val}
                style={[
                  styles.filterChip,
                  ratingFilter === val && styles.filterChipActive,
                ]}
                onPress={() => {
                  setRatingFilter(val);
                  loadReviews(true);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    ratingFilter === val && styles.filterChipTextActive,
                  ]}
                >
                  {val === null ? 'All' : `${val}★`}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.filterChip,
                withPhotosFilter && styles.filterChipActive,
              ]}
              onPress={() => {
                setWithPhotosFilter(!withPhotosFilter);
                loadReviews(true);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  withPhotosFilter && styles.filterChipTextActive,
                ]}
              >
                With photos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                withSizeInfoFilter && styles.filterChipActive,
              ]}
              onPress={() => {
                setWithSizeInfoFilter(!withSizeInfoFilter);
                loadReviews(true);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  withSizeInfoFilter && styles.filterChipTextActive,
                ]}
              >
                With size info
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[
              styles.sortOption,
              reviewsSortBy === 'recent' && styles.sortOptionActive,
            ]}
            onPress={() => {
              setReviewsSortBy('recent');
              loadReviews(true);
            }}
          >
            <Text
              style={[
                styles.sortOptionText,
                reviewsSortBy === 'recent' && styles.sortOptionTextActive,
              ]}
            >
              Most recent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sortOption,
              reviewsSortBy === 'helpful' && styles.sortOptionActive,
            ]}
            onPress={() => {
              setReviewsSortBy('helpful');
              loadReviews(true);
            }}
          >
            <Text
              style={[
                styles.sortOptionText,
                reviewsSortBy === 'helpful' && styles.sortOptionTextActive,
              ]}
            >
              Most helpful
            </Text>
          </TouchableOpacity>
        </View>

        {reviewsLoading && reviews.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 12 }} />
        ) : null}

        {reviews.map((review) => {
          const sizeLabel =
            review.size_feedback === 'true_to_size'
              ? 'True to size'
              : review.size_feedback === 'smaller'
              ? 'Smaller'
              : review.size_feedback === 'bigger'
              ? 'Bigger'
              : null;
          const isOwner = authUserId && review.user_id === authUserId;
          const replies = reviewRepliesMap[review.id] || [];
          const brandOwnerId = isBrandRole && ownsProduct ? authUserId : null;
          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeaderRow}>
                <View style={styles.reviewHeaderLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>
                      {(review.user_display_name || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.reviewUserName}>
                      {review.user_display_name || 'Customer'}
                    </Text>
                    <Text style={styles.reviewDateText}>
                      {formatTimeAgo(review.created_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.reviewHeaderRight}>
                  <Text style={styles.reviewRatingValue}>{review.rating.toFixed(1)}</Text>
                  <Text style={styles.reviewRatingLabel}> rating</Text>
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
                  {isOwner && !isBrandRole && (
                    <TouchableOpacity
                      style={styles.editReviewButton}
                      activeOpacity={0.85}
                      onPress={() =>
                        navigation.navigate('ProductWriteReview', {
                          productId,
                          productName,
                          editingReview: review,
                        })
                      }
                    >
                      <Text style={styles.editReviewButtonText}>Edit review</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {sizeLabel ? (
                <View style={styles.reviewChipsRow}>
                  <View style={styles.sizeChip}>
                    <Text style={styles.sizeChipText}>{sizeLabel}</Text>
                  </View>
                </View>
              ) : null}

              <Text style={styles.reviewText}>{review.text}</Text>

              {review.photos && review.photos.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.reviewPhotosRow}
                >
                  {review.photos.map((uri, idx) => (
                    <Image
                      key={uri + idx}
                      source={{ uri }}
                      style={styles.reviewPhoto}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              ) : null}

              {replies.length > 0 && (
                <View style={styles.repliesSection}>
                  {replies.map((reply) => {
                    const isBrandOwnerReply = !!reply.is_brand_owner;
                    const isOwnBrandReply =
                      !!brandOwnerId && reply.user_id && reply.user_id === brandOwnerId;
                    const isEditingThis = editingReplyId === reply.id;

                    return (
                      <View key={reply.id} style={styles.replyItem}>
                        <View style={styles.replyHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {!isBrandOwnerReply && (
                              <Text style={styles.replyAuthorText}>User</Text>
                            )}
                            {isBrandOwnerReply && (
                              <View style={styles.brandReplyBadge}>
                                <Text style={styles.brandReplyBadgeText}>Brand owner</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.replyDateText}>
                              {formatTimeAgo(reply.created_at)}
                            </Text>
                            {isOwnBrandReply && !isEditingThis && (
                              <View style={styles.replyActionsRow}>
                                <TouchableOpacity
                                  onPress={() => {
                                    setEditingReplyId(reply.id);
                                    setEditingReplyText(reply.text || '');
                                  }}
                                >
                                  <Text style={styles.replyActionText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ marginLeft: 8 }}
                                  onPress={async () => {
                                    try {
                                      await deleteReviewReply({
                                        replyId: reply.id,
                                        userId: brandOwnerId,
                                      });
                                      setReviewRepliesMap((prev) => ({
                                        ...prev,
                                        [review.id]: (prev[review.id] || []).filter(
                                          (r) => r.id !== reply.id,
                                        ),
                                      }));
                                    } catch (e) {
                                      Alert.alert('Error', 'Failed to delete reply.');
                                    }
                                  }}
                                >
                                  <Text style={styles.replyActionText}>Delete</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>

                        {isEditingThis && isOwnBrandReply ? (
                          <View style={styles.editReplySection}>
                            <TextInput
                              style={styles.editReplyInput}
                              value={editingReplyText}
                              onChangeText={setEditingReplyText}
                              multiline
                            />
                            <View style={styles.editReplyButtonsRow}>
                              <TouchableOpacity
                                onPress={() => {
                                  setEditingReplyId(null);
                                  setEditingReplyText('');
                                }}
                              >
                                <Text style={styles.replyActionText}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.saveReplyButton}
                                onPress={async () => {
                                  const nextText = (editingReplyText || '').trim();
                                  if (!nextText) return;
                                  try {
                                    const updated = await updateReviewReply({
                                      replyId: reply.id,
                                      userId: brandOwnerId,
                                      text: nextText,
                                    });
                                    setReviewRepliesMap((prev) => ({
                                      ...prev,
                                      [review.id]: (prev[review.id] || []).map((r) =>
                                        r.id === reply.id ? { ...r, text: updated.text } : r,
                                      ),
                                    }));
                                    setEditingReplyId(null);
                                    setEditingReplyText('');
                                  } catch (e) {
                                    Alert.alert('Error', 'Failed to update reply.');
                                  }
                                }}
                              >
                                <Text style={styles.saveReplyButtonText}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.replyText}>{reply.text}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {isBrandRole && ownsProduct && (
                <View style={styles.replyInputSection}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Reply as brand owner..."
                    value={replyTextByReview[review.id] || ''}
                    onChangeText={(text) =>
                      setReplyTextByReview((prev) => ({ ...prev, [review.id]: text }))
                    }
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.replyButton}
                    disabled={
                      submittingReplyId === review.id ||
                      !replyTextByReview[review.id] ||
                      !replyTextByReview[review.id]?.trim()
                    }
                    onPress={() => handleSubmitReply(review.id)}
                  >
                    {submittingReplyId === review.id ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.replyButtonText}>Reply</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {false && (
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Write a review</Text>
          <View style={styles.reviewStarsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setReviewRating(star)}
                style={styles.ratingStarButton}
              >
                <Star
                  size={20}
                  color={reviewRating >= star ? '#FBBF24' : '#D1D5DB'}
                  fill={reviewRating >= star ? '#FBBF24' : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.sizeRow}>
            {['true_to_size', 'smaller', 'bigger'].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.filterChip,
                  reviewSizeFeedback === val && styles.filterChipActive,
                ]}
                onPress={() =>
                  setReviewSizeFeedback(reviewSizeFeedback === val ? null : val)
                }
              >
                <Text
                  style={[
                    styles.filterChipText,
                    reviewSizeFeedback === val && styles.filterChipTextActive,
                  ]}
                >
                  {val === 'true_to_size'
                    ? 'True to size'
                    : val === 'smaller'
                    ? 'Smaller'
                    : 'Bigger'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.tagsRow}>
            {['Good quality', 'Fast delivery', 'Recommended', 'Not same as picture'].map(
              (tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.filterChip,
                    reviewTags.includes(tag) && styles.filterChipActive,
                  ]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      reviewTags.includes(tag) && styles.filterChipTextActive,
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Share your experience..."
            value={reviewText}
            onChangeText={setReviewText}
            multiline
          />
          <View style={styles.photoPickerRow}>
            <TouchableOpacity
              style={styles.photoPickerButton}
              onPress={async () => {
                try {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission needed', 'Please allow access to your photos to upload review images.');
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({
                    allowsMultipleSelection: true,
                    quality: 0.8,
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  });
                  if (result.canceled) return;
                  const picked = result.assets || [];
                  setReviewPhotos((prev) => {
                    const existing = prev || [];
                    const next = [...existing, ...picked.map((a) => a.uri)].slice(0, 5);
                    return next;
                  });
                } catch (e) {
                  Alert.alert('Error', 'Failed to open photo library.');
                }
              }}
            >
              <Text style={styles.photoPickerButtonText}>Add photos (up to 5)</Text>
            </TouchableOpacity>
          </View>
          {reviewPhotos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.reviewPhotosRow}
            >
              {reviewPhotos.map((uri, idx) => (
                <View key={uri + idx} style={styles.reviewPhotoWrapper}>
                  <Image source={{ uri }} style={styles.reviewPhoto} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.removePhotoBadge}
                    onPress={() =>
                      setReviewPhotos((prev) => prev.filter((p, i) => i !== idx))
                    }
                  >
                    <Text style={styles.removePhotoBadgeText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity
            style={styles.submitButton}
            disabled={submittingReview || !reviewRating || !reviewText}
            onPress={handleSubmitReview}
          >
            {submittingReview ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit review</Text>
            )}
          </TouchableOpacity>
        </View>
        )}

        {reviewsHasMore && !reviewsLoading && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => loadReviews(false)}
          >
            <Text style={styles.loadMoreText}>Load more</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  summaryRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  summaryRatingValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  summaryStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addReviewButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f97316',
  },
  addReviewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  addReviewHelperText: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
  },
  filtersRow: {
    marginTop: 4,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#111827',
  },
  filterChipText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  sortRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  sortOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  sortOptionActive: {
    backgroundColor: '#111827',
  },
  sortOptionText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#ffffff',
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b5563',
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  reviewDateText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  reviewHeaderRight: {
    alignItems: 'flex-end',
  },
  reviewRatingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  reviewRatingLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  reviewStarsRowStatic: {
    flexDirection: 'row',
    marginTop: 2,
  },
  editReviewButton: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  editReviewButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  reviewChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  sizeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    marginRight: 6,
  },
  sizeChipText: {
    fontSize: 11,
    color: '#1d4ed8',
    fontWeight: '500',
  },
  reviewText: {
    fontSize: 13,
    color: '#111827',
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
  },
  repliesSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  replyItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 6,
  },
  replyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  replyAuthorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  replyDateText: {
    fontSize: 11,
    color: '#6b7280',
  },
  replyText: {
    fontSize: 13,
    color: '#111827',
    marginTop: 4,
  },
  brandReplyBadge: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  brandReplyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  replyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  replyActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
  },
  editReplySection: {
    marginTop: 6,
  },
  editReplyInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
    backgroundColor: '#ffffff',
  },
  editReplyButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  saveReplyButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  saveReplyButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  replyInputSection: {
    marginTop: 10,
  },
  replyInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  replyButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  replyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  formSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  ratingStarButton: {
    marginRight: 4,
  },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  photoPickerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  photoPickerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoPickerButtonText: {
    fontSize: 13,
    color: '#111827',
  },
  reviewPhotoWrapper: {
    marginRight: 8,
  },
  removePhotoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBadgeText: {
    color: '#ffffff',
    fontSize: 11,
  },
  submitButton: {
    marginTop: 4,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  loadMoreButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  loadMoreText: {
    fontSize: 13,
    color: '#111827',
  },
});

export default ProductReviewsScreen;
