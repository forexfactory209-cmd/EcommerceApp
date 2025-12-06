import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';

const EditProfileScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const authEmail = useStore((state) => state.authEmail);
  const authRole = useStore((state) => state.authRole) || 'customer';
  const setUserProfile = useStore((state) => state.setUserProfile);

  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        if (!authUserId) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('Error loading profile', error.message || error);
        }

        if (data) {
          setFullName(data.name || '');
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [authUserId]);

  const handleSave = async () => {
    if (!authUserId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: authUserId,
        name: fullName || null,
        role: authRole || 'customer',
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) {
        console.warn('Error updating profile', error.message || error);
        Alert.alert('Error', 'Could not update profile, please try again.');
        return;
      }

      setUserProfile({ name: fullName, email: authEmail });
      Alert.alert('Saved', 'Your profile has been updated.');
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.containerCenter}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'<'} Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Edit Profile</Text>
          {authEmail && <Text style={styles.subtitle}>{authEmail}</Text>}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={[styles.input, styles.inputDisabled]} value={authEmail || ''} editable={false} />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  containerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 0,
  },
  backButtonText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  headerTextBlock: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputDisabled: {
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
