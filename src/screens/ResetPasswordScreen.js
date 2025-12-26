import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, StatusBar, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const ResetPasswordScreen = ({ navigation }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const extractTokensFromUrl = (urlString) => {
      if (!urlString) return { accessToken: null, refreshToken: null };

      // Supabase typically appends tokens in the hash ("#access_token=...")
      // but may also use the query string. Handle both.
      const hashIndex = urlString.indexOf('#');
      const queryIndex = urlString.indexOf('?');

      let paramsString = '';
      if (hashIndex !== -1) {
        paramsString = urlString.slice(hashIndex + 1);
      } else if (queryIndex !== -1) {
        paramsString = urlString.slice(queryIndex + 1);
      }

      const searchParams = new URLSearchParams(paramsString);
      return {
        accessToken: searchParams.get('access_token'),
        refreshToken: searchParams.get('refresh_token'),
      };
    };

    const ensureRecoverySession = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) return;

        const { accessToken, refreshToken } = extractTokensFromUrl(url);

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch (err) {
        console.error('ResetPassword ensureRecoverySession error:', err);
      }
    };

    ensureRecoverySession();
  }, []);

  const handleUpdatePassword = async () => {
    const trimmedPassword = password.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword || !trimmedConfirm) {
      Alert.alert('Missing information', 'Please enter and confirm your new password.');
      return;
    }

    if (trimmedPassword.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters long.');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.');
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });

      if (error) {
        Alert.alert('Update failed', error.message || 'Unable to update your password.');
        return;
      }

      Alert.alert(
        'Password updated',
        'Your password has been updated. You can now sign in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => navigation.replace('Welcome'),
          },
        ],
      );
    } catch (err) {
      console.error('ResetPassword update error:', err);
      Alert.alert('Error', 'Something went wrong while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.select({
          ios: 60,
          android: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 0,
          default: 0,
        })}
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>
              Choose a strong password for your account. After updating, you will be able to sign in with your new password.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>
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
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.replace('Welcome')}
            >
              <Text style={styles.secondaryButtonText}>Cancel and go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E5EDFF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
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
  primaryButton: {
    marginTop: 8,
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
  secondaryButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
});
