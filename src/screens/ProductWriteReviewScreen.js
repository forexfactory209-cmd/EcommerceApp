import React, { useState } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Star, Camera, X, Upload, Check } from 'lucide-react-native';
import { Animated } from 'react-native';

import { useStore } from '../store/store';
import { createProductReview, updateProductReview } from '../services/reviews';
import { supabase } from '../lib/supabase';

const { width: screenWidth } = Dimensions.get('window');
const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';

const TAGS = ['Good quality', 'Fast delivery', 'Recommended', 'Not same as picture'];
const SIZE_OPTIONS = [
  { key: 'true_to_size', label: 'True to size', icon: '👌' },
  { key: 'smaller', label: 'Runs small', icon: '👇' },
  { key: 'bigger', label: 'Runs large', icon: '👆' },
];

const useScaleAnimation = () => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };
  return { animatedStyle: { transform: [{ scale }] }, onPressIn, onPressOut };
};

const StarRating = ({ rating, onChange }) => {
  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star;
        return (
          <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.85}>
            <Animated.View style={[styles.starWrapper, useScaleAnimation().animatedStyle]}>
              <Star
                size={36}
                color={filled ? ACCENT_COLOR : '#E5E7EB'}
                fill={filled ? ACCENT_COLOR : 'transparent'}
              />
            </Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const Chip = ({ label, icon, active, onPress }) => {
  const { animatedStyle, onPressIn, onPressOut } = useScaleAnimation();
  return (
    <Animated.View style={[animatedStyle, styles.chipWrapper]}>
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <Text style={styles.chipIcon}>{icon}</Text>
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        {active && <Check size={14} color={BRAND_COLOR} style={styles.chipCheck} />}
      </TouchableOpacity>
    </Animated.View>
  );
};

const PhotoThumbnail = ({ uri, onRemove }) => (
  <View style={styles.photoThumb}>
    <Image source={{ uri }} style={styles.photoThumbImage} />
    <TouchableOpacity style={styles.photoRemove} onPress={onRemove} activeOpacity={0.85}>
      <X size={14} color="#ffffff" />
    </TouchableOpacity>
  </View>
);

const Section = ({ title, children, required }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {required && <Text style={styles.required}>*</Text>}
    </View>
    {children}
  </View>
);

const ProductWriteReviewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, productName, editingReview } = route.params || {};

  const authUserId = useStore((state) => state.authUserId);
  const userName = useStore((state) => state.userName);
  const orders = useStore((state) => state.orders) || [];

  const hasPurchasedProduct = orders.some((order) => {
    if (!order || !Array.isArray(order.items)) return false;

    const raw = (order.status || '').toString().toLowerCase();
    const isSuccessfulOrder =
      raw !== 'canceled' &&
      raw !== 'cancelled' &&
      raw !== 'failed' &&
      raw !== 'refunded';

    if (!isSuccessfulOrder) return false;

    return order.items.some(
      (item) => item && (item.id === productId || item.product_id === productId),
    );
  });

  const [reviewRating, setReviewRating] = useState(editingReview?.rating || 0);
  const [reviewText, setReviewText] = useState(editingReview?.text || '');
  const [reviewSizeFeedback, setReviewSizeFeedback] = useState(editingReview?.size_feedback || null);
  const [reviewTags, setReviewTags] = useState(editingReview?.tags || []);
  const [reviewPhotos, setReviewPhotos] = useState(editingReview?.photos || []);
  const [submittingReview, setSubmittingReview] = useState(false);

  const toggleTag = (tag) => {
    setReviewTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  };

  const handleSubmitReview = async () => {
    try {
      if (!productId || !authUserId) {
        Alert.alert('Error', 'You must be logged in to write a review.');
        return;
      }

      if (!hasPurchasedProduct) {
        Alert.alert(
          'Order required',
          'You can only review products you have purchased. Please place an order for this product first.',
        );
        return;
      }

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

      const photos = uploadedUrls.length > 0 ? uploadedUrls : reviewPhotos;
      const deviceLang =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().locale
          : null;

      if (editingReview?.id) {
        await updateProductReview({
          reviewId: editingReview.id,
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

      navigation.goBack();
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
          <ArrowLeft size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{editingReview ? 'Edit Review' : 'Write a Review'}</Text>
          {productName ? <Text style={styles.headerSubtitle}>{productName}</Text> : null}
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your rating</Text>
            <StarRating rating={reviewRating} onChange={setReviewRating} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fit (optional)</Text>
            <View style={styles.fitRow}>
              {SIZE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.fitOption,
                    reviewSizeFeedback === opt.key && styles.fitOptionActive,
                  ]}
                  onPress={() =>
                    setReviewSizeFeedback(reviewSizeFeedback === opt.key ? null : opt.key)
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.fitIcon}>{opt.icon}</Text>
                  <Text style={styles.fitLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags (optional)</Text>
            <View style={styles.chipsRow}>
              {TAGS.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  icon={tag === 'Good quality' ? '✨' : tag === 'Fast delivery' ? '🚀' : tag === 'Recommended' ? '👍' : '🚫'}
                  active={reviewTags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your review</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Share your experience with this product..."
              placeholderTextColor="#9CA3AF"
              value={reviewText}
              onChangeText={setReviewText}
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos (optional)</Text>
            <TouchableOpacity
              style={styles.photoPicker}
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
              activeOpacity={0.85}
            >
              <Camera size={20} color={BRAND_COLOR} />
              <Text style={styles.photoPickerText}>Add photos (up to 5)</Text>
            </TouchableOpacity>

            {reviewPhotos.length > 0 && (
              <View style={styles.photoThumbs}>
                {reviewPhotos.map((uri, idx) => (
                  <PhotoThumbnail
                    key={uri + idx}
                    uri={uri}
                    onRemove={() => setReviewPhotos((prev) => prev.filter((p, i) => i !== idx))}
                  />
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!reviewRating || !reviewText) && styles.submitButtonDisabled,
            ]}
            disabled={submittingReview || !reviewRating || !reviewText}
            onPress={handleSubmitReview}
            activeOpacity={0.85}
          >
            {submittingReview ? (
              <ActivityIndicator color={BRAND_COLOR} />
            ) : (
              <>
                <Check size={20} color={BRAND_COLOR} />
                <Text style={styles.submitButtonText}>
                  {editingReview ? 'Save changes' : 'Submit review'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    backgroundColor: BRAND_COLOR,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    marginTop: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLOR,
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starWrapper: {
    padding: 4,
  },
  fitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fitOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fitOptionActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: ACCENT_COLOR,
  },
  fitIcon: {
    fontSize: 16,
  },
  fitLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: BRAND_COLOR,
    borderColor: BRAND_COLOR,
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  chipCheck: {
    marginLeft: 2,
  },
  textArea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    backgroundColor: '#ffffff',
  },
  photoPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  photoPickerText: {
    fontSize: 14,
    color: BRAND_COLOR,
    fontWeight: '500',
  },
  photoThumbs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  photoThumb: {
    position: 'relative',
  },
  photoThumbImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: ACCENT_COLOR,
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  submitButtonText: {
    color: BRAND_COLOR,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ProductWriteReviewScreen;
