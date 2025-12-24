import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

const AddAddressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const editingAddress = route?.params?.address || null;
  const authUserId = useStore((state) => state.authUserId);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingAddress) return;
    setName(editingAddress.name || '');
    setCountry(editingAddress.country || '');
    setCity(editingAddress.city || '');
    setPhone(editingAddress.phone || '');
    setSecondaryPhone(editingAddress.secondary_phone || '');
    setAddressLine(editingAddress.address_line || '');
    setIsPrimary(!!editingAddress.is_primary);
  }, [editingAddress]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedCountry = country.trim();
    const trimmedCity = city.trim();
    const trimmedPhone = phone.trim();
    const trimmedSecondaryPhone = secondaryPhone.trim();
    const trimmedAddress = addressLine.trim();

    if (!authUserId) {
      Alert.alert('Not signed in', 'You need to be logged in to save an address.');
      return;
    }

    if (!trimmedName || !trimmedCountry || !trimmedCity || !trimmedAddress) {
      Alert.alert('Missing details', 'Please fill in name, country, city and address.');
      return;
    }

    try {
      setSaving(true);

      // Enforce single primary address per customer
      if (isPrimary) {
        const { data: existingPrimaries, error: primaryError } = await supabase
          .from('customer_addresses')
          .select('id')
          .eq('user_id', authUserId)
          .eq('is_primary', true);

        if (primaryError) {
          console.warn('AddAddress: failed to check existing primary address', primaryError.message || primaryError);
          Alert.alert('Error', 'Could not verify primary address. Please try again.');
          setSaving(false);
          return;
        }

        const others = (existingPrimaries || []).filter((row) =>
          editingAddress ? row.id !== editingAddress.id : true,
        );

        if (others.length > 0) {
          Alert.alert(
            'Primary address',
            'You already have a primary address. You can only have one primary address at a time.',
          );
          setSaving(false);
          return;
        }
      }

      let error;
      if (editingAddress) {
        const { error: updError } = await supabase
          .from('customer_addresses')
          .update({
            name: trimmedName,
            country: trimmedCountry,
            city: trimmedCity,
            phone: trimmedPhone || null,
            secondary_phone: trimmedSecondaryPhone || null,
            address_line: trimmedAddress,
            is_primary: isPrimary,
          })
          .eq('id', editingAddress.id)
          .eq('user_id', authUserId);
        error = updError;
      } else {
        const { error: insError } = await supabase.from('customer_addresses').insert([
          {
            user_id: authUserId,
            name: trimmedName,
            country: trimmedCountry,
            city: trimmedCity,
            phone: trimmedPhone || null,
            secondary_phone: trimmedSecondaryPhone || null,
            address_line: trimmedAddress,
            is_primary: isPrimary,
          },
        ]);
        error = insError;
      }

      if (error) {
        console.warn('AddAddress: failed to save address', error.message || error);
        Alert.alert('Error', 'Could not save address. Please try again.');
        return;
      }

      // Navigate back to the saved addresses list immediately on success
      navigation.replace('Addresses');
    } catch (e) {
      console.warn('AddAddress: unexpected error', e.message || e);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              placeholder="Country"
              placeholderTextColor="#9CA3AF"
              value={country}
              onChangeText={setCountry}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="Select your city"
              placeholderTextColor="#9CA3AF"
              value={city}
              onChangeText={setCity}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+123 456 7890"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Second Phone (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="+123 456 7890"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={secondaryPhone}
              onChangeText={setSecondaryPhone}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, styles.addressInput]}
              placeholder="Street, building, apartment, etc."
              placeholderTextColor="#9CA3AF"
              value={addressLine}
              onChangeText={setAddressLine}
              multiline
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Save as primary address</Text>
            <Switch
              value={isPrimary}
              onValueChange={setIsPrimary}
              thumbColor={isPrimary ? '#ffffff' : '#F9FAFB'}
              trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddAddressScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    color: '#111827',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  addressInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  rowGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowItem: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 14,
    color: '#111827',
  },
  saveButton: {
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
