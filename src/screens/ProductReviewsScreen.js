import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Star } from 'lucide-react-native';

import { useStore } from '../store/store';
import {
  fetchProductReviews,
  fetchReviewReplies,
  createProductReview,
  updateProductReview,
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
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reviews</Text>
          <View style={{ width: 32 }} />
        </View>
      </SafeAreaView>

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
          <TouchableOpacity
            style={styles.addReviewButton}
            onPress={() => {
              navigation.navigate('ProductWriteReview', {
                productId,
                productName,
              });
            }}
          >
            <Text style={styles.addReviewButtonText}>Add Review</Text>
          </TouchableOpacity>
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
                  {isOwner && (
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeArea: {
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
