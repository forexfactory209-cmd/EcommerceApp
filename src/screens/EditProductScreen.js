import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const EditProductScreen = ({ route, navigation }) => {
  const { product } = route.params;
  const updateProduct = useStore((state) => state.updateProduct);
  const authUserId = useStore((state) => state.authUserId);
  const authRole = useStore((state) => state.authRole);

  const [form, setForm] = useState({
    id: product.id,
    name: product.name || '',
    price: String(product.price ?? ''),
    brand: product.brand || '',
    image: product.image || '',
    images: Array.isArray(product.images)
      ? product.images
      : product.image
      ? [product.image]
      : [],
    code: product.code || '',
    description: product.description || '',
    colorsInput: Array.isArray(product.colors)
      ? product.colors.join(', ')
      : '',
    sizesInput: Array.isArray(product.sizes)
      ? product.sizes.join(', ')
      : '',
    deliveryInput: Array.isArray(product.deliveryOptions || product.delivery_options)
      ? (product.deliveryOptions || product.delivery_options)
          .map((opt) => {
            const label = opt.label || '';
            const eta = opt.eta || '';
            const price =
              opt.price != null && opt.price !== '' ? String(opt.price) : '';
            return [label, eta, price].join(';');
          })
          .join('\n')
      : '',
    category: product.category || 'shoes',
    audience: product.audience || 'all',
    quantity: product.quantity != null ? String(product.quantity) : '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your gallery to select product images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setForm((prev) => ({
          ...prev,
          image: prev.image || uri,
          images: prev.images && Array.isArray(prev.images)
            ? [...prev.images, uri]
            : [uri],
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open image library.');
      console.error('Image picker error:', error);
    }
  };

  const handleGenerateDescription = async () => {
    if (!form.name) {
      Alert.alert('Missing name', 'Please enter a product name first.');
      return;
    }

    if (generatingDescription) return;
    setGeneratingDescription(true);

    try {
      const priceValue = parseFloat(form.price) || 0;

      const response = await fetch(
        'https://aeivheqhwlifhancoswz.supabase.co/functions/v1/generate-product-description',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            audience: form.audience,
            price: priceValue,
            brand: form.brand,
            currentDescription: form.description,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate description.');
      }

      const data = await response.json();
      if (data && typeof data.description === 'string' && data.description.trim()) {
        setForm((prev) => ({
          ...prev,
          description: data.description.trim(),
        }));
      } else {
        Alert.alert('No description', 'AI did not return a description. Please try again.');
      }
    } catch (err) {
      console.warn('AI description error (edit product)', err);
      Alert.alert('Error', err.message || 'Could not generate description.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;

    if (!form.image) {
      Alert.alert('Image required', 'Please choose a product image from your gallery.');
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      const priceValue = parseFloat(form.price) || 0;
      const quantityValue = Math.max(0, parseInt(form.quantity, 10) || 0);

      const colors = (form.colorsInput || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const sizes = (form.sizesInput || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

      const deliveryOptions = (form.deliveryInput || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const [labelRaw, etaRaw, priceRaw] = line.split(';');
          const label = (labelRaw || '').trim();
          const eta = (etaRaw || '').trim();
          const price = priceRaw != null && priceRaw.trim() !== ''
            ? parseFloat(priceRaw.trim()) || 0
            : null;
          return {
            id: `opt_${index}_${label.toLowerCase().replace(/\s+/g, '_')}`,
            label,
            eta: eta || null,
            price,
          };
        })
        .filter((opt) => opt.label);

      // Normalize images list from form
      const images = form.images && form.images.length > 0
        ? form.images
        : form.image
        ? [form.image]
        : [];

      // Upload any local image URIs to Supabase so edited products work on all devices
      const uploadedImageUrls = [];
      for (const uri of images) {
        if (!uri) continue;

        // Keep existing http(s) URLs as-is
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          uploadedImageUrls.push(uri);
          continue;
        }

        try {
          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();

          const ext = uri.split('.').pop() || 'jpg';
          const fileName = `product-${authUserId || 'anon'}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.${ext}`;

          const { data: storageData, error: storageError } = await supabase.storage
            .from('product-images')
            .upload(fileName, arrayBuffer, {
              cacheControl: '3600',
              upsert: true,
              contentType: 'image/jpeg',
            });

          if (storageError) {
            console.warn('Edit product image upload failed', storageError.message || storageError);
            uploadedImageUrls.push(uri);
            continue;
          }

          const { data: publicData } = supabase.storage
            .from('product-images')
            .getPublicUrl(storageData.path);

          if (publicData?.publicUrl) {
            uploadedImageUrls.push(publicData.publicUrl);
          } else {
            uploadedImageUrls.push(uri);
          }
        } catch (e) {
          console.warn('Edit product image upload error', e.message || e);
          uploadedImageUrls.push(uri);
        }
      }

      const primaryImage = uploadedImageUrls[0] || form.image || '';

      const { error } = await supabase
        .from('products')
        .update({
          name: form.name,
          price: priceValue,
          brand: form.brand,
          image: primaryImage,
          images: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
          colors: colors.length > 0 ? colors : null,
          sizes: sizes.length > 0 ? sizes : null,
          delivery_options: deliveryOptions.length > 0 ? deliveryOptions : null,
          code: form.code,
          description: form.description,
          category: form.category,
          audience: form.audience,
          quantity: quantityValue,
        })
        .eq('id', form.id);

      if (error) {
        Alert.alert('Error', error.message || 'Could not update product in Supabase.');
        return;
      }

      updateProduct({
        id: form.id,
        name: form.name,
        price: priceValue,
        brand: form.brand,
        image: primaryImage,
        images: uploadedImageUrls,
        colors,
        sizes,
        deliveryOptions,
        code: form.code,
        description: form.description,
        category: form.category,
        audience: form.audience,
        brand_user_id: product.brand_user_id || authUserId || null,
        quantity: quantityValue,
      });

      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', 'Something went wrong while updating the product.');
      console.error('EditProduct error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X color="black" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Product</Text>
      </View>

      <ScrollView style={styles.form}>
        <Text style={styles.label}>Product Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Product name"
          value={form.name}
          onChangeText={(t) => handleChange('name', t)}
        />

        <Text style={styles.label}>Price ($)
        </Text>
        <TextInput
          style={styles.input}
          placeholder="99.99"
          keyboardType="numeric"
          value={form.price}
          onChangeText={(t) => handleChange('price', t)}
        />

        <Text style={styles.label}>Brand</Text>
        {authRole === 'admin' ? (
          <TextInput
            style={styles.input}
            placeholder="Brand name"
            value={form.brand}
            onChangeText={(t) => handleChange('brand', t)}
          />
        ) : (
          <View style={styles.input}>
            <Text style={{ color: '#4b5563', fontWeight: '600' }}>{form.brand}</Text>
          </View>
        )}

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'clothes', label: 'Clothes' },
            { id: 'shoes', label: 'Shoes' },
            { id: 'coats', label: 'Coats' },
            { id: 'phones', label: 'Phones' },
            { id: 'laptops', label: 'Laptops' },
            { id: 'bags', label: 'Bags' },
          ].map((cat) => {
            const active = form.category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => handleChange('category', cat.id)}
              >
                <Text
                  style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Audience</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'men', label: 'Men' },
            { id: 'women', label: 'Women' },
            { id: 'kids', label: 'Kids' },
          ].map((aud) => {
            const active = form.audience === aud.id;
            return (
              <TouchableOpacity
                key={aud.id}
                style={[styles.audienceChip, active && styles.audienceChipActive]}
                onPress={() => handleChange('audience', aud.id)}
              >
                <Text
                  style={[styles.audienceChipText, active && styles.audienceChipTextActive]}
                >
                  {aud.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Product Code</Text>
        <TextInput
          style={styles.input}
          placeholder="Code"
          value={form.code}
          onChangeText={(t) => handleChange('code', t)}
        />

        <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
          <Text style={styles.imagePickerText}>Add Image</Text>
        </TouchableOpacity>

        {form.image ? (
          <View style={styles.imagePreviewWrapper}>
            <Image source={{ uri: form.image }} style={styles.imagePreview} />
          </View>
        ) : null}

        {form.images && form.images.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.extraImagesRow}
          >
            {form.images.map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                style={styles.extraImage}
              />
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.label}>Colors (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="Red, Black, White"
          value={form.colorsInput}
          onChangeText={(t) => handleChange('colorsInput', t)}
        />

        <Text style={styles.label}>Sizes (comma separated)</Text>
        <TextInput
          style={styles.input}
          placeholder="40, 41, 42"
          value={form.sizesInput}
          onChangeText={(t) => handleChange('sizesInput', t)}
        />

        <Text style={styles.label}>Delivery options (one per line: label;eta;price)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder={"Standard Delivery;3–5 days;0\nExpress Delivery;1–2 days;5.99"}
          textAlignVertical="top"
          value={form.deliveryInput}
          onChangeText={(t) => handleChange('deliveryInput', t)}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Product details..."
          textAlignVertical="top"
          value={form.description}
          onChangeText={(t) => handleChange('description', t)}
        />

        <TouchableOpacity
          style={styles.aiButton}
          onPress={handleGenerateDescription}
          disabled={generatingDescription}
        >
          <Text style={styles.aiButtonText}>
            {generatingDescription ? 'Generating description…' : 'Generate Description with AI'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSave} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EditProductScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    marginLeft: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  form: {
    flex: 1,
    paddingHorizontal: 16,
  },
  label: {
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  textArea: {
    height: 120,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  categoryChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  audienceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginHorizontal: 4,
    marginBottom: 8,
  },
  audienceChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  audienceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  audienceChipTextActive: {
    color: '#ffffff',
  },
  imagePickerButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePickerText: {
    fontWeight: '600',
    color: '#111827',
  },
  imagePreviewWrapper: {
    alignItems: 'center',
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  aiButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 24,
  },
  aiButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
