import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CheckCircle } from 'lucide-react-native';
import { useStore } from '../store/store';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import ProductQRCodeGenerator from '../components/ProductQRCodeGenerator';

const AddProductScreen = ({ navigation }) => {
  const addProduct = useStore((state) => state.addProduct);
  const authUserId = useStore((state) => state.authUserId);
  const generateProductCode = () => `PRD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const [form, setForm] = useState({
    name: '',
    price: '',
    brand: '',
    image: '',
    images: [],
    code: `PRD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    description: '',
    colorsInput: '',
    sizesInput: '',
    // Legacy freeform delivery textarea (still parsed for backwards compatibility)
    deliveryInput: '',
    // New structured delivery inputs: multiple rows (type + time only)
    deliveryRows: [
      { id: 'row_0', label: '', eta: '' },
    ],
    category: 'shoes',
    audience: 'all',
    quantity: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [createdProduct, setCreatedProduct] = useState(null);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRemoveImage = (uriToRemove) => {
    setForm((prev) => {
      const nextImages = (prev.images || []).filter((uri) => uri !== uriToRemove);
      // If the primary image was removed, pick a new primary from remaining images
      const nextPrimary = prev.image === uriToRemove ? (nextImages[0] || '') : prev.image;
      return {
        ...prev,
        image: nextPrimary,
        images: nextImages,
      };
    });
  };

  const handleDeliveryRowChange = (rowId, field, value) => {
    setForm((prev) => ({
      ...prev,
      deliveryRows: prev.deliveryRows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    }));
  };

  const handleAddDeliveryRow = () => {
    setForm((prev) => ({
      ...prev,
      deliveryRows: [
        ...prev.deliveryRows,
        { id: `row_${Date.now()}`, label: '', eta: '' },
      ],
    }));
  };

  const handleRemoveDeliveryRow = (rowId) => {
    setForm((prev) => ({
      ...prev,
      deliveryRows: prev.deliveryRows.filter((row) => row.id !== rowId),
    }));
  };

  // Load verified brand name for this logged-in brand user (run once per auth user)
  useEffect(() => {
    const loadBrandName = async () => {
      if (!authUserId || brandLoaded || form.brand) return;
      setBrandLoading(true);
      try {
        const { data, error } = await supabase
          .from('brands')
          .select('name, status')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('AddProduct: error loading brand name', error.message || error);
          return;
        }

        if (data && data.status === 'approved' && data.name) {
          setForm((prev) => ({ ...prev, brand: data.name }));
        }
      } catch (e) {
        console.warn('AddProduct: error loading brand name', e.message || e);
      } finally {
        setBrandLoading(false);
        setBrandLoaded(true);
      }
    };

    loadBrandName();
  }, [authUserId, brandLoaded, form.brand]);

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
      console.warn('AI description error (add product)', err);
      Alert.alert('Error', err.message || 'Could not generate description.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.price) {
      return;
    }

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

      // New structured delivery options from multiple rows
      const structuredDeliveryOptions = (form.deliveryRows || [])
        .map((row, index) => {
          const label = (row.label || '').trim();
          const eta = (row.eta || '').trim();

          if (!label && !eta) return null;

          return {
            id: `opt_${index}_${label.toLowerCase().replace(/\s+/g, '_') || 'delivery'}`,
            label,
            eta: eta || null,
          };
        })
        .filter(Boolean);

      // Legacy textarea parsing is disabled for new products; only structured rows are used
      const deliveryOptions = structuredDeliveryOptions;

      // Normalize images list from form
      const images = form.images && form.images.length > 0
        ? form.images
        : form.image
          ? [form.image]
          : [];

      // Upload any local file URIs to Supabase storage so images work on all devices
      const uploadedImageUrls = [];
      for (const uri of images) {
        if (!uri) continue;

        // If it's already an http(s) URL, keep it as-is
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
            console.warn('Product image upload failed', storageError.message || storageError);
            // Fallback: keep local uri so at least creator device sees it
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
          console.warn('Product image upload error', e.message || e);
          uploadedImageUrls.push(uri);
        }
      }

      const primaryImage = uploadedImageUrls[0] || form.image || '';

      // Derive full and thumbnail URLs for the primary image using Supabase image CDN when possible
      let image_full_url = primaryImage || null;
      let image_thumb_url = null;

      if (image_full_url && image_full_url.includes('/storage/v1/object/')) {
        image_thumb_url = image_full_url
          .replace('/storage/v1/object/', '/storage/v1/render/image/')
          .concat('?width=400&quality=75');
      }

      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            name: form.name,
            price: priceValue,
            brand: form.brand,
            image: primaryImage,
            image_full_url,
            image_thumb_url,
            images: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
            colors: colors.length > 0 ? colors : null,
            sizes: sizes.length > 0 ? sizes : null,
            delivery_options: deliveryOptions.length > 0 ? deliveryOptions : null,
            code: form.code,
            description: form.description,
            category: form.category,
            audience: form.audience,
            brand_user_id: authUserId || null,
            quantity: quantityValue,
          },
        ])
        .select()
        .single();

      if (error) {
        Alert.alert('Error', error.message || 'Could not publish product to Supabase.');
      }

      const productToAdd = data || {
        id: Date.now(),
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
        brand_user_id: authUserId || null,
        quantity: quantityValue,
      };

      addProduct(productToAdd);

      // Create variants for each size
      if (sizes.length > 0 && data?.id) {
        const variantsToInsert = sizes.map(size => ({
          product_id: data.id,
          size: size,
          stock_quantity: Math.floor(quantityValue / sizes.length), // Distribute stock evenly
          sku: `${form.code}-${size}`
        }));

        const { error: variantsError } = await supabase
          .from('variants')
          .insert(variantsToInsert);

        if (variantsError) {
          console.warn('Failed to create variants:', variantsError);
          Alert.alert('Warning', 'Product created but variants could not be added. You can add them later.');
        }
      }

      // Set created product to show QR code (use data from database, not fallback)
      if (data) {
        setCreatedProduct(data);
      } else {
        // If no data from database, still show success but without QR
        Alert.alert('Success', 'Product created successfully!');
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong while publishing the product.');
      console.error('AddProduct error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    if (!form.code) return;
    await Clipboard.setStringAsync(form.code);
    Alert.alert('Copied', 'Product code copied to clipboard.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X color="black" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Product</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 60, android: 0, default: 0 })}
      >
        {createdProduct ? (
          <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 40, alignItems: 'center', justifyContent: 'center', minHeight: '80%' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <CheckCircle size={40} color="#10b981" />
            </View>

            <Text style={{ fontSize: 24, fontWeight: '700', color: '#064e3b', marginBottom: 12, textAlign: 'center' }}>
              Product Published!
            </Text>

            <Text style={{ fontSize: 16, color: '#047857', textAlign: 'center', paddingHorizontal: 20, marginBottom: 32 }}>
              Your product "{createdProduct.name}" is now live.
            </Text>

            <View style={{ width: '100%', marginBottom: 32 }}>
              <ProductQRCodeGenerator
                productId={createdProduct.id}
                productName={createdProduct.name}
              />
            </View>

            <TouchableOpacity
              style={[styles.doneButton, { width: '100%' }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneButtonText}>Done - Go to Products</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16, padding: 12 }}
              onPress={() => {
                setCreatedProduct(null);
                setForm({
                  ...form,
                  name: '',
                  image: '',
                  images: [],
                  description: '',
                  code: `PRD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                });
              }}
            >
              <Text style={{ color: '#2563EB', fontWeight: '600' }}>Add Another Product</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Product Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Nike Air Jordan"
              value={form.name}
              onChangeText={(t) => handleChange('name', t)}
            />

            <Text style={styles.label}>Price ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="99.99"
              keyboardType="numeric"
              value={form.price}
              onChangeText={(t) => handleChange('price', t)}
            />

            <Text style={styles.label}>Quantity in stock</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10"
              keyboardType="numeric"
              value={form.quantity}
              onChangeText={(t) => handleChange('quantity', t)}
            />

            <Text style={styles.label}>Brand</Text>
            <View style={[styles.input, { justifyContent: 'center' }]}>
              <Text style={{ color: form.brand ? '#111827' : '#9CA3AF' }}>
                {form.brand || (brandLoading ? 'Loading brand…' : 'Your approved brand name')}
              </Text>
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.dropdownWrapper}>
              <TouchableOpacity
                style={styles.dropdownSelected}
                activeOpacity={0.8}
                onPress={() => setCategoryOpen((prev) => !prev)}
              >
                <Text style={styles.dropdownSelectedText}>
                  {[
                    { id: 'clothes', label: 'Clothes' },
                    { id: 'shoes', label: 'Shoes' },
                    { id: 'coats', label: 'Coats' },
                    { id: 'phones', label: 'Phones' },
                    { id: 'laptops', label: 'Laptops' },
                    { id: 'bags', label: 'Bags' },
                  ].find((c) => c.id === form.category)?.label || 'Select category'}
                </Text>
              </TouchableOpacity>
              {categoryOpen && (
                <View style={styles.dropdownOptions}>
                  {[
                    { id: 'clothes', label: 'Clothes' },
                    { id: 'shoes', label: 'Shoes' },
                    { id: 'coats', label: 'Coats' },
                    { id: 'phones', label: 'Phones' },
                    { id: 'laptops', label: 'Laptops' },
                    { id: 'bags', label: 'Bags' },
                  ].map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.dropdownOption}
                      onPress={() => {
                        handleChange('category', cat.id);
                        setCategoryOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.label}>Product Code</Text>
            <View style={styles.codeRow}>
              <View style={styles.codeValueWrapper}>
                <Text style={styles.codeValue}>{form.code}</Text>
              </View>
              <TouchableOpacity
                style={styles.codeButton}
                onPress={() => setForm((prev) => ({ ...prev, code: generateProductCode() }))}
              >
                <Text style={styles.codeButtonText}>Regenerate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.codeCopyButton}
                onPress={handleCopyCode}
              >
                <Text style={styles.codeCopyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
              <Text style={styles.imagePickerText}>
                {form.images && form.images.length > 0
                  ? 'Add another image from gallery'
                  : 'Add image from gallery'}
              </Text>
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
                  <View key={`${uri}-${index}`} style={styles.extraImageWrapper}>
                    <Image
                      source={{ uri }}
                      style={styles.extraImage}
                    />
                    <TouchableOpacity
                      style={styles.extraImageRemoveBadge}
                      onPress={() => handleRemoveImage(uri)}
                    >
                      <Text style={styles.extraImageRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
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

            <Text style={styles.label}>Delivery options</Text>
            {form.deliveryRows.map((row, index) => (
              <View key={row.id} style={{ marginBottom: 8 }}>
                <TextInput
                  style={styles.input}
                  placeholder={index === 0 ? 'e.g. Standard Delivery' : 'e.g. Express Delivery'}
                  value={row.label}
                  onChangeText={(t) => handleDeliveryRowChange(row.id, 'label', t)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1–2 days"
                  value={row.eta}
                  onChangeText={(t) => handleDeliveryRowChange(row.id, 'eta', t)}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 4.99 (leave empty for free)"
                      keyboardType="numeric"
                      value={row.price}
                      onChangeText={(t) => handleDeliveryRowChange(row.id, 'price', t)}
                    />
                  </View>
                  {form.deliveryRows.length > 1 && (
                    <TouchableOpacity
                      style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fee2e2' }}
                      onPress={() => handleRemoveDeliveryRow(row.id)}
                    >
                      <Text style={{ color: '#b91c1c', fontWeight: '600', fontSize: 12 }}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                marginBottom: 8,
              }}
              onPress={handleAddDeliveryRow}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#2563EB' }}>+ Add delivery option</Text>
            </TouchableOpacity>

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

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
              <Text style={styles.submitText}>{submitting ? 'Publishing...' : 'Publish Product'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddProductScreen;

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
  dropdownWrapper: {
    marginBottom: 12,
  },
  dropdownSelected: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: '#111827',
  },
  dropdownOptions: {
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeValueWrapper: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
  },
  codeValue: {
    fontWeight: '700',
    color: '#111827',
  },
  codeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  codeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
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
  extraImagesRow: {
    marginBottom: 12,
  },
  extraImageWrapper: {
    marginRight: 8,
  },
  extraImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  extraImageRemoveBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraImageRemoveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
  codeCopyButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#090966',
    marginLeft: 8,
  },
  codeCopyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successBanner: {
    backgroundColor: '#d1fae5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  successBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 8,
  },
  successBannerText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
