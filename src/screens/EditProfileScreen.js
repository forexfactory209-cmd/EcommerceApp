import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    Platform,
    StatusBar,
    Animated,
    Easing,
    Dimensions,
    Pressable,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import {
    User, Mail, Lock, Check, ChevronLeft, ChevronRight, Calendar,
    MapPin, Phone, Home, FileText, ChevronDown, Eye, EyeOff, UserPlus, Camera,
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
                    <Text style={[styles.input, { color: value ? '#090966' : '#9CA3AF' }]}>
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

const EditProfileScreen = ({ navigation }) => {
    const authEmail = useStore((state) => state.authEmail);
    const authUserId = useStore((state) => state.authUserId);
    const setUserProfile = useStore((state) => state.setUserProfile);

    const [name, setName] = useState('');
    const [email, setEmail] = useState(authEmail || '');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState('');
    const [dob, setDob] = useState('');
    const [dobDate, setDobDate] = useState(new Date());
    const [country, setCountry] = useState('Somaliland');
    const [city, setCity] = useState('');
    const [district, setDistrict] = useState('');
    const [village, setVillage] = useState('');
    const [phone, setPhone] = useState('');
    const [secondaryPhone, setSecondaryPhone] = useState('');
    const [address, setAddress] = useState('');
    const [addressDescr, setAddressDescr] = useState('');
    const [loading, setLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [localAvatarUri, setLocalAvatarUri] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
    const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
    const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
    const [focusedInput, setFocusedInput] = useState(null);
    const [phoneError, setPhoneError] = useState('');
    const [secondaryPhoneError, setSecondaryPhoneError] = useState('');

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(100)).current;

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
        // Initial Entry Animation
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
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            loadUserProfile();
        }, [authUserId, authEmail])
    );

    const loadUserProfile = async () => {
        if (!authUserId) return;

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('name, username, gender, dob, country, city, district, address, address_descr, avatar_url')
                .eq('user_id', authUserId)
                .maybeSingle();

            if (error) {
                console.warn('Error loading user profile:', error.message);
                return;
            }

            if (data) {
                setName(data.name || '');
                setEmail(authEmail || '');
                setUsername(data.username || '');
                setGender(data.gender || '');
                setDob(data.dob || '');
                if (data.dob) {
                    setDobDate(new Date(data.dob));
                }
                setCountry(data.country || 'Somaliland');
                setCity(data.city || '');
                setDistrict(data.district || '');
                setAddress(data.address || '');
                setAddressDescr(data.address_descr || '');
                if (data.avatar_url) {
                    setAvatarUrl(data.avatar_url);
                }
            }

            // Load address data
            const { data: addressData, error: addressError } = await supabase
                .from('customer_addresses')
                .select('phone, secondary_phone, address_line, village')
                .eq('user_id', authUserId)
                .eq('is_primary', true)
                .maybeSingle();

            if (addressData && !addressError) {
                setPhone(addressData.phone || '');
                setSecondaryPhone(addressData.secondary_phone || '');
                setAddress(addressData.address_line || '');
                setVillage(addressData.village || '');
            }
        } catch (e) {
            console.warn('Unexpected error loading profile:', e.message);
        }
    };

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

    const handlePickAvatar = async () => {
        if (!authUserId) return;

        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.status !== 'granted') {
            Alert.alert('Permission required', 'We need access to your photos to set a profile picture.');
            return;
        }

        const pickerOptions = {
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        };

        if (ImagePicker.MediaType && ImagePicker.MediaType.Images) {
            pickerOptions.mediaTypes = ImagePicker.MediaType.Images;
        } else if (
            ImagePicker.MediaTypeOptions &&
            ImagePicker.MediaTypeOptions.Images
        ) {
            pickerOptions.mediaTypes = ImagePicker.MediaTypeOptions.Images;
        }

        const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (result.canceled) {
            return;
        }

        const asset = result.assets && result.assets[0];
        if (!asset?.uri) return;

        setUploadingAvatar(true);

        try {
            const uri = asset.uri;
            const fileExt = uri.split('.').pop() || 'jpg';
            const filePath = `${authUserId}/${Date.now()}.${fileExt}`;

            console.log('[AvatarUpload] starting upload, uri =', uri);

            let response;
            try {
                response = await fetch(uri);
            } catch (e) {
                console.log('[AvatarUpload] fetch error:', e);
                Alert.alert('Error', 'Could not read image file: ' + (e.message || 'unknown error'));
                setUploadingAvatar(false);
                return;
            }

            let blob;
            try {
                blob = await response.blob();
            } catch (e) {
                console.log('[AvatarUpload] blob error:', e);
                Alert.alert('Error', 'Could not process image file: ' + (e.message || 'unknown error'));
                setUploadingAvatar(false);
                return;
            }

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });

            if (uploadError) {
                console.log('[AvatarUpload] supabase upload error:', uploadError);
                Alert.alert('Error', 'Failed to upload image: ' + uploadError.message);
                setUploadingAvatar(false);
                return;
            }

            const { data: publicData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const publicUrl = publicData?.publicUrl;

            const { error: profileUpsertError } = await supabase
                .from('profiles')
                .upsert({
                    user_id: authUserId,
                    avatar_url: publicUrl || '',
                }, { onConflict: 'user_id' });

            if (profileUpsertError) {
                console.log('[AvatarUpload] profile upsert error:', profileUpsertError);
                Alert.alert('Error', 'Failed to save profile image: ' + profileUpsertError.message);
                setUploadingAvatar(false);
                return;
            }

            setAvatarUrl(publicUrl);
            setLocalAvatarUri(uri);
            setUserProfile({
                name: name.trim(),
                email: email.trim(),
                avatar_url: publicUrl,
                username,
                gender,
                dob,
                country,
                city,
                district,
                address,
                address_descr: addressDescr,
            });
            console.log('[AvatarUpload] upload success, filePath =', filePath);
        } catch (e) {
            console.error('Error uploading avatar:', e);
            Alert.alert('Error', 'An unexpected error occurred while uploading the image');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter your name');
            return;
        }

        if (phoneError) {
            Alert.alert('Invalid Phone', phoneError);
            return;
        }

        if (secondaryPhoneError) {
            Alert.alert('Invalid Secondary Phone', secondaryPhoneError);
            return;
        }

        setLoading(true);

        try {
            if (authUserId) {
                // Update profiles table
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert(
                        {
                            user_id: authUserId,
                            name: name.trim(),
                            username: username.trim() || null,
                            gender: gender.trim() || null,
                            dob: dob || null,
                            country: country.trim() || null,
                            city: city.trim() || null,
                            district: district.trim() || null,
                            address: address.trim() || null,
                            address_descr: addressDescr.trim() || null,
                            avatar_url: avatarUrl || '',
                        },
                        { onConflict: 'user_id' }
                    );

                if (profileError) {
                    console.log('[ProfileSave] error', profileError);
                    Alert.alert('Error', profileError.message || 'Failed to update profile');
                    setLoading(false);
                    return;
                }

                // Update or create primary address in parallel
                const { data: existingAddress } = await supabase
                    .from('customer_addresses')
                    .select('id')
                    .eq('user_id', authUserId)
                    .eq('is_primary', true)
                    .maybeSingle();

                const addressPayload = {
                    user_id: authUserId,
                    name: name.trim() || null,
                    country: country.trim() || null,
                    city: city.trim() || null,
                    district: district.trim() || null,
                    phone: normalizePhone(phone),
                    secondary_phone: secondaryPhone ? normalizePhone(secondaryPhone) : null,
                    address_line: address.trim() || null,
                    village: village.trim() || null,
                    address_descr: addressDescr.trim() || null,
                    is_primary: true,
                };

                if (existingAddress) {
                    const { error: addressError } = await supabase
                        .from('customer_addresses')
                        .update(addressPayload)
                        .eq('id', existingAddress.id);

                    if (addressError) {
                        console.warn('[ProfileSave] Failed to update primary address:', addressError);
                    }
                } else {
                    const { error: addressError } = await supabase
                        .from('customer_addresses')
                        .insert([addressPayload]);

                    if (addressError) {
                        console.warn('[ProfileSave] Failed to create primary address:', addressError);
                    }
                }
            }

            // Update local store
            setUserProfile({
                name: name.trim(),
                email: email.trim(),
                avatar_url: avatarUrl || null,
                username,
                gender,
                dob,
                country,
                city,
                district,
                address,
                address_descr: addressDescr,
            });

            Alert.alert('Success', 'Profile updated successfully', [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                },
            ]);
        } catch (e) {
            Alert.alert('Error', 'An unexpected error occurred');
            console.error('Error updating profile:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
            {/* Enhanced Header with gradient and decorative elements */}
            <View style={styles.headerContainer}>
                <View style={styles.headerGradient}>
                    <View style={styles.headerPattern}>
                        <View style={styles.patternCircle1} />
                        <View style={styles.patternCircle2} />
                        <View style={styles.patternCircle3} />
                        {/* Corner lines */}
                        <View style={styles.cornerLineTopLeft} />
                        <View style={styles.cornerLineTopRight} />
                        <View style={styles.cornerLineBottomLeft} />
                        <View style={styles.cornerLineBottomRight} />
                    </View>
                    {/* Header content with back button and title */}
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <ChevronLeft color="#FFFFFF" size={24} />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>Edit Profile</Text>
                        </View>
                        <View style={styles.placeholder} />
                    </View>
                </View>
            </View>

            {/* Main Content with card design */}
            <View style={styles.contentContainer}>
                <KeyboardAwareScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
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
                        <View style={styles.section}>
                            {/* Avatar Section */}
                            <View style={styles.avatarSection}>
                                <View style={styles.avatarWrapper}>
                                    {avatarUrl || localAvatarUri ? (
                                        <Image
                                            source={{ uri: localAvatarUri || avatarUrl }}
                                            style={styles.avatarImage}
                                        />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <Text style={styles.avatarPlaceholderText}>
                                                {name ? name[0].toUpperCase() : 'A'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={styles.changePhotoButton}
                                    onPress={handlePickAvatar}
                                    disabled={uploadingAvatar}
                                >
                                    <Camera size={16} color="#090966" style={{ marginRight: 6 }} />
                                    <Text style={styles.changePhotoText}>
                                        {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <InputField
                                label="Full Name"
                                icon={User}
                                value={name}
                                onChangeText={setName}
                                placeholder="Full Name"
                                focusedInput={focusedInput}
                                setFocusedInput={setFocusedInput}
                            />

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
                                editable={false}
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
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <User
                                                    size={18}
                                                    color={gender === g.val ? '#FFF' : '#4B5563'}
                                                    style={{ marginRight: 8 }}
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

                            {/* District Dropdown */}
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

                            <View style={styles.fieldGroup}>
                                <View style={[styles.inputContainerMultiline, focusedInput === 'AddressDescr' && styles.inputFocused]}>
                                    <View style={{ paddingTop: 4 }}>
                                        <FileText size={20} color='#090966' style={styles.inputIcon} />
                                    </View>
                                    <TextInput
                                        style={styles.inputMultiline}
                                        placeholder="Address Description (Optional)"
                                        value={addressDescr}
                                        onChangeText={setAddressDescr}
                                        placeholderTextColor="#9CA3AF"
                                        multiline
                                        onFocus={() => setFocusedInput('AddressDescr')}
                                        onBlur={() => setFocusedInput(null)}
                                    />
                                </View>
                            </View>

                            {/* Footer */}
                            <View style={styles.footer}>
                                <BeegsoButton
                                    label="Save Changes"
                                    onPress={handleSave}
                                    loading={loading}
                                    icon={Check}
                                />
                            </View>
                        </View>
                    </Animated.View>
                </KeyboardAwareScrollView>
            </View>
        </SafeAreaView>
    );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    // Enhanced Header Styles
    headerContainer: {
        overflow: 'hidden',
    },
    headerGradient: {
        backgroundColor: '#090966',
        paddingTop: Platform.OS === 'android' ? 50 : 20,
        paddingBottom: 30,
        paddingHorizontal: 20,
        position: 'relative',
    },
    headerPattern: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    patternCircle1: {
        position: 'absolute',
        top: -30,
        right: -20,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    patternCircle2: {
        position: 'absolute',
        top: 40,
        left: -40,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    patternCircle3: {
        position: 'absolute',
        bottom: -20,
        right: 60,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    // Corner lines
    cornerLineTopLeft: {
        position: 'absolute',
        top: 20,
        left: 20,
        width: 40,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        transform: [{ rotate: '45deg' }],
    },
    cornerLineTopRight: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        transform: [{ rotate: '-45deg' }],
    },
    cornerLineBottomLeft: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        width: 40,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        transform: [{ rotate: '-45deg' }],
    },
    cornerLineBottomRight: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 40,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        transform: [{ rotate: '45deg' }],
    },
    // Back button positioned at top
    backButtonTop: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 60 : 30,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1,
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 50 : 20,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    placeholder: {
        width: 44,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    // Content Container
    contentContainer: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 32,
    },
    section: {},
    fieldGroup: {
        marginBottom: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
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
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#090966',
        fontWeight: '500',
        paddingVertical: 0, // Remove default padding
        includeFontPadding: false, // Android-specific: remove extra padding
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
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
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
        marginTop: 20,
        marginBottom: 40,
        paddingHorizontal: 20,
    },
    // Avatar styles
    avatarSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        borderColor: '#090966',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 12,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 48,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholderText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#2563EB',
    },
    changePhotoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
    },
    changePhotoText: {
        fontSize: 14,
        color: '#2563EB',
        fontWeight: '500',
    },
});
