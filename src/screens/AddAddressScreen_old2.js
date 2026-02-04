import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert, KeyboardAvoidingView, Platform, Animated, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';
import {
  User,
  MapPin,
  Phone,
  Home,
  ChevronLeft,
  ChevronDown,
  Check,
  Globe,
  Building,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BRAND_COLOR = '#090966';

const InputField = ({ label, icon: Icon, value, onChangeText, placeholder, type, editable = true, onPress, error }) => {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Container
        style={[styles.inputContainer, error && styles.inputError]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        {Icon && <Icon size={20} color={BRAND_COLOR} style={styles.inputIcon} />}
        
        {editable ? (
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            secureTextEntry={false}
            keyboardType={type}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="none"
            editable={editable}
          />
        ) : (
          <Text style={[styles.input, { textAlignVertical: 'center' }]}>
            {value || placeholder}
          </Text>
        )}

        {onPress && <ChevronDown size={20} color="#6B7280" />}
      </Container>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const AddAddressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const editingAddress = route?.params?.address || null;
  const authUserId = useStore((state) => state.authUserId);
  const userProfile = useStore((state) => state.userProfile);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('Somaliland');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [addressDescr, setAddressDescr] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const CITY_OPTIONS = ['Mogadishu', 'Hargeisa', 'Kismayo', 'Baidoa'];
  const DISTRICT_OPTIONS_BY_CITY = {
    Mogadishu: ['Hodan', 'Hamar Weyne', 'Wadajir', 'Waberi'],
    Hargeisa: ['Maroodi Jeex', 'Ibrahim Koodbuur'],
    Kismayo: ['Farjano', 'Alanley'],
    Baidoa: ['Isha', 'Howl Wadaag'],
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    if (editingAddress) {
      setName(editingAddress.name || '');
      setCountry(editingAddress.country || 'Somaliland');
      setCity(editingAddress.city || '');
      setDistrict(editingAddress.district || '');
      setPhone(editingAddress.phone || '');
      setSecondaryPhone(editingAddress.secondary_phone || '');
      setAddressLine(editingAddress.address_line || '');
      setAddressDescr(editingAddress.address_descr || '');
      setIsPrimary(!!editingAddress.is_primary);
      return;
    }

    if (userProfile) {
      setName((prev) => prev || userProfile.name || '');
      setCountry((prev) => prev || userProfile.country || 'Somaliland');
      setCity((prev) => prev || userProfile.city || '');
      setDistrict((prev) => prev || userProfile.district || '');
      setAddressLine((prev) => prev || userProfile.address || '');
      setAddressDescr((prev) => prev || userProfile.address_descr || '');
    }
  }, [editingAddress, userProfile]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedCountry = country.trim();
    const trimmedCity = city.trim();
    const trimmedDistrict = district.trim();
    const trimmedPhone = phone.trim();
    const trimmedSecondaryPhone = secondaryPhone.trim();
    const trimmedAddress = addressLine.trim();
    const trimmedAddressDescr = addressDescr.trim();

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
            district: trimmedDistrict || null,
            phone: trimmedPhone || null,
            secondary_phone: trimmedSecondaryPhone || null,
            address_line: trimmedAddress,
            address_descr: trimmedAddressDescr || null,
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
            district: trimmedDistrict || null,
            phone: trimmedPhone || null,
            secondary_phone: trimmedSecondaryPhone || null,
            address_line: trimmedAddress,
            address_descr: trimmedAddressDescr || null,
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
      <StatusBar barStyle="light-content" backgroundColor={BRAND_COLOR} />
      
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editingAddress ? 'Edit Address' : 'Add New Address'}</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({ ios: 60, android: 0, default: 0 })}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>
            <InputField
              label="Full Name"
              icon={User}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
            />

            <InputField
              label="Country"
              icon={Globe}
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              editable={false}
            />

            <InputField
              label="City"
              icon={Building}
              value={city}
              onChangeText={setCity}
              placeholder="Select your city"
              onPress={() => {
                setCityDropdownOpen((prev) => !prev);
                setDistrictDropdownOpen(false);
              }}
            />
            {cityDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {CITY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCity(option);
                      setDistrict('');
                      setCityDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{option}</Text>
                    {city === option && <Check size={16} color={BRAND_COLOR} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <InputField
              label="District"
              icon={Home}
              value={district}
              onChangeText={setDistrict}
              placeholder={city ? 'Select District' : 'Select City first'}
              onPress={() => {
                if (!city) return;
                setDistrictDropdownOpen((prev) => !prev);
                setCityDropdownOpen(false);
              }}
            />
            {districtDropdownOpen && city && (
              <View style={styles.dropdownMenu}>
                {(DISTRICT_OPTIONS_BY_CITY[city] || []).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setDistrict(option);
                      setDistrictDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{option}</Text>
                    {district === option && <Check size={16} color={BRAND_COLOR} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <InputField
              label="Phone Number"
              icon={Phone}
              value={phone}
              onChangeText={setPhone}
              placeholder="+252 6X XXX XXXX"
              type="phone-pad"
            />

            <InputField
              label="Second Phone (Optional)"
              icon={Phone}
              value={secondaryPhone}
              onChangeText={setSecondaryPhone}
              placeholder="+252 6X XXX XXXX"
              type="phone-pad"
            />

            <InputField
              label="Street Address"
              icon={MapPin}
              value={addressLine}
              onChangeText={setAddressLine}
              placeholder="Street, building, apartment, etc."
              multiline
            />

            <InputField
              label="Address Description"
              icon={MapPin}
              value={addressDescr}
              onChangeText={setAddressDescr}
              placeholder="Near landmark, floor, special instructions"
              multiline
            />

            <View style={styles.switchContainer}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Set as Primary Address</Text>
                <Text style={styles.switchDescription}>This will be your default delivery address</Text>
              </View>
              <Switch
                value={isPrimary}
                onValueChange={setIsPrimary}
                thumbColor={isPrimary ? '#ffffff' : '#F9FAFB'}
                trackColor={{ false: '#E5E7EB', true: BRAND_COLOR }}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AddAddressScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: BRAND_COLOR,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#111827',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  switchInfo: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: BRAND_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
