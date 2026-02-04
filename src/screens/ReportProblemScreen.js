import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Image as ImageIcon, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const TICKET_TYPES = [
  { id: 'order_issue', label: 'Order Issue' },
  { id: 'technical_glitch', label: 'Technical Glitch' },
  { id: 'vendor_dispute', label: 'Vendor Dispute' },
];

const ORDER_ISSUE_REASONS = [
  'Wrong item received',
  'Size mismatch',
  'Late delivery',
  'Damaged or defective item',
  'Bad service / attitude',
  'Other',
];

const MAX_DESCRIPTION = 500;

const ReportProblemScreen = ({ navigation, route }) => {
  const authUserId = useStore((state) => state.authUserId);
  const [type, setType] = useState('order_issue');
  const [orderId, setOrderId] = useState(route?.params?.orderId ? String(route.params.orderId) : '');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState(null); // { uri, name, type }
  const [orderIssueReason, setOrderIssueReason] = useState('');
  const [showReasonOptions, setShowReasonOptions] = useState(false);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.7,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      const uri = asset.uri;
      const fileName = uri.split('/').pop() || 'screenshot.jpg';
      const ext = (fileName.split('.').pop() || 'jpg').toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      setImage({ uri, name: fileName, type: mimeType });
    } catch (e) {
      Alert.alert('Error', 'Could not open gallery.');
      console.warn('ReportProblem: image picker error', e);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Missing info', 'Please describe the issue you are facing.');
      return;
    }

    if (type === 'order_issue' && !orderIssueReason) {
      Alert.alert('Missing info', 'Please select the type of order issue.');
      return;
    }

    if (!authUserId) {
      Alert.alert('Not logged in', 'Please log in again and try submitting your report.');
      return;
    }

    setUploading(true);

    try {
      let screenshotUrl = null;

      if (image?.uri) {
        const fileExt = image.name.split('.').pop() || 'jpg';
        const path = `${authUserId}/${Date.now()}.${fileExt}`;

        try {
          const response = await fetch(image.uri);
          const buffer = await response.arrayBuffer();

          if (!buffer || buffer.byteLength === 0) {
            console.warn('ReportProblem: picked image buffer is empty');
            Alert.alert('Upload error', 'Could not read the selected image. Please try again.');
          } else {
            const { error: uploadError } = await supabase.storage
              .from('support_screenshots')
              .upload(path, buffer, {
                upsert: true,
                contentType: image.type || 'image/jpeg',
              });

            if (uploadError) {
              console.warn('ReportProblem: upload error', uploadError);
              Alert.alert('Upload error', uploadError.message || 'Could not upload screenshot.');
            } else {
              const { data: publicData } = supabase.storage
                .from('support_screenshots')
                .getPublicUrl(path);

              screenshotUrl = publicData?.publicUrl || null;
            }
          }
        } catch (uploadException) {
          console.warn('ReportProblem: upload exception', uploadException);
          Alert.alert('Upload error', 'Unexpected error while uploading screenshot.');
        }
      }

      const finalDescription =
        type === 'order_issue' && orderIssueReason
          ? `[Reason: ${orderIssueReason}] ${description.trim()}`
          : description.trim();

      const { error: insertError } = await supabase
        .from('support_tickets')
        .insert({
          user_id: authUserId,
          ticket_type: type,
          order_id_text: orderId || null,
          description: finalDescription,
          order_issue_reason: type === 'order_issue' ? orderIssueReason || null : null,
          screenshot_url: screenshotUrl,
          status: 'open',
        });

      if (insertError) {
        console.warn('ReportProblem: insert error', insertError);
        Alert.alert('Error', insertError.message || 'Failed to submit report');
        setUploading(false);
        return;
      }

      Alert.alert('Thank you', 'Your report has been submitted.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (e) {
      console.warn('ReportProblem: unexpected error', e);
      Alert.alert('Error', 'Something went wrong while submitting your report.');
    } finally {
      setUploading(false);
    }
  };

  const remaining = MAX_DESCRIPTION - description.length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a Problem</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          We are sorry you are facing issues. Please tell us more so we can help resolve it quickly.
        </Text>

        <Text style={styles.sectionLabel}>What went wrong?</Text>

        <View style={styles.typeRow}>
          {TICKET_TYPES.map((t) => {
            const active = type === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => setType(t.id)}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.typeChipLabel,
                    active && styles.typeChipLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {type === 'order_issue' && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Order ID</Text>
              <View style={styles.inputWrapper}>
                <ImageIcon size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.input}
                  placeholder="# ORD-12345-XYZ"
                  placeholderTextColor="#9CA3AF"
                  value={orderId}
                  onChangeText={setOrderId}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Order issue type</Text>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                activeOpacity={0.9}
                onPress={() => setShowReasonOptions((prev) => !prev)}
              >
                <Text style={orderIssueReason ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {orderIssueReason || 'Select an issue type'}
                </Text>
              </TouchableOpacity>
              {showReasonOptions && (
                <View style={styles.dropdownList}>
                  {ORDER_ISSUE_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={styles.dropdownItem}
                      activeOpacity={0.9}
                      onPress={() => {
                        setOrderIssueReason(reason);
                        setShowReasonOptions(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{reason}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Description</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <TextInput
              style={styles.textArea}
              placeholder="Please describe the issue you are facing. Include details like error messages or steps to reproduce..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={(text) => {
                if (text.length <= MAX_DESCRIPTION) {
                  setDescription(text);
                }
              }}
              multiline
            />
          </View>
          <Text style={styles.charCounter}>{remaining}/500 characters</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Attachments</Text>
          <TouchableOpacity
            style={[styles.attachmentBox, image && styles.attachmentBoxActive]}
            activeOpacity={0.9}
            onPress={handlePickImage}
          >
            <View style={styles.attachmentIconCircle}>
              <Upload size={20} color="#11146E" />
            </View>
            <Text style={styles.attachmentTitle}>
              {image ? 'Screenshot selected' : 'Upload Screenshot'}
            </Text>
            <Text style={styles.attachmentSubtitle}>JPG, PNG up to 5MB</Text>
            {image?.name ? (
              <Text style={styles.attachmentFileName} numberOfLines={1}>
                {image.name}
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, uploading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          activeOpacity={0.9}
          disabled={uploading}
        >
          <Text style={styles.submitButtonText}>{uploading ? 'Submitting...' : 'Submit Report  '}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportProblemScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#090966',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipActive: {
    backgroundColor: '#11146E',
    borderColor: '#11146E',
  },
  typeChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  typeChipLabelActive: {
    color: '#FFFFFF',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
  },
  textArea: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  dropdownTrigger: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  dropdownValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  dropdownList: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
  },
  charCounter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  attachmentBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    borderColor: '#D1D5DB',
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  attachmentBoxActive: {
    borderColor: '#11146E',
    backgroundColor: '#EEF2FF',
  },
  attachmentIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  attachmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  attachmentSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  attachmentFileName: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 4,
    maxWidth: '100%',
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 12,
    backgroundColor: '#11146E',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
