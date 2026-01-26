import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, StatusBar, Animated, Easing, Dimensions, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import {
  User, Mail, Lock, Check, ChevronLeft, ChevronRight, Calendar,
  MapPin, Phone, Home, FileText, ChevronDown, Eye, EyeOff, UserPlus
} from 'lucide-react-native';
import BeegsoButton from '../components/BeegsoButton';

const { width } = Dimensions.get('window');

// Move InputField OUTSIDE of the main component scope to prevent re-renders losing focus
const InputField = React.memo(({ label, icon: Icon, value, onChangeText, placeholder, secure, type, isPassword, showPassword, setShowPassword, focusedInput, setFocusedInput, editable = true, onPress, error }) => {
  const isFocused = focusedInput === label;
  // Icon color logic: Primary Brand Color (#090966) by default
  const iconColor = '#090966';

  const Container = onPress ? TouchableOpacity : View;

  return (
    <View style={styles.fieldGroup}>
      <Container
        style={[styles.inputContainer, isFocused && styles.inputFocused, error && styles.inputError]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        {Icon && <Icon size={20} color={iconColor} style={styles.inputIcon} />}

        {editable ? (
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            secureTextEntry={isPassword ? !showPassword : secure}
            keyboardType={type}
            value={value}
            onChangeText={onChangeText}
            autoCapitalize="none"
            onFocus={() => setFocusedInput && setFocusedInput(label)}
            onBlur={() => setFocusedInput && setFocusedInput(null)}
            editable={editable}
          />
        ) : (
          <Text style={[styles.input, { textAlignVertical: 'center' }]}>
            {value || placeholder}
          </Text>
        )}

        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            {showPassword ? (
              <EyeOff size={20} color={iconColor} />
            ) : (
              <Eye size={20} color={iconColor} />
            )}
          </TouchableOpacity>
        )}
      </Container>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
});


