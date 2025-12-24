import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

const EditProfileScreen = ({ navigation }) => {
    const authEmail = useStore((state) => state.authEmail);
    const authUserId = useStore((state) => state.authUserId);
    const setUserProfile = useStore((state) => state.setUserProfile);

    const [name, setName] = useState('');
    const [email, setEmail] = useState(authEmail || '');
    const [username, setUsername] = useState('');
    const [gender, setGender] = useState('');
    const [dob, setDob] = useState('');
    const [country, setCountry] = useState('');
    const [city, setCity] = useState('');
    const [district, setDistrict] = useState('');
    const [address, setAddress] = useState('');
    const [addressDescr, setAddressDescr] = useState('');
    const [loading, setLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);
    const [localAvatarUri, setLocalAvatarUri] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    useEffect(() => {
        loadUserProfile();
    }, []);

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
                setCountry(data.country || '');
                setCity(data.city || '');
                setDistrict(data.district || '');
                setAddress(data.address || '');
                setAddressDescr(data.address_descr || '');
                if (data.avatar_url) {
                    setAvatarUrl(data.avatar_url);
                }
            }
        } catch (e) {
            console.warn('Unexpected error loading profile:', e.message);
        }
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

        setLoading(true);

        try {
            if (authUserId) {
                const { error } = await supabase
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

                if (error) {
                    console.log('[ProfileSave] error', error);
                    Alert.alert('Error', error.message || 'Failed to update profile');
                    setLoading(false);
                    return;
                }
            }

            // Update local store (keep existing avatar if we have one)
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
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <ChevronLeft color="#111827" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
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
                        <Text style={styles.changePhotoText}>
                            {uploadingAvatar ? 'Uploading...' : 'Change Photo'}
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.formSection}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Enter your full name"
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Enter your username"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter your email"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.formRow}>
                    <View style={[styles.formSection, styles.formSectionHalf]}>
                        <Text style={styles.label}>Gender</Text>
                        <TextInput
                            style={styles.input}
                            value={gender}
                            onChangeText={setGender}
                            placeholder="Male / Female"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                    <View style={[styles.formSection, styles.formSectionHalf]}>
                        <Text style={styles.label}>Date of Birth</Text>
                        <TextInput
                            style={styles.input}
                            value={dob}
                            onChangeText={setDob}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Country</Text>
                    <TextInput
                        style={styles.input}
                        value={country}
                        onChangeText={setCountry}
                        placeholder="Enter your country"
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                <View style={styles.formRow}>
                    <View style={[styles.formSection, styles.formSectionHalf]}>
                        <Text style={styles.label}>City</Text>
                        <TextInput
                            style={styles.input}
                            value={city}
                            onChangeText={setCity}
                            placeholder="City"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                    <View style={[styles.formSection, styles.formSectionHalf]}>
                        <Text style={styles.label}>District</Text>
                        <TextInput
                            style={styles.input}
                            value={district}
                            onChangeText={setDistrict}
                            placeholder="District"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                        style={styles.input}
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Street, building, etc."
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                <View style={styles.formSection}>
                    <Text style={styles.label}>Address Description</Text>
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        value={addressDescr}
                        onChangeText={setAddressDescr}
                        placeholder="Extra details to help find your address"
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.saveButtonText}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    placeholder: {
        width: 40,
    },
    scrollContent: {
        padding: 16,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarWrapper: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 3,
        borderColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
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
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 6,
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
    formSection: {
        marginBottom: 20,
    },
    formRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    formSectionHalf: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
    },
    inputMultiline: {
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: '#2563EB',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 24,
    },
    saveButtonDisabled: {
        backgroundColor: '#93C5FD',
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
