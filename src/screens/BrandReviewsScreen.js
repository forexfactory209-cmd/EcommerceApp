import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star } from 'lucide-react-native';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { fetchReviewReplies, addReviewReply, updateReviewReply, deleteReviewReply } from '../services/reviews';

const PAGE_SIZE = 10;

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

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  } catch (e) {
    return '';
  }
};

const BrandReviewsScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const authRole = useStore((state) => state.authRole);
  const products = useStore((state) => state.products) || [];

  const isBrandRole = authRole === 'brand';

  const brandProductIds = useMemo(
    () =>
      (products || [])
        .filter((p) => isBrandRole && authUserId && p.brand_user_id === authUserId)
        .map((p) => p.id)
        .filter(Boolean),
    [products, authUserId, isBrandRole],
  );

  const [reviews, setReviews] = useState([]);
  const [repliesMap, setRepliesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const [tab, setTab] = useState('all'); // all | unanswered | recent | lowest

  const [replyTextByReview, setReplyTextByReview] = useState({});
  const [submittingReplyId, setSubmittingReplyId] = useState(null);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyText, setEditingReplyText] = useState('');

  const loadBrandReviews = async (reset = true) => {
    if (!isBrandRole || !authUserId || brandProductIds.length === 0) return;
    setLoading(true);
    try {
      const nextPage = reset ? 1 : page + 1;

      // Fetch reviews directly from Supabase for all brand products
      const from = (nextPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('product_reviews')
        .select('*', { count: 'exact' })
        .in('product_id', brandProductIds);

      if (tab === 'lowest') {
        query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error, count } = await query.range(from, to);
      if (error) {
        console.warn('Failed to load brand reviews', error.message || error);
        return;
      }

      const items = data || [];
      const total = typeof count === 'number' ? count : items.length;
      const nextHasMore = to + 1 < total;

      const merged = reset ? items : [...reviews, ...items];
      setReviews(merged);
      setPage(nextPage);
      setHasMore(nextHasMore);

      const ids = merged.map((r) => r.id).filter(Boolean);
      if (ids.length > 0) {
        const map = await fetchReviewReplies(ids);
        setRepliesMap(map || {});
      }
    } catch (e) {
      console.warn('Error loading brand reviews', e.message || e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBrandReviews(true);
    }, [authUserId, isBrandRole, brandProductIds.join(','), tab])
  );

  const stats = useMemo(() => {
    if (!reviews.length) {
      return {
        avg: 0,
        total: 0,
        counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    reviews.forEach((r) => {
      const val = Number(r.rating) || 0;
      const rounded = Math.round(val);
      if (rounded >= 1 && rounded <= 5) counts[rounded] += 1;
      sum += val;
    });
    const total = reviews.length;
    const avg = total > 0 ? sum / total : 0;
    return { avg, total, counts };
  }, [reviews]);

  const trustScorePercent = useMemo(() => {
    if (!stats.total) return 0;
    const clampedAvg = Math.max(0, Math.min(5, stats.avg || 0));
    const baseFromRating = (clampedAvg / 5) * 80; // up to 80% from rating
    const volumeBoost = Math.min(20, Math.log10(stats.total + 1) * 20); // up to +20 from volume
    const raw = baseFromRating + volumeBoost;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [stats]);

  const getPercent = (star) => {
    if (!stats.total) return 0;
    return Math.round((stats.counts[star] / stats.total) * 100);
  };

  const filteredReviews = useMemo(() => {
    if (tab === 'unanswered') {
      return reviews.filter((r) => !(repliesMap[r.id] && repliesMap[r.id].length));
    }
    return reviews;
  }, [reviews, repliesMap, tab]);

  const handleReply = async (reviewId) => {
    const text = (replyTextByReview[reviewId] || '').trim();
    if (!text || !authUserId || !isBrandRole) return;

    try {
      setSubmittingReplyId(reviewId);
      await addReviewReply({ reviewId, userId: authUserId, text, isBrandOwner: true });
      setReplyTextByReview((prev) => ({ ...prev, [reviewId]: '' }));
      const map = await fetchReviewReplies([reviewId]);
      setRepliesMap((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.warn('Failed to submit brand reply', e.message || e);
    } finally {
      setSubmittingReplyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews & Ratings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary header */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryRatingBig}>{stats.avg.toFixed(1)}</Text>
            <Text style={styles.summaryOutOf}>/ 5.0</Text>
            <View style={styles.summaryStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  color={stats.avg >= star ? '#FBBF24' : '#E5E7EB'}
                  fill={stats.avg >= star ? '#FBBF24' : 'transparent'}
                />
              ))}
            </View>
            <Text style={styles.summaryReviewsText}>Based on {stats.total} reviews</Text>
          </View>
          <View style={styles.summaryRight}>
            <View style={styles.trustCircleOuter}>
              <View style={styles.trustCircleInner}>
                <Text style={styles.trustScoreValue}>{trustScorePercent}%</Text>
              </View>
            </View>
            <Text style={styles.trustScoreLabel}>Trust Score</Text>
          </View>
        </View>

        {/* Distribution bars */}
        <View style={styles.distributionSection}>
          {[5, 4, 3, 2, 1].map((star) => {
            const pct = getPercent(star);
            return (
              <View key={star} style={styles.distRow}>
                <Text style={styles.distStarLabel}>{star}</Text>
                <View style={styles.distBarTrack}>
                  <View style={[styles.distBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.distPercent}>{pct}%</Text>
              </View>
            );
          })}
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {[
            { id: 'all', label: 'All Reviews' },
            { id: 'unanswered', label: 'Unanswered' },
            { id: 'recent', label: 'Recent' },
            { id: 'lowest', label: 'Lowest Rated' },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => {
                  setTab(t.id);
                  loadBrandReviews(true);
                }}
              >
                <Text style={active ? styles.tabChipTextActive : styles.tabChipText}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !reviews.length ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}

        {filteredReviews.map((review) => {
          const replies = repliesMap[review.id] || [];
          const brandReplies = replies.filter((r) => r.is_brand_owner);
          const brandReply = brandReplies[0];

          const product = (products || []).find((p) => p.id === review.product_id);
          const productName = product?.name || 'Unknown product';
          const imageUrl =
            product?.image_full_url ||
            product?.image_url ||
            (Array.isArray(product?.images) && product.images[0]) ||
            product?.image ||
            null;

          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewUserName}>{review.user_display_name || 'Customer'}</Text>
                  <Text style={styles.reviewDate}>{formatTimeAgo(review.created_at)}</Text>

                  <View style={styles.productChipRow}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.productChipImage} />
                    ) : (
                      <View style={[styles.productChipImage, styles.productChipImagePlaceholder]} />
                    )}
                    <View style={styles.productChip}>
                      <Text style={styles.productChipText} numberOfLines={1}>{productName}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.reviewRatingRow}>
                  <Text style={styles.reviewRatingValue}>{Number(review.rating).toFixed(1)}</Text>
                  <View style={styles.reviewStarsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={12}
                        color={review.rating >= star ? '#FBBF24' : '#E5E7EB'}
                        fill={review.rating >= star ? '#FBBF24' : 'transparent'}
                      />
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.reviewText}>{review.text}</Text>

              {brandReply && (
                <View style={styles.brandReplyBox}>
                  <View style={styles.brandReplyHeader}>
                    <View style={styles.brandReplyBadge}>
                      <Text style={styles.brandReplyBadgeText}>Your Response</Text>
                    </View>
                    <View style={styles.brandReplyHeaderRight}>
                      <Text style={styles.brandReplyDate}>{formatTimeAgo(brandReply.created_at)}</Text>
                      <TouchableOpacity
                        style={styles.brandReplyActionButton}
                        onPress={() => {
                          setEditingReplyId(brandReply.id);
                          setEditingReplyText(brandReply.text || '');
                        }}
                      >
                        <Text style={styles.brandReplyActionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.brandReplyActionButton}
                        onPress={async () => {
                          try {
                            await deleteReviewReply({ replyId: brandReply.id, userId: authUserId });
                            setRepliesMap((prev) => ({
                              ...prev,
                              [review.id]: (prev[review.id] || []).filter((r) => r.id !== brandReply.id),
                            }));
                          } catch (e) {
                            console.warn('Failed to delete reply', e.message || e);
                          }
                        }}
                      >
                        <Text style={styles.brandReplyActionText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {editingReplyId === brandReply.id ? (
                    <>
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
                          <Text style={styles.brandReplyActionText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.saveReplyButton}
                          onPress={async () => {
                            const text = (editingReplyText || '').trim();
                            if (!text) return;
                            try {
                              const updated = await updateReviewReply({
                                replyId: brandReply.id,
                                userId: authUserId,
                                text,
                              });
                              setRepliesMap((prev) => ({
                                ...prev,
                                [review.id]: (prev[review.id] || []).map((r) =>
                                  r.id === brandReply.id ? { ...r, text: updated.text } : r,
                                ),
                              }));
                              setEditingReplyId(null);
                              setEditingReplyText('');
                            } catch (e) {
                              console.warn('Failed to update reply', e.message || e);
                            }
                          }}
                        >
                          <Text style={styles.saveReplyButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.brandReplyText}>{brandReply.text}</Text>
                  )}
                </View>
              )}

              {!brandReply && (
                <View style={styles.replyActionRow}>
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
                    onPress={() => handleReply(review.id)}
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

        {hasMore && !loading && (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => loadBrandReviews(false)}>
            <Text style={styles.loadMoreText}>Load more reviews</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BrandReviewsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  summaryLeft: {},
  summaryRatingBig: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  summaryOutOf: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryStarsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  summaryReviewsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustCircleOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustCircleInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustScoreValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#11126F',
  },
  trustScoreLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#6B7280',
  },
  distributionSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  distStarLabel: {
    width: 14,
    fontSize: 12,
    color: '#4B5563',
  },
  distBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  distBarFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  distPercent: {
    width: 40,
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  tabChipActive: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
  },
  tabChipText: {
    fontSize: 12,
    color: '#4B5563',
  },
  tabChipTextActive: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  reviewDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  reviewRatingRow: {
    alignItems: 'flex-end',
  },
  reviewRatingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewText: {
    marginTop: 6,
    fontSize: 13,
    color: '#4B5563',
  },
  productChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  productChipImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
  },
  productChipImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productChip: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  productChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#11126F',
  },
  brandReplyBox: {
    marginTop: 10,
    backgroundColor: '#E0E7FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandReplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  brandReplyBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#11126F',
  },
  brandReplyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandReplyHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandReplyDate: {
    fontSize: 11,
    color: '#6B7280',
    marginRight: 8,
  },
  brandReplyText: {
    fontSize: 13,
    color: '#111827',
  },
  brandReplyActionButton: {
    marginLeft: 10,
  },
  brandReplyActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#11126F',
  },
  replyActionRow: {
    marginTop: 10,
  },
  replyInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#F9FAFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 6,
  },
  replyButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editReplyInput: {
    marginTop: 8,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#F9FAFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  editReplyButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  saveReplyButton: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  saveReplyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadMoreButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadMoreText: {
    fontSize: 13,
    color: '#2563EB',
  },
});
