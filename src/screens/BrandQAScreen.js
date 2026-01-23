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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowLeft, Filter, MessageCircle } from 'lucide-react-native';

import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import {
  fetchAnswersForQuestions,
  createProductAnswer,
  updateProductAnswer,
  deleteProductAnswer,
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

const BrandQAScreen = () => {
  const navigation = useNavigation();
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

  const [questions, setQuestions] = useState([]);
  const [answersMap, setAnswersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('all'); // all | pending | answered

  const [replyTextByQuestion, setReplyTextByQuestion] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const loadQuestionsForBrand = async () => {
    if (!authUserId || !isBrandRole || brandProductIds.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_questions')
        .select('*')
        .in('product_id', brandProductIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('BrandQAScreen: failed to load questions', error.message || error);
        return;
      }

      const items = Array.isArray(data) ? data : [];
      setQuestions(items);

      const ids = items.map((q) => q.id).filter(Boolean);
      if (ids.length > 0) {
        const map = await fetchAnswersForQuestions(ids);
        setAnswersMap(map || {});
      } else {
        setAnswersMap({});
      }
    } catch (e) {
      console.warn('BrandQAScreen: unexpected error loading questions', e.message || e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadQuestionsForBrand();
    }, [authUserId, isBrandRole, brandProductIds.join(',')])
  );

  const filteredQuestions = useMemo(() => {
    if (tab === 'pending') {
      return questions.filter((q) => {
        const answers = answersMap[q.id] || [];
        return !answers.some((a) => a.is_brand_owner);
      });
    }
    if (tab === 'answered') {
      return questions.filter((q) => {
        const answers = answersMap[q.id] || [];
        return answers.some((a) => a.is_brand_owner);
      });
    }
    return questions;
  }, [questions, answersMap, tab]);

  const handleSubmitAnswer = async (questionId) => {
    const text = (replyTextByQuestion[questionId] || '').trim();
    if (!text || !authUserId || !isBrandRole) return;

    try {
      setSubmittingId(questionId);
      await createProductAnswer({
        questionId,
        userId: authUserId,
        text,
        isBrandOwner: true,
      });
      setReplyTextByQuestion((prev) => ({ ...prev, [questionId]: '' }));
      const map = await fetchAnswersForQuestions([questionId]);
      setAnswersMap((prev) => ({ ...prev, ...map }));
    } catch (e) {
      console.warn('Failed to submit answer', e.message || e);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleUpdateAnswer = async (answerId, questionId) => {
    const text = (editingText || '').trim();
    if (!text || !authUserId) return;

    try {
      setSubmittingId(questionId);
      const updated = await updateProductAnswer({ answerId, userId: authUserId, text });
      setAnswersMap((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || []).map((a) =>
          a.id === answerId ? { ...a, text: updated.text } : a,
        ),
      }));
      setEditingAnswerId(null);
      setEditingText('');
    } catch (e) {
      console.warn('Failed to update answer', e.message || e);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDeleteAnswer = async (answerId, questionId) => {
    try {
      await deleteProductAnswer({ answerId, userId: authUserId });
      setAnswersMap((prev) => ({
        ...prev,
        [questionId]: (prev[questionId] || []).filter((a) => a.id !== answerId),
      }));
    } catch (e) {
      console.warn('Failed to delete answer', e.message || e);
    }
  };

  const getProductForQuestion = (q) => {
    const product = (products || []).find((p) => p.id === q.product_id);
    if (!product) return {};
    const imageUrl =
      product.image_full_url ||
      product.image_url ||
      (Array.isArray(product.images) && product.images[0]) ||
      product.image ||
      null;
    return { productName: product.name || 'Product', imageUrl };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Q&amp;A</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Filter color="#4B5563" size={18} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs */}
        <View style={styles.tabsRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'answered', label: 'Answered' },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setTab(t.id)}
              >
                <Text style={active ? styles.tabChipTextActive : styles.tabChipText}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !questions.length ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}

        {filteredQuestions.map((q) => {
          const answers = answersMap[q.id] || [];
          const brandAnswers = answers.filter((a) => a.is_brand_owner);
          const brandAnswer = brandAnswers[0] || null;
          const statusLabel = brandAnswer ? 'ANSWERED' : 'PENDING';
          const { productName, imageUrl } = getProductForQuestion(q);

          return (
            <View key={q.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {(q.user_name || 'Anonymous').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.customerName}>{q.user_name || 'Anonymous'}</Text>
                  <Text style={styles.timeAgo}>{formatTimeAgo(q.created_at)}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    statusLabel === 'ANSWERED' ? styles.statusAnswered : styles.statusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      statusLabel === 'ANSWERED'
                        ? styles.statusPillTextAnswered
                        : styles.statusPillTextPending,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.productChipRow}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.productChipImage} />
                ) : (
                  <View style={[styles.productChipImage, styles.productChipImagePlaceholder]} />
                )}
                <View style={styles.productChip}>
                  <Text style={styles.productChipText} numberOfLines={1}>
                    {productName}
                  </Text>
                </View>
              </View>

              <Text style={styles.questionText}>{q.text}</Text>

              {brandAnswer && (
                <View style={styles.answerBox}>
                  <View style={styles.answerHeaderRow}>
                    <View style={styles.answerBadge}>
                      <Text style={styles.answerBadgeText}>Your Store Response</Text>
                    </View>
                    <Text style={styles.answerDate}>{formatTimeAgo(brandAnswer.created_at)}</Text>
                  </View>

                  {editingAnswerId === brandAnswer.id ? (
                    <>
                      <TextInput
                        style={styles.editInput}
                        value={editingText}
                        onChangeText={setEditingText}
                        multiline
                      />
                      <View style={styles.editButtonsRow}>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingAnswerId(null);
                            setEditingText('');
                          }}
                        >
                          <Text style={styles.editActionText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.saveButton}
                          onPress={() => handleUpdateAnswer(brandAnswer.id, q.id)}
                        >
                          <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.answerText}>{brandAnswer.text}</Text>
                  )}

                  {!editingAnswerId && (
                    <View style={styles.answerActionsRow}>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingAnswerId(brandAnswer.id);
                          setEditingText(brandAnswer.text || '');
                        }}
                      >
                        <Text style={styles.editActionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ marginLeft: 12 }}
                        onPress={() => handleDeleteAnswer(brandAnswer.id, q.id)}
                      >
                        <Text style={styles.editActionText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {!brandAnswer && (
                <View style={styles.replySection}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Reply to this question as the brand..."
                    value={replyTextByQuestion[q.id] || ''}
                    onChangeText={(text) =>
                      setReplyTextByQuestion((prev) => ({ ...prev, [q.id]: text }))
                    }
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.replyButton}
                    disabled={
                      submittingId === q.id ||
                      !replyTextByQuestion[q.id] ||
                      !replyTextByQuestion[q.id]?.trim()
                    }
                    onPress={() => handleSubmitAnswer(q.id)}
                  >
                    {submittingId === q.id ? (
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

        {!loading && filteredQuestions.length === 0 && (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <MessageCircle color="#9CA3AF" size={28} />
            <Text style={{ marginTop: 8, color: '#9CA3AF', fontSize: 13 }}>
              No questions yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BrandQAScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
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
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tabChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 999,
  },
  tabChipActive: {
    backgroundColor: '#11126F',
  },
  tabChipText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  tabChipTextActive: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusAnswered: {
    backgroundColor: '#DCFCE7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillTextPending: {
    color: '#92400E',
  },
  statusPillTextAnswered: {
    color: '#166534',
  },
  productChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
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
  questionText: {
    marginTop: 10,
    fontSize: 13,
    color: '#4B5563',
  },
  answerBox: {
    marginTop: 10,
    backgroundColor: '#E0E7FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  answerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  answerBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#11126F',
  },
  answerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  answerDate: {
    fontSize: 11,
    color: '#6B7280',
  },
  answerText: {
    marginTop: 4,
    fontSize: 13,
    color: '#111827',
  },
  answerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editInput: {
    marginTop: 6,
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#F9FAFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  editButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#11126F',
  },
  saveButton: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  replySection: {
    marginTop: 10,
  },
  replyInput: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#F9FAFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
  },
  replyButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
