import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

// Minimal base64 -> Uint8Array converter so we don't rely on fetch(dataUrl),
// which can produce 0-byte blobs in React Native.
const base64ToUint8Array = (base64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let clean = String(base64).replace(/[^A-Za-z0-9+/=]/g, '');

  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = chars.indexOf(clean.charAt(i));
    const enc2 = chars.indexOf(clean.charAt(i + 1));
    const enc3 = chars.indexOf(clean.charAt(i + 2));
    const enc4 = chars.indexOf(clean.charAt(i + 3));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(chr1);
    if (enc3 !== 64 && !Number.isNaN(enc3)) bytes.push(chr2);
    if (enc4 !== 64 && !Number.isNaN(enc4)) bytes.push(chr3);
  }

  return new Uint8Array(bytes);
};

const BrandOnboardingScreen = ({ navigation, route }) => {
  const authUserId = useStore((state) => state.authUserId);
  const authEmail = useStore((state) => state.authEmail);
  const setBrandLogoUrl = useStore((state) => state.setBrandLogoUrl);

  const isAdminMode = route?.params?.adminMode === true;
  const editingBrandId = route?.params?.brandId || null;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [brand, setBrand] = useState(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [discountPercentInput, setDiscountPercentInput] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [brandLoginEmail, setBrandLoginEmail] = useState('');
  const [brandLoginPassword, setBrandLoginPassword] = useState('');

  useEffect(() => {
    const loadBrand = async () => {
      try {
        let query = supabase.from('brands').select('*');

        if (isAdminMode) {
          if (!editingBrandId) {
            // Admin creating a brand from scratch - no initial load
            setContactEmail('');
            setInitialLoading(false);
            return;
          }
          query = query.eq('id', editingBrandId);
        } else {
          if (!authUserId) {
            setInitialLoading(false);
            return;
          }
          query = query.eq('user_id', authUserId);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
          console.warn('Error loading brand:', error.message);
        }

        if (data) {
          setBrand(data);
          setName(data.name || '');
          setSlug(data.slug || '');
          const currentLogo = data.logo_url || '';
          setLogoUrl(currentLogo);
          setBrandLogoUrl(currentLogo);
          setDescription(data.description || '');
          setContactEmail(data.contact_email || authEmail || '');
          setContactPhone(data.contact_phone || '');
        } else {
          setContactEmail(authEmail || '');
        }
      } catch (e) {
        console.warn('Error loading brand:', e);
      } finally {
        setInitialLoading(false);
      }
    };
    loadBrand();
  }, [authUserId, authEmail, isAdminMode, editingBrandId]);

  const handlePickLogo = async () => {
    if (!authUserId && !isAdminMode) {
      Alert.alert('Not signed in', 'You need to be logged in to update your brand logo.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photos to choose a logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets && result.assets[0];
      if (!asset?.uri) return;

      setUploadingLogo(true);

      const ownerId = authUserId || 'admin';
      const fileExt = (asset.uri.split('.').pop() || 'jpg').split('?')[0];
      const mimeType = asset.type || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      const fileName = `brand-${ownerId}-${Date.now()}.${fileExt}`;

      // Read the image file as base64 via FileSystem (most reliable across Expo Go devices)
      const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
        // Use string literal to avoid SDK differences in EncodingType enum
        encoding: 'base64',
      });

      const byteArray = base64ToUint8Array(base64Data);

      const { data, error } = await supabase.storage
        .from('brand-logos')
        // In React Native, pass a Uint8Array/ArrayBuffer directly instead of a Blob.
        .upload(fileName, byteArray, {
          cacheControl: '3600',
          upsert: true,
          contentType: mimeType,
        });

      if (error || !data) {
        Alert.alert('Upload failed', error?.message || 'Could not upload logo.');
        return;
      }

      const { data: publicData } = supabase.storage
        .from('brand-logos')
        .getPublicUrl(data.path);

      if (publicData?.publicUrl) {
        setLogoUrl(publicData.publicUrl);
        setBrandLogoUrl(publicData.publicUrl);
      }
    } catch (e) {
      console.warn('Logo upload error', e);
      Alert.alert('Upload error', 'Something went wrong while uploading the logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async () => {
    if (!authUserId && !isAdminMode) {
      Alert.alert('Not signed in', 'You need to be logged in to apply as a brand.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Missing information', 'Please enter your brand name.');
      return;
    }

    if (isAdminMode && !editingBrandId) {
      if (!brandLoginEmail.trim() || !brandLoginPassword.trim()) {
        Alert.alert('Missing credentials', 'Please enter a login email and password for the brand.');
        return;
      }
    }

    if (loading) return;
    setLoading(true);

    const basePayload = {
      name: name.trim(),
      slug: slug.trim() || null,
      logo_url: logoUrl.trim() || null,
      description: description.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
    };

    try {
      let data;
      let error;

      if (isAdminMode) {
        if (editingBrandId) {
          const result = await supabase
            .from('brands')
            .update(basePayload)
            .eq('id', editingBrandId)
            .select()
            .maybeSingle();
          data = result.data;
          error = result.error;
        } else {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !sessionData?.session?.access_token) {
            Alert.alert('Error', 'Could not verify admin session. Please log in again.');
            return;
          }

          const accessToken = sessionData.session.access_token;
          const functionUrl = 'https://aeivheqhwlifhancoswz.supabase.co/functions/v1/create-brand-with-user';

          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              brandLoginEmail: brandLoginEmail.trim(),
              brandLoginPassword: brandLoginPassword.trim(),
              name: basePayload.name,
              slug: basePayload.slug,
              logo_url: basePayload.logo_url,
              description: basePayload.description,
              contact_email: basePayload.contact_email,
              contact_phone: basePayload.contact_phone,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            Alert.alert('Error', text || 'Could not create brand user.');
            return;
          }

          const json = await response.json();
          data = json.brand || null;
          error = null;
        }
      } else {
        const payload = {
          ...basePayload,
          user_id: authUserId,
        };
        const result = await supabase
          .from('brands')
          .upsert([payload], { onConflict: 'user_id' })
          .select()
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) {
        Alert.alert('Error', error.message || 'Could not submit brand application.');
        return;
      }

      setBrand(data);

      if (isAdminMode) {
        Alert.alert(
          'Brand saved',
          editingBrandId
            ? 'Brand details have been updated.'
            : 'Brand has been created and auto-approved.',
        );
        navigation.navigate('AdminBrands');
      } else {
        const isUpdate = !!brand?.id;
        Alert.alert(
          isUpdate ? 'Brand updated' : 'Application submitted',
          isUpdate
            ? 'Your brand profile has been updated successfully.'
            : 'Your brand application has been submitted.',
        );
        navigation.navigate('Main', { screen: 'HomeTab' });
      }
    } catch (e) {
      console.error('Brand onboarding error:', e);
      Alert.alert('Error', 'Something went wrong while submitting your brand application.');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = brand?.status || 'pending';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            isAdminMode
              ? navigation.navigate('AdminBrands')
              : navigation.navigate('Main', { screen: 'HomeTab' })
          }
        >
          <Text style={styles.backButtonText}>{isAdminMode ? 'Back to Admin' : 'Back to Home'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Brand Onboarding</Text>
        <Text style={styles.subtitle}>
          Tell us about your brand so customers can discover and shop your products.
        </Text>

        {brand && (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Current status</Text>
            <Text
              style={[
                styles.statusValue,
                statusLabel === 'approved' && styles.statusApproved,
                statusLabel === 'rejected' && styles.statusRejected,
              ]}
            >
              {statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}
            </Text>
          </View>
        )}

        <Text style={styles.fieldLabel}>Brand name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Nike"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>Brand slug (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. nike-official"
          value={slug}
          onChangeText={setSlug}
        />

        <Text style={styles.fieldLabel}>Brand logo</Text>
        <TouchableOpacity
          style={styles.logoButton}
          onPress={handlePickLogo}
          disabled={uploadingLogo}
        >
          <Text style={styles.logoButtonText}>
            {uploadingLogo ? 'Uploading logo...' : logoUrl ? 'Change Logo' : 'Choose from Gallery'}
          </Text>
        </TouchableOpacity>
        {logoUrl ? (
          <Text style={styles.logoHint} numberOfLines={1}>
            Current logo: {logoUrl}
          </Text>
        ) : null}

        {isAdminMode && !editingBrandId && (
          <>
            <Text style={styles.fieldLabel}>Brand login email</Text>
            <TextInput
              style={styles.input}
              placeholder="brand-login@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={brandLoginEmail}
              onChangeText={setBrandLoginEmail}
            />

            <Text style={styles.fieldLabel}>Brand login password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password for brand login"
              secureTextEntry
              value={brandLoginPassword}
              onChangeText={setBrandLoginPassword}
            />
          </>
        )}

        <Text style={styles.fieldLabel}>Contact email</Text>
        <TextInput
          style={styles.input}
          placeholder="brand@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={contactEmail}
          onChangeText={setContactEmail}
        />

        <Text style={styles.fieldLabel}>Contact phone (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="+1 555 123 4567"
          value={contactPhone}
          onChangeText={setContactPhone}
        />

        <Text style={styles.fieldLabel}>Brand description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell customers what makes your brand special..."
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleSubmit}
          disabled={loading || initialLoading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Submitting...' : brand ? 'Update Application' : 'Apply as a Brand'}
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default BrandOnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  backButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    backgroundColor: '#2563EB',
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EFF6FF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  statusBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  statusApproved: {
    color: '#16a34a',
  },
  statusRejected: {
    color: '#dc2626',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 100,
    marginTop: 4,
  },
  logoButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  logoButtonText: {
    color: '#1D4ED8',
    fontWeight: '600',
    fontSize: 14,
  },
  logoHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#6b7280',
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