const SignupScreen = ({ navigation }) => {
  const setAuthUser = useStore((state) => state.setAuthUser);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);

  const [createdAuthUser, setCreatedAuthUser] = useState(null);

  // Additional fields
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('Somaliland');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressDescr, setAddressDescr] = useState('');

  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);

  const [focusedInput, setFocusedInput] = useState(null);
  const [phoneError, setPhoneError] = useState('');
  const [secondaryPhoneError, setSecondaryPhoneError] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;

  // Background Shape Animations
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const rectAnim = useRef(new Animated.Value(0)).current;

  // Logo Pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const BRAND_COLOR = '#090966';
  const ACCENT_GOLD = '#ffd60a';

  // Updated Constants
  const COUNTRY_OPTIONS = [
    { label: 'Somaliland 🏳️', value: 'Somaliland' },
    { label: 'Djibouti 🇩🇯', value: 'Djibouti' },
    { label: 'Somalia 🇸🇴', value: 'Somalia' },
    { label: 'Ethiopia 🇪🇹', value: 'Ethiopia' },
    { label: 'Kenya 🇰🇪', value: 'Kenya' },
  ];

  const CITY_OPTIONS = [
    'Hargeysa',
    'Burco',
    'Boorama',
    'Berbera',
    'Gabiley',
    'Ceerigaabo',
    'Laascaanood',
    'Saylac',
    'Sheekh',
    'Wajaale',
    'Caynaba',
    'Baligubadle',
    'Badhan',
    'Dhahar',
  ];

  const DISTRICT_OPTIONS = [
    'Gacan Libaax',
    '26 June',
    'Ibraahin Koodbuur',
    'Maxamuud Haybe',
    'Axmed Dhegax',
    'Gacma Dheere',
    'Maxamed Mooge',
    '31 May',
    'Macalin Haaruun',
  ];

  useEffect(() => {
    // Initial Entry
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Background shapes loop
    const createLoop = (anim, duration) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
    };

    createLoop(circle1Anim, 4000).start();
    createLoop(circle2Anim, 6000).start();
    createLoop(rectAnim, 8000).start();

    // Logo Pulse Animation (for header icon)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

  }, []);

  // Interpolated values for shapes
  const circle1TranslateY = circle1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });
  const circle2TranslateX = circle2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 40],
  });
  const rectRotate = rectAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });


  useEffect(() => {
    // Step transition animation (Fade + Slide + Vertical)
    // Using timing with 0 duration to reset instead of setValue to fix the "moved to native" crash
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 50, duration: 0, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(slideAnim, {
          toValue: 0, // Slide to center
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    });
  }, [step]);

  const handleCountrySelect = (option) => {
    if (option.value !== 'Somaliland') {
      Alert.alert('Service Unavailable', 'Right now we are available in only Somaliland.');
      setCountry('Somaliland');
    } else {
      setCountry(option.value);
    }
    setCountryDropdownOpen(false);
  };

  const validateSomaliaPhone = (number) => {
    if (!number) return null;
    const digits = number.replace(/\D/g, '');

    let cleanNumber = '';

    // Handle formats: +2520..., 2520..., +252..., 252..., 0..., or just the 9 digits
    if (digits.startsWith('252')) {
      const remaining = digits.slice(3);
      if (remaining.startsWith('0')) {
        cleanNumber = remaining.slice(1);
      } else {
        cleanNumber = remaining;
      }
    } else if (digits.startsWith('0')) {
      cleanNumber = digits.slice(1);
    } else {
      cleanNumber = digits;
    }

    if (cleanNumber.length !== 9) {
      return "Use 9 core digits (after prefix/country code)";
    }

    const allowedPrefixes = ['61', '77', '63', '65', '90', '67'];
    const prefix = cleanNumber.substring(0, 2);

    if (!allowedPrefixes.includes(prefix)) {
      return "Invalid prefix. Use Hormuud, Telesom, Somtel, Golis or Soltelco";
    }

    return null;
  };

  const normalizePhone = (number) => {
    if (!number) return '';
    const digits = number.replace(/\D/g, '');
    let cleanNumber = '';

    if (digits.startsWith('252')) {
      const remaining = digits.slice(3);
      if (remaining.startsWith('0')) {
        cleanNumber = remaining.slice(1);
      } else {
        cleanNumber = remaining;
      }
    } else if (digits.startsWith('0')) {
      cleanNumber = digits.slice(1);
    } else {
      cleanNumber = digits;
    }

    return cleanNumber.length === 9 ? `+252${cleanNumber}` : digits;
  };

  const handlePhoneChange = (val) => {
    setPhone(val);
    const error = validateSomaliaPhone(val);
    setPhoneError(error || '');
  };

  const handleSecondaryPhoneChange = (val) => {
    setSecondaryPhone(val);
    const error = validateSomaliaPhone(val);
    setSecondaryPhoneError(error || '');
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dobDate;
    setShowDatePicker(Platform.OS === 'ios');
    setDobDate(currentDate);

    // Format YYYY-MM-DD
    const isoDate = currentDate.toISOString().split('T')[0];
    setDob(isoDate);
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
      if (!name.trim() || name.trim().length < 2) {
        Alert.alert('Invalid Name', 'Please enter your full name (at least 2 characters).');
        return false;
      }

      if (!gender) {
        Alert.alert('Missing Gender', 'Please select your gender.');
        return false;
      }

      // 3. Date Validation & Age Calculation
      // User must not be less than 15 years old.
      if (!dob) {
        Alert.alert('Missing Date of Birth', 'Please select your date of birth.');
        return false;
      }

      const today = new Date();
      const birthDate = new Date(dobDate);

      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();

      // Adjust age if birthday hasn't happened yet this year
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 15) {
        Alert.alert('Age Restriction', 'You must be at least 15 years old to register.');
        return false;
      }

      if (age > 100) {
        Alert.alert('Invalid Date', 'Please enter a valid date of birth.');
        return false;
      }

      // Somalia Phone Validation
      const phoneErrorMsg = validateSomaliaPhone(phone);
      if (!phone) {
        Alert.alert('Missing Phone', 'Please enter your primary phone number.');
        return false;
      }
      if (phoneErrorMsg) {
        Alert.alert('Invalid Phone', phoneErrorMsg);
        setPhoneError(phoneErrorMsg);
        return false;
      }

      if (secondaryPhone && validateSomaliaPhone(secondaryPhone)) {
        Alert.alert('Invalid Secondary Phone', validateSomaliaPhone(secondaryPhone));
        setSecondaryPhoneError(validateSomaliaPhone(secondaryPhone));
        return false;
      }
    }

    if (step === 3) {
      if (!country.trim()) {
        Alert.alert('Missing Country', 'Please select your country.');
        return false;
      }
      if (!city.trim()) {
        Alert.alert('Missing City', 'Please select your city.');
        return false;
      }
      if (!district.trim()) {
        Alert.alert('Missing District', 'Please select your district.');
        return false;
      }
      if (!village.trim()) {
        Alert.alert('Missing Village', 'Please enter your village.');
        return false;
      }
      if (!address.trim()) {
        Alert.alert('Missing Address', 'Please enter your address details.');
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
            district: district.trim() || null, // Explicit District field
            address_descr: addressDescr.trim() || null,
          },
          { onConflict: 'user_id' },
        );

      if (profileError) {
        console.log('[SignupWizard] profile upsert error', profileError);
        Alert.alert('Warning', 'Account created, but failed to save profile details. You can edit them later.');
      } else {
        try {
          const payload = {
            user_id: user.id,
            name: name.trim() || null,
            country: country.trim() || null,
            city: city.trim() || null,
            phone: normalizePhone(phone),
            secondary_phone: normalizePhone(secondaryPhone),
            address_line: address.trim() || null,
            is_primary: true,
          };

          await supabase.from('customer_addresses').insert([payload]);
        } catch (addrErr) {
          console.log('[SignupWizard] customer_addresses insert error', addrErr);
        }
      }

      setSuccess(true);
      setTimeout(() => {
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
      }, 500);
    } catch (err) {
      console.error('Signup wizard error:', err);
      Alert.alert('Error', 'Something went wrong completing your sign up.');
    } finally {
      setLoading(false);
    }
  };

  // Premium Progress Header
  const renderProgressHeader = () => {
    // Progress Line width interpolation
    // Step 1: 0%, Step 2: 50%, Step 3: 100% (Visual tweak: 15% -> 50% -> 85%)
    const progressWidth = ((step - 1) / 2) * 100;

    return (
      <View style={styles.stepContainerPremium}>
        {/* Background Line */}
        <View style={styles.stepLineBg}>
          <Animated.View
            style={[
              styles.stepLineFill,
              {
                width: `${progressWidth}%`,
                // Animate width change? CSS width transition not avail in RN directly via string %. 
                // Simplified: Just direct render for now as simple interpolation of width % is tricky without layout measurement.
                // We will use flex or strict simple LayoutAnimation if needed. 
                // For now, let's just let React re-render width.
              }
            ]}
          />
        </View>

        {/* Step Nodes */}
        {[1, 2, 3].map((s) => {
          const isActive = step === s;
          const isCompleted = step > s;

          return (
            <TouchableOpacity
              key={s}
              style={styles.stepNodeWrapper}
              onPress={() => {
                if (s < step) setStep(s);
              }}
              disabled={s >= step}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.stepNode,
                  isActive && styles.stepNodeActive,
                  isCompleted && styles.stepNodeCompleted
                ]}
              >
                {isCompleted ? (
                  <Check size={14} color="#FFF" />
                ) : (
                  <Text style={[styles.stepNodeText, isActive && styles.stepNodeTextActive]}>{s}</Text>
                )}
              </View>
              {isActive && <Text style={styles.stepLabelActive}>Step {s}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };



  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#090966" />
      <View style={{ flex: 1 }}>
        {/* Header Section with Animation */}
        {/* Premium Header Section */}
        <View style={styles.headerSectionPremium}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBackButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleColumn}>
            <Text style={styles.headerLabel}>Step {step} of 3</Text>
            <Text style={styles.headerTitleMain}>
              {step === 1 ? "Let's start here" : step === 2 ? "Tell us about you" : "Where do you live?"}
            </Text>
          </View>

          <View style={styles.headerIconContainer}>
            {/* Dynamic Icon based on step */}
            {step === 1 && <User size={28} color="#090966" />}
            {step === 2 && <FileText size={28} color="#090966" />}
            {step === 3 && <MapPin size={28} color="#090966" />}
          </View>
        </View>

        {/* Bottom Sheet Section */}
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {renderProgressHeader()}

          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.wizardScrollContent}
            showsVerticalScrollIndicator={false}
            enableOnAndroid={true}
            extraScrollHeight={150}
            enableResetScrollToCoords={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [
                  { translateX: slideAnim },
                  { translateY: slideAnim.interpolate({ inputRange: [0, 50], outputRange: [0, 10] }) }
                ]
              }}
            >
              {step === 1 && (
                <View style={styles.section}>
                  {/* Title Removed as requested */}

                  <InputField
                    label="Username"
                    icon={User}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Username"
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                  />
                  <InputField
                    label="Email"
                    icon={Mail}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email Address"
                    type="email-address"
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                  />
                  <InputField
                    label="Password"
                    icon={Lock}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    secure={true}
                    isPassword={true}
                    showPassword={showPassword}
                    setShowPassword={setShowPassword}
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                  />

                  <View style={styles.passwordHints}>
                    <Text style={[styles.helperText, password.length >= 8 && styles.passwordHintValid]}>
                      • At least 8 characters
                    </Text>
                    <Text style={[styles.helperText, /[A-Za-z]/.test(password) && styles.passwordHintValid]}>
                      • Contains a letter
                    </Text>
                    <Text style={[styles.helperText, /[0-9]/.test(password) && styles.passwordHintValid]}>
                      • Contains a number
                    </Text>
                  </View>
                </View>
              )}

              {step === 2 && (
                <View style={styles.section}>
                  {/* Title Removed */}

                  <InputField
                    label="Full Name"
                    icon={User}
                    value={name}
                    onChangeText={setName}
                    placeholder="Full Name"
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                  />

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.genderRow}>
                      {[
                        { label: 'Male', val: 'Male' },
                        { label: 'Female', val: 'Female' }
                      ].map((g) => (
                        <TouchableOpacity
                          key={g.val}
                          style={[
                            styles.genderOption,
                            gender === g.val && styles.genderOptionActive,
                          ]}
                          onPress={() => setGender(g.val)}
                        >
                          {/* Horizontal Layout: Icon + Text */}
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <User
                              size={18} // Slightly smaller icon
                              color={gender === g.val ? '#FFF' : '#4B5563'}
                              style={{ marginRight: 8 }} // Margin right instead of bottom
                            />
                            <Text style={gender === g.val ? styles.genderTextActive : styles.genderText}>
                              {g.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <InputField
                    label="DOB"
                    icon={Calendar}
                    value={dob}
                    placeholder="Date of Birth (YYYY-MM-DD)"
                    editable={false}
                    onPress={() => setShowDatePicker(true)}
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                  />

                  {showDatePicker && (
                    <DateTimePicker
                      testID="dateTimePicker"
                      value={dobDate}
                      mode="date"
                      is24Hour={true}
                      display="default"
                      onChange={onDateChange}
                    />
                  )}

                  <InputField
                    label="Primary Phone"
                    icon={Phone}
                    value={phone}
                    onChangeText={handlePhoneChange}
                    placeholder="Primary Phone (e.g. 063...)"
                    type="phone-pad"
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                    error={phoneError}
                  />

                  <InputField
                    label="Secondary Phone (Optional)"
                    icon={Phone}
                    value={secondaryPhone}
                    onChangeText={handleSecondaryPhoneChange}
                    placeholder="Secondary Phone"
                    type="phone-pad"
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                    error={secondaryPhoneError}
                  />
                </View>
              )}

              {step === 3 && (
                <View style={styles.section}>

                  {/* Country Dropdown */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Country</Text>
                    <TouchableOpacity
                      style={[styles.inputContainer, countryDropdownOpen && styles.inputFocused]}
                      onPress={() => {
                        setCountryDropdownOpen(!countryDropdownOpen);
                        setCityDropdownOpen(false);
                      }}
                    >
                      <View style={{ marginRight: 12 }}>
                        {/* Try to find flag icon or MapPin */}
                        <MapPin size={20} color='#090966' />
                      </View>
                      <Text style={styles.dropdownValue}>
                        {COUNTRY_OPTIONS.find(c => c.value === country)?.label || country || 'Select Country'}
                      </Text>
                      <ChevronDown size={20} color='#090966' />
                    </TouchableOpacity>
                    {countryDropdownOpen && (
                      <View style={styles.dropdownMenu}>
                        {COUNTRY_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={styles.dropdownItem}
                            onPress={() => handleCountrySelect(option)}
                          >
                            <Text style={styles.dropdownItemText}>{option.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* City Dropdown */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>City</Text>
                    <TouchableOpacity
                      style={[styles.inputContainer, cityDropdownOpen && styles.inputFocused]}
                      onPress={() => {
                        setCityDropdownOpen(!cityDropdownOpen);
                        setCountryDropdownOpen(false);
                      }}
                    >
                      <MapPin size={20} color='#090966' style={styles.inputIcon} />
                      <Text style={[styles.dropdownValue, !city && styles.dropdownPlaceholder]}>
                        {city || 'Select City'}
                      </Text>
                      <ChevronDown size={20} color='#090966' />
                    </TouchableOpacity>
                    {cityDropdownOpen && (
                      <View style={styles.dropdownMenu}>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                          {CITY_OPTIONS.map((option) => (
                            <TouchableOpacity
                              key={option}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setCity(option);
                                setCityDropdownOpen(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{option}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* District Dropdown (New) */}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>District</Text>
                    <TouchableOpacity
                      style={[styles.inputContainer, districtDropdownOpen && styles.inputFocused]}
                      onPress={() => {
                        setDistrictDropdownOpen(!districtDropdownOpen);
                        setCityDropdownOpen(false);
                        setCountryDropdownOpen(false);
                      }}
                    >
                      <MapPin size={20} color='#090966' style={styles.inputIcon} />
                      <Text style={[styles.dropdownValue, !district && styles.dropdownPlaceholder]}>
                        {district || 'Select District'}
                      </Text>
                      <ChevronDown size={20} color='#090966' />
                    </TouchableOpacity>
                    {districtDropdownOpen && (
                      <View style={styles.dropdownMenu}>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
                          {DISTRICT_OPTIONS.map((option) => (
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
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {/* Village Input (Replaces District) */}
                  <InputField
                    label="Village"
                    icon={Home}
                    value={village}
                    onChangeText={setVillage}
                    placeholder="Enter your village"
                    focusedInput={focusedInput}
                    setFocusedInput={setFocusedInput}
                  />

                  <View style={styles.fieldGroup}>
                    <View style={[styles.inputContainerMultiline, focusedInput === 'Address' && styles.inputFocused]}>
                      {/* Fixed Layout: Align icon to top */}
                      <View style={{ paddingTop: 4 }}>
                        <FileText size={20} color='#090966' style={styles.inputIcon} />
                      </View>
                      <TextInput
                        style={styles.inputMultiline}
                        placeholder="Address Details"
                        value={address}
                        onChangeText={setAddress}
                        placeholderTextColor="#9CA3AF"
                        multiline
                        onFocus={() => setFocusedInput('Address')}
                        onBlur={() => setFocusedInput(null)}
                      />
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Footer MOVED INSIDE SCROLLVIEW */}
            <View style={styles.footer}>
              {step < 3 ? (
                <BeegsoButton
                  label="Next Step"
                  onPress={handleNextStep}
                  loading={loading}
                  icon={ChevronRight}
                />
              ) : (
                <BeegsoButton
                  label="Complete Sign Up"
                  onPress={handleCompleteSignup}
                  loading={loading}
                  success={success}
                  icon={Check}
                />
              )}

              <View style={styles.loginLinkRow}>
                <Text style={styles.loginLinkText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Welcome')}>
                  <Text style={styles.loginLinkHighlight}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>

          </KeyboardAwareScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#090966',
  },
  headerSection: {
    height: '20%', // Reduced from 28% to 20% to shift form up
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    zIndex: 10,
  },
  headerLogoSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#090966',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  bgCircle1: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  bgCircle2: {
    position: 'absolute',
    top: '20%',
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bgRect: {
    position: 'absolute',
    bottom: 20,
    left: '10%',
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 16,
    marginTop: -24, // Reduced from -50/-32 to fix "too up" issue
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16, // Reduced from 32
    paddingHorizontal: 16,
  },
  stepWrapper: {
    alignItems: 'center',
    width: 80,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  stepCircleActive: {
    borderColor: '#090966',
  },
  stepCircleCompleted: {
    backgroundColor: '#090966',
    borderColor: '#090966',
  },
  stepText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepTextActive: {
    color: '#090966',
  },
  stepTextInactive: {
    color: '#9CA3AF',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#090966',
    fontWeight: '700',
  },
  stepLabelInactive: {
    color: '#9CA3AF',
  },
  stepLine: {
    position: 'absolute',
    top: 15,
    left: 50,
    width: 60,
    height: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 0,
  },
  stepLineActive: {
    backgroundColor: '#090966',
  },
  wizardScrollContent: {
    paddingBottom: 20,
  },
  section: {},
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#090966',
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB', // Reverted from #F3F4F6 to fix "like it was previous"
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
  },
  inputContainerMultiline: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 16,
    minHeight: 100,
  },
  inputFocused: {
    borderColor: '#090966',
    backgroundColor: '#FFFFFF',
    // Removed borderWidth: 1.5 override if user dislike boldness of focus
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#090966',
    fontWeight: '500',
  },
  inputMultiline: {
    flex: 1,
    fontSize: 15,
    color: '#090966',
    textAlignVertical: 'top',
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 8,
  },
  passwordHints: {
    marginTop: 8,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  passwordHintValid: {
    color: '#10B981',
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  genderRow: {
    flexDirection: 'row',
  },
  genderOption: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10, // Reduced vertical padding (compact)
    alignItems: 'center',
    justifyContent: 'center', // Center content
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  genderOptionActive: {
    backgroundColor: '#090966',
    borderColor: '#090966',
  },
  genderText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  genderTextActive: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dropdownValue: {
    flex: 1,
    fontSize: 15,
    color: '#090966',
    fontWeight: '600',
  },
  dropdownPlaceholder: {
    color: '#9CA3AF',
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 100,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
  },
  footer: {
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#090966',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#090966',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginLinkText: {
    color: '#6B7280',
    fontSize: 13,
  },
  loginLinkHighlight: {
    color: '#090966',
    fontWeight: '700',
    fontSize: 13,
  },
  // --- Premium UI Styles ---
  headerSectionPremium: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 20 : 60,
    paddingHorizontal: 24,
    paddingBottom: 45, // Increased from 30
    backgroundColor: '#090966',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleColumn: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerLabel: {
    color: '#A0A3BD',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerTitleMain: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  stepContainerPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 24, // Spacing from header
    paddingHorizontal: 32,
    position: 'relative',
  },
  stepLineBg: {
    position: 'absolute',
    left: 45, // approximate start
    right: 45, // approximate end
    top: 14, // Center vertically relative to nodes (30px height / 2 approx)
    height: 3,
    backgroundColor: '#E5E7EB',
    zIndex: -1,
    borderRadius: 2,
  },
  stepLineFill: {
    height: '100%',
    backgroundColor: '#090966',
    borderRadius: 2,
  },
  stepNodeWrapper: {
    alignItems: 'center',
    zIndex: 10,
  },
  stepNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepNodeActive: {
    borderColor: '#090966',
    backgroundColor: '#FFFFFF',
    transform: [{ scale: 1.1 }], // Subtle scale
    shadowColor: '#090966',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  stepNodeCompleted: {
    backgroundColor: '#090966',
    borderColor: '#E5E7EB',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  stepNodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepNodeTextActive: {
    color: '#090966',
  },
  stepLabelActive: {
    position: 'absolute',
    top: 36,
    fontSize: 12,
    fontWeight: '600',
    color: '#090966',
    whiteSpace: 'nowrap',
    width: 60,
    textAlign: 'center',
  },
});
