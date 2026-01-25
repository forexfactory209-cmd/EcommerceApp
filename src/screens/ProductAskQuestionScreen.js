import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { useStore } from '../store/store';
import { createProductQuestion } from '../services/questions';

const ProductAskQuestionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { productId, productName } = route.params || {};

  const authUserId = useStore((state) => state.authUserId);
  const userName = useStore((state) => state.userName);
  const userType = useStore((state) => state.userType);
  const authRole = useStore((state) => state.authRole);

  const isBrandUser = userType === 'brand' || authRole === 'brand';

  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const text = (questionText || '').trim();
    if (!text || !productId || !authUserId) return;

    try {
      setSubmitting(true);
      const deviceLang =
        typeof Intl !== 'undefined' && Intl.DateTimeFormat
          ? Intl.DateTimeFormat().resolvedOptions().locale
          : null;

      await createProductQuestion({
        productId,
        userId: authUserId,
        text,
        countryCode: null,
        deviceLang,
        userName,
      });

      setQuestionText('');
      // Go back to the list; ProductQuestionsScreen will reload via focus effect
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit question.');
    } finally {
      setSubmitting(false);
    }
  };

  const disabledReason = (() => {
    if (!authUserId) return 'You need an account to ask a question.';
    if (isBrandUser) return 'Brand accounts cannot ask customer questions.';
    return null;
  })();

  const isDisabled = submitting || !questionText.trim() || !!disabledReason;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ask a question</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        {productName ? (
          <Text style={styles.productName} numberOfLines={2}>
            {productName}
          </Text>
        ) : null}

        <Text style={styles.helperText}>
          Ask about size, material, delivery time, returns, or anything else.
        </Text>

        <TextInput
          style={styles.textArea}
          placeholder="Type your question here..."
          value={questionText}
          onChangeText={setQuestionText}
          multiline
          textAlignVertical="top"
        />

        {disabledReason ? (
          <Text style={styles.disabledReason}>{disabledReason}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, isDisabled && styles.submitButtonDisabled]}
          disabled={isDisabled}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Ask question</Text>
          )}
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  helperText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  textArea: {
    marginTop: 16,
    minHeight: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  disabledReason: {
    marginTop: 8,
    fontSize: 12,
    color: '#EF4444',
  },
  submitButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11126F',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ProductAskQuestionScreen;
