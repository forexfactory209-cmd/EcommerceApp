import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { useStore } from '../store/store';
import {
  fetchProductQuestions,
  fetchAnswersForQuestions,
  updateProductQuestion,
  deleteProductQuestion,
} from '../services/questions';

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

const ProductQuestionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, productName } = route.params || {};

  const authUserId = useStore((state) => state.authUserId);
  const authRole = useStore((state) => state.authRole);
  const userType = useStore((state) => state.userType);

  const isBrandUser = userType === 'brand' || authRole === 'brand';

  const [questions, setQuestions] = useState([]);
  const [answersMap, setAnswersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | answered | unanswered
  const [sortBy, setSortBy] = useState('newest'); // newest | oldest
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);

  const loadQuestions = async (resetPage = true) => {
    if (!productId) return;
    const nextPage = resetPage ? 1 : page + 1;
    if (!resetPage && (loadingMore || !hasMore)) return;

    resetPage ? setLoading(true) : setLoadingMore(true);
    try {
      const { items, hasMore: nextHasMore } = await fetchProductQuestions({
        productId,
        page: nextPage,
      });

      const nextItems = items || [];
      setQuestions((prev) => (resetPage ? nextItems : [...prev, ...nextItems]));
      setPage(nextPage);
      setHasMore(!!nextHasMore);

      const ids = (resetPage ? nextItems : [...questions, ...nextItems])
        .map((q) => q.id)
        .filter(Boolean);
      if (ids.length > 0) {
        const map = await fetchAnswersForQuestions(ids);
        setAnswersMap(map || {});
      } else if (resetPage) {
        setAnswersMap({});
      }
    } catch (e) {
      console.warn('ProductQuestionsScreen: failed to load questions', e.message || e);
    } finally {
      resetPage ? setLoading(false) : setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadQuestions();
    }, [productId])
  );

  const getFilteredAndSortedQuestions = () => {
    let list = [...questions];

    if (statusFilter !== 'all') {
      list = list.filter((q) => {
        const answers = answersMap[q.id] || [];
        const hasBrandAnswer = answers.some((a) => a.is_brand_owner);
        if (statusFilter === 'answered') return hasBrandAnswer;
        if (statusFilter === 'unanswered') return !hasBrandAnswer;
        return true;
      });
    }

    list.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;

      if (sortBy === 'oldest') {
        return aTime - bTime;
      }
      // default newest first
      return bTime - aTime;
    });

    return list;
  };

  const visibleQuestions = getFilteredAndSortedQuestions();

  const beginEditQuestion = (q) => {
    setEditingQuestionId(q.id);
    setEditingText(q.text || '');
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setEditingText('');
  };

  const handleSaveQuestion = async (q) => {
    const text = (editingText || '').trim();
    if (!text || !authUserId) return;

    try {
      const updated = await updateProductQuestion({
        questionId: q.id,
        userId: authUserId,
        text,
      });

      setQuestions((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, text: updated.text } : item)),
      );
      cancelEditQuestion();
    } catch (e) {
      console.warn('Failed to update question', e.message || e);
      Alert.alert('Error', 'Could not update your question. Please try again.');
    }
  };

  const handleDeleteQuestion = async (q) => {
    if (!authUserId) return;

    Alert.alert(
      'Delete question',
      'Are you sure you want to delete this question?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingQuestionId(q.id);
              await deleteProductQuestion({ questionId: q.id, userId: authUserId });
              setQuestions((prev) => prev.filter((item) => item.id !== q.id));
            } catch (e) {
              console.warn('Failed to delete question', e.message || e);
              Alert.alert('Error', 'Could not delete your question. Please try again.');
            } finally {
              setDeletingQuestionId(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Questions &amp; Answers</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryCount}>{questions.length} Questions</Text>
          {productName ? (
            <Text style={styles.productName} numberOfLines={1}>
              {productName}
            </Text>
          ) : null}
        </View>
        {!isBrandUser && (
          <TouchableOpacity
            style={styles.addQuestionButton}
            onPress={() =>
              navigation.navigate('ProductAskQuestion', {
                productId,
                productName,
              })
            }
          >
            <Text style={styles.addQuestionButtonText}>Ask a question</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filtersRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[{ id: 'all', label: 'All' }, { id: 'answered', label: 'Answered' }, { id: 'unanswered', label: 'Unanswered' }].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.filterChip,
                statusFilter === opt.id && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(opt.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === opt.id && styles.filterChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}

          {[{ id: 'newest', label: 'Newest' }, { id: 'oldest', label: 'Oldest' }].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.filterChip,
                sortBy === opt.id && styles.filterChipActive,
              ]}
              onPress={() => setSortBy(opt.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  sortBy === opt.id && styles.filterChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && !questions.length ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : null}

        {visibleQuestions.map((q) => {
          const answers = answersMap[q.id] || [];
          const brandAnswers = answers.filter((a) => a.is_brand_owner);
          const firstBrandAnswer = brandAnswers[0] || null;
          const isOwner = authUserId && q.user_id === authUserId;
          const isEditing = editingQuestionId === q.id;

          return (
            <View key={q.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {(q.user_name || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.customerName}>{q.user_name || 'Customer'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.timeAgo}>{formatTimeAgo(q.created_at)}</Text>
                    {q.country_code ? (
                      <View style={styles.countryBadge}>
                        <Text style={styles.countryBadgeText}>{q.country_code}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {isEditing ? (
                <TextInput
                  style={styles.editQuestionInput}
                  value={editingText}
                  onChangeText={setEditingText}
                  multiline
                />
              ) : (
                <Text style={styles.questionText}>Q: {q.text}</Text>
              )}

              {isOwner && (
                <View style={styles.questionActionsRow}>
                  {isEditing ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionPrimary]}
                        onPress={() => handleSaveQuestion(q)}
                      >
                        <Text style={styles.actionPrimaryText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionSecondary]}
                        onPress={cancelEditQuestion}
                      >
                        <Text style={styles.actionSecondaryText}>Cancel</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionSecondary]}
                        onPress={() => beginEditQuestion(q)}
                      >
                        <Text style={styles.actionSecondaryText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.actionDanger]}
                        disabled={deletingQuestionId === q.id}
                        onPress={() => handleDeleteQuestion(q)}
                      >
                        <Text style={styles.actionDangerText}>
                          {deletingQuestionId === q.id ? 'Deleting…' : 'Delete'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {firstBrandAnswer ? (
                <View style={styles.answerBox}>
                  <Text style={styles.answerLabel}>Brand answer</Text>
                  <Text style={styles.answerText}>A: {firstBrandAnswer.text}</Text>
                  <Text style={styles.answerDate}>{formatTimeAgo(firstBrandAnswer.created_at)}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {!loading && visibleQuestions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No questions yet</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to ask about size, material, delivery or anything else you
              want to know.
            </Text>
          </View>
        )}

        {hasMore && !loading && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => loadQuestions(false)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator color="#111827" />
            ) : (
              <Text style={styles.loadMoreText}>Load more questions</Text>
            )}
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
    paddingBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  productName: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  addQuestionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  addQuestionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  timeAgo: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  countryBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  countryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#11126F',
  },
  questionText: {
    marginTop: 10,
    fontSize: 13,
    color: '#374151',
  },
  editQuestionInput: {
    marginTop: 10,
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  questionActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 8,
  },
  actionPrimary: {
    backgroundColor: '#11126F',
  },
  actionPrimaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionSecondary: {
    backgroundColor: '#E5E7EB',
  },
  actionSecondaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  actionDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionDangerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
  },
  answerBox: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#11126F',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 13,
    color: '#111827',
  },
  answerDate: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  filtersRow: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
  },
  filterChipText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  loadMoreButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
});

export default ProductQuestionsScreen;
