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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Star } from 'lucide-react-native';

import { useStore } from '../store/store';
import { createProductReview, updateProductReview } from '../services/reviews';
import { supabase } from '../lib/supabase';

const ProductWriteReviewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, productName, editingReview } = route.params || {};

  const authUserId = useStore((state) => state.authUserId);
  const userName = useStore((state) => state.userName);

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
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editingReview ? 'Edit Review' : 'Write a Review'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {productName ? (
          <Text style={styles.productNameLabel}>{productName}</Text>
        ) : null}

        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Your rating</Text>
          <View style={styles.reviewStarsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setReviewRating(star)}
                style={styles.ratingStarButton}
              >
                <Star
                  size={22}
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
              <Text style={styles.submitButtonText}>
                {editingReview ? 'Save changes' : 'Submit review'}
              </Text>
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
  productNameLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4,
  },
  formSection: {
    marginTop: 8,
    paddingTop: 12,
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
    marginRight: 6,
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
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    marginBottom: 6,
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
  textArea: {
    minHeight: 110,
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
  reviewPhotosRow: {
    marginBottom: 8,
  },
  reviewPhotoWrapper: {
    marginRight: 8,
  },
  reviewPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
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
});

export default ProductWriteReviewScreen;
