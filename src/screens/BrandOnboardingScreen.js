import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

const BrandOnboardingScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const authEmail = useStore((state) => state.authEmail);
  const setBrandLogoUrl = useStore((state) => state.setBrandLogoUrl);

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

  useEffect(() => {
    const loadBrand = async () => {
      if (!authUserId) {
        setInitialLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .eq('user_id', authUserId)
          .maybeSingle();

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
  }, [authUserId, authEmail]);

  const handlePickLogo = async () => {
    if (!authUserId) {
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

      const fileExt = asset.uri.split('.').pop() || 'jpg';
      const fileName = `brand-${authUserId}-${Date.now()}.${fileExt}`;

      // Upload the actual binary data instead of a JSON object.
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { data, error } = await supabase.storage
        .from('brand-logos')
        .upload(fileName, arrayBuffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: asset.type || 'image/jpeg',
        });

      if (error) {
        Alert.alert('Upload failed', error.message || 'Could not upload logo.');
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
    if (!authUserId) {
      Alert.alert('Not signed in', 'You need to be logged in to apply as a brand.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Missing information', 'Please enter your brand name.');
      return;
    }

    if (loading) return;
    setLoading(true);

    const payload = {
      user_id: authUserId,
      name: name.trim(),
      slug: slug.trim() || null,
      logo_url: logoUrl.trim() || null,
      description: description.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
    };

    try {
      const { data, error } = await supabase
        .from('brands')
        .upsert([payload], { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) {
        Alert.alert('Error', error.message || 'Could not submit brand application.');
        return;
      }

      setBrand(data);
      Alert.alert(
        'Application submitted',
        'Your brand application has been submitted. An admin can review and approve it.',
      );
      navigation.navigate('Main', { screen: 'HomeTab' });
    } catch (e) {
      console.error('Brand onboarding error:', e);
      Alert.alert('Error', 'Something went wrong while submitting your brand application.');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = brand?.status || 'pending';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Main', { screen: 'HomeTab' })}
        >
          <Text style={styles.backButtonText}>Back to Home</Text>
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
