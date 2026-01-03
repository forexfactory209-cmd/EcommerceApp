import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Image, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

const SignupScreen = ({ navigation }) => {
  const setAuthUser = useStore((state) => state.setAuthUser);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: account, 2: personal, 3: address

  const [createdAuthUser, setCreatedAuthUser] = useState(null);

  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('Somaliland');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressDescr, setAddressDescr] = useState('');
  const [avatarPreviewUri, setAvatarPreviewUri] = useState(null); // local preview only; upload happens in EditProfile

  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);

  const CITY_OPTIONS = ['Mogadishu', 'Hargeisa', 'Kismayo', 'Baidoa'];
  const DISTRICT_OPTIONS_BY_CITY = {
    Mogadishu: ['Hodan', 'Hamar Weyne', 'Wadajir', 'Waberi'],
    Hargeisa: ['Maroodi Jeex', 'Ibrahim Koodbuur'],
    Kismayo: ['Farjano', 'Alanley'],
    Baidoa: ['Isha', 'Howl Wadaag'],
  };

  const validateStep = () => {
    if (step === 1) {
      if (!username.trim()) {
        Alert.alert('Missing information', 'Please enter a username.');
        return false;
      }
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail) {
        Alert.alert('Missing information', 'Please enter your email address.');
        return false;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        Alert.alert('Invalid email', 'Please enter a valid email address.');
        return false;
      }

      if (!trimmedPassword || trimmedPassword.length < 8) {
        Alert.alert('Weak password', 'Password must contain at least 8 characters.');
        return false;
      }

      // Require at least one letter and one number for stronger passwords
      const hasLetter = /[A-Za-z]/.test(trimmedPassword);
      const hasNumber = /[0-9]/.test(trimmedPassword);
      if (!hasLetter || !hasNumber) {
        Alert.alert(
          'Weak password',
          'Password must include at least one letter and one number.',
        );
        return false;
      }
    }

    if (step === 2) {
      if (!name.trim()) {
        Alert.alert('Missing information', 'Please enter your full name.');
        return false;
      }
    }

    if (step === 3) {
      if (!country.trim() || !city.trim()) {
        Alert.alert('Missing information', 'Please enter at least your country and city.');
        return false;
      }

      const trimmedPhone = phone.trim();
      if (!trimmedPhone) {
        Alert.alert('Missing information', 'Please enter your phone number.');
        return false;
      }

      // Basic phone sanity check: at least 7 chars and must contain a digit
      const hasDigit = /[0-9]/.test(trimmedPhone);
      if (trimmedPhone.length < 7 || !hasDigit) {
        Alert.alert('Invalid phone', 'Please enter a valid phone number.');
        return false;
      }
    }

    return true;
  };

  const handleNextStep = async () => {
    if (!validateStep()) return;

    if (step === 1) {
      const trimmedUsername = username.trim();
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      try {
        if (trimmedUsername) {
          const { data: existingProfile, error: usernameCheckError } = await supabase
            .from('profiles')
            .select('user_id, username')
            .eq('username', trimmedUsername)
            .maybeSingle();

          if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
            console.log('[SignupWizard] username check error', usernameCheckError);
          }

          if (existingProfile) {
            Alert.alert('Username taken', 'This username is already in use. Please choose another one.');
            return;
          }
        }

        if (!createdAuthUser || createdAuthUser.email !== trimmedEmail) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword,
          });

          if (signUpError) {
            const msg = signUpError.message || '';

            if (
              signUpError.code === 'user_already_exists' ||
              msg.toLowerCase().includes('already registered') ||
              msg.toLowerCase().includes('already exists')
            ) {
              Alert.alert(
                'Email already in use',
                'An account with this email already exists. Please sign in instead.',
              );
            } else {
              Alert.alert('Sign up failed', msg || 'Unable to create your account.');
            }

            return;
          }

          const user = signUpData.user;
          if (!user) {
            Alert.alert('Sign up failed', 'No user returned from Supabase.');
            return;
          }

          setCreatedAuthUser(user);
        }
      } catch (err) {
        console.error('Signup step 1 error:', err);
        Alert.alert('Error', 'Something went wrong while creating your account.');
        return;
      }
    }

    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handlePickAvatar = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photos to set a profile picture.');
        return;
      }

      // Build options in a way that works across different expo-image-picker versions
      const pickerOptions = {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      };

      // Prefer the newer MediaType API if available
      if (ImagePicker.MediaType && ImagePicker.MediaType.Images) {
        pickerOptions.mediaTypes = ImagePicker.MediaType.Images;
      } else if (
        ImagePicker.MediaTypeOptions &&
        ImagePicker.MediaTypeOptions.Images
      ) {
        // Fallback to deprecated MediaTypeOptions for older SDKs
        pickerOptions.mediaTypes = ImagePicker.MediaTypeOptions.Images;
      }

      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled) {
        return;
      }

      const asset = result.assets && result.assets[0];
      if (!asset?.uri) {
        Alert.alert('Error', 'Unable to read selected image. Please try again.');
        return;
      }

      setAvatarPreviewUri(asset.uri);
    } catch (e) {
      console.error('Signup image picker error:', e);
      Alert.alert('Error', 'Could not open your photo library. Please try again.');
    }
  };

  const handleCompleteSignup = async () => {
    if (!validateStep()) return;
    if (loading) return;

    setLoading(true);

    try {
      const user = createdAuthUser;
      if (!user) {
        Alert.alert('Sign up failed', 'We could not confirm your account. Please go back to step 1 and try again.');
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            name: name.trim(),
            username: username.trim() || null,
            gender: gender.trim() || null,
            dob: dob || null,
            country: country.trim() || null,
            city: city.trim() || null,
            district: district.trim() || null,
            address: address.trim() || null,
            address_descr: addressDescr.trim() || null,
          },
          { onConflict: 'user_id' },
        );

      if (profileError) {
        console.log('[SignupWizard] profile upsert error', profileError);
        Alert.alert('Warning', 'Account created, but failed to save profile details. You can edit them later.');
      } else {
        // Also create a primary saved address record if the user entered address info.
        const hasAnyAddress =
          country.trim() || city.trim() || district.trim() || address.trim() || addressDescr.trim();

        if (hasAnyAddress) {
          try {
            const payload = {
              user_id: user.id,
              name: name.trim() || null,
              country: country.trim() || null,
              city: city.trim() || null,
              phone: phone.trim() || null,
              secondary_phone: null,
              address_line: address.trim() || null,
              is_primary: true,
            };

            await supabase.from('customer_addresses').insert([payload]);
          } catch (addrErr) {
            console.log('[SignupWizard] customer_addresses insert error', addrErr);
            // Non-fatal: profile was created; user can add address later from Saved Addresses.
          }
        }
      }

      Alert.alert(
        'Account created',
        'Your account has been created. Please sign in with your new credentials.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.replace('Welcome');
            },
          },
        ],
      );
    } catch (err) {
      console.error('Signup wizard error:', err);
      Alert.alert('Error', 'Something went wrong completing your sign up.');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressHeader = () => {
    const steps = [
      { id: 1, label: 'Account' },
      { id: 2, label: 'Personal' },
      { id: 3, label: 'Address' },
    ];

    return (
      <View style={styles.progressHeader}>
        <View style={styles.progressTopRow}>
          <TouchableOpacity onPress={handlePrevStep} style={styles.backButton}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.progressTitle}>Create Account</Text>
          <View style={styles.progressHelpIcon}>
            {/* <Text style={styles.progressHelpText}>?</Text> */}
          </View>
        </View>

        <View style={styles.stepperRow}>
          {steps.map((s, index) => (
            <View key={s.id} style={styles.stepperItem}>
              <View style={styles.stepCircleWrapper}>
                <View
                  style={[
                    styles.stepCircle,
                    step === s.id && styles.stepCircleActive,
                    step > s.id && styles.stepCircleCompleted,
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      (step === s.id || step > s.id) && styles.stepCircleTextActive,
                    ]}
                  >
                    {s.id}
                  </Text>
                </View>
              </View>
              <Text style={styles.stepLabel}>{s.label}</Text>
              {index < steps.length - 1 && <View style={styles.stepConnector} />}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'bottom', 'left']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({
          ios: 60,
          android: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 0,
          default: 0,
        })}
      >
        <View style={styles.background} />
        <View style={styles.centerWrapperFull}>
          <View style={styles.cardFullHeight}>
            {renderProgressHeader()}
            <ScrollView
              contentContainerStyle={styles.wizardScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
            {step === 1 && (
              <View style={styles.wizardSection}>
                <Text style={styles.sectionTitle}>Let's get started</Text>
                <Text style={styles.sectionSubtitle}>
                  Create your login credentials to access the marketplace.
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Username</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>👤</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="johndoe123"
                      value={username}
                      onChangeText={setUsername}
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>✉️</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="john@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      secureTextEntry
                      value={password}
                      onChangeText={setPassword}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={styles.passwordHints}>
                    <Text
                      style={[
                        styles.helperText,
                        password.length >= 8 && styles.passwordHintValid,
                      ]}
                    >
                      • At least 8 characters
                    </Text>
                    <Text
                      style={[
                        styles.helperText,
                        /[A-Za-z]/.test(password) && styles.passwordHintValid,
                      ]}
                    >
                      • Contains a letter (A-Z)
                    </Text>
                    <Text
                      style={[
                        styles.helperText,
                        /[0-9]/.test(password) && styles.passwordHintValid,
                      ]}
                    >
                      • Contains a number (0-9)
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.wizardSection}>
                <Text style={styles.sectionTitle}>Personal Details</Text>
                <Text style={styles.sectionSubtitle}>
                  Tell us a bit more about yourself to personalize your experience.
                </Text>

                <View style={styles.avatarPlaceholderSection}>
                 
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🧑</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ex. John Doe"
                      value={name}
                      onChangeText={setName}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.genderRow}>
                    {['Male', 'Female', 'Other'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.genderOption,
                          gender === g && styles.genderOptionActive,
                        ]}
                        onPress={() => setGender(g)}
                      >
                        <Text
                          style={
                            gender === g ? styles.genderTextActive : styles.genderText
                          }
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Date of Birth</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>📅</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="YYYY-MM-DD"
                      value={dob}
                      onChangeText={setDob}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>
            )}

            {step === 3 && (
              <View style={styles.wizardSection}>
                <Text style={styles.sectionTitle}>Address Details</Text>
                <Text style={styles.sectionSubtitle}>
                  Where should we deliver your orders?
                </Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Country</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🌍</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Country"
                      value={country}
                      onChangeText={setCountry}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>City</Text>
                  <TouchableOpacity
                    style={styles.inputWrapper}
                    activeOpacity={0.9}
                    onPress={() => {
                      setCityDropdownOpen(!cityDropdownOpen);
                      setDistrictDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.inputIcon}>🏙️</Text>
                    <Text style={[styles.dropdownValue, !city && styles.dropdownPlaceholder]}>
                      {city || 'Select City'}
                    </Text>
                    <Text style={styles.dropdownChevron}>▾</Text>
                  </TouchableOpacity>
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
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>📞</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. +252 61 234 5678"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>District</Text>
                  <TouchableOpacity
                    style={styles.inputWrapper}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (!city) return;
                      setDistrictDropdownOpen(!districtDropdownOpen);
                      setCityDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.inputIcon}>📍</Text>
                    <Text style={[styles.dropdownValue, !district && styles.dropdownPlaceholder]}>
                      {district || (city ? 'Select District' : 'Select City first')}
                    </Text>
                    <Text style={styles.dropdownChevron}>▾</Text>
                  </TouchableOpacity>
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
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Detailed Address</Text>
                  <View style={styles.inputWrapperMultiline}>
                    <TextInput
                      style={styles.inputMultiline}
                      placeholder="Apartment no, floor, famous landmark..."
                      value={address}
                      onChangeText={setAddress}
                      placeholderTextColor="#9CA3AF"
                      multiline
                    />
                  </View>
                  <Text style={styles.helperTextOptional}>Optional extra details</Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Address Description (Optional)</Text>
                  <View style={styles.inputWrapperMultiline}>
                    <TextInput
                      style={styles.inputMultiline}
                      placeholder="Any extra instructions for delivery"
                      value={addressDescr}
                      onChangeText={setAddressDescr}
                      placeholderTextColor="#9CA3AF"
                      multiline
                    />
                  </View>
                </View>
              </View>
            )}
            </ScrollView>

            <View style={styles.wizardFooter}>
            {step < 3 ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleNextStep}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Please wait...' : 'Next Step  →'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCompleteSignup}
                disabled={loading}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Creating account...' : 'Complete Sign Up  ✓'}
                </Text>
              </TouchableOpacity>
            )}
            </View>

            <View style={styles.footerRowCentered}>
            <Text style={styles.footerText}>
              Already have an account?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => navigation.navigate('Welcome')}
              >
                Sign in
              </Text>
            </Text>
          </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E5EDFF',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  centerWrapperFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardFullHeight: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  progressHeader: {
    marginBottom: 8,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 16,
    color: '#111827',
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  progressHelpIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressHelpText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepCircleWrapper: {
    marginBottom: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    borderColor: '#11126F',
    backgroundColor: '#11126F',
  },
  stepCircleCompleted: {
    borderColor: '#4F46E5',
    backgroundColor: '#4F46E5',
  },
  stepCircleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepCircleTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  stepConnector: {
    position: 'absolute',
    top: 14,
    right: -20,
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  wizardScrollContent: {
    paddingBottom: 10,
  },
  wizardSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  avatarPlaceholderSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1F2937',
  },
  avatarUploadText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
  },
  inputWrapperMultiline: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#9CA3AF',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: '#111827',
  },
  dropdownValue: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 9,

  },
  dropdownPlaceholder: {
    color: '#9CA3AF',

  },
  dropdownChevron: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  inputMultiline: {
    minHeight: 72,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
  },
  genderRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  genderOption: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  genderOptionActive: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
  },
  genderText: {
    fontSize: 12,
    color: '#4B5563',
  },
  genderTextActive: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  helperText: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
  },
  helperTextOptional: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  passwordHints: {
    marginTop: 6,
  },
  passwordHintValid: {
    color: '#10B981',
    fontWeight: '600',
  },
  wizardFooter: {
    marginTop: 16,
  },
  primaryButton: {
    marginTop: -8,
    backgroundColor: '#11126F',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRowCentered: {
    marginTop: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
  },
  footerLink: {
    color: '#11126F',
    fontWeight: '600',
  },
});

export default SignupScreen;
