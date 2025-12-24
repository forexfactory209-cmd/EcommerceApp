import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const WelcomeScreen = ({ navigation }) => {
  const setAuthUser = useStore((state) => state.setAuthUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const ADMIN_EMAIL = 'caliaxmed488@gmail.com';

  const handleAuth = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Missing information', 'Please enter your email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (trimmedPassword.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters long.');
      return;
    }

    if (loading) return;
    setLoading(true);
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        Alert.alert('Login failed', signInError.message);
        return;
      }

      const user = signInData.user;
      if (!user) {
        Alert.alert('Login failed', 'No user returned from Supabase.');
        return;
      }

      // Fetch profile and brand metadata in parallel to reduce wait time
      const [
        { data: profile, error: profileError },
        { data: brandRow, error: brandError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('brands')
          .select('id, name, status, logo_url')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (profileError && profileError.code !== 'PGRST116') {
        Alert.alert('Error', profileError.message || 'Failed to load profile.');
        return;
      }

      if (brandError) {
        // Non-fatal: log but don't block login
        console.warn('Error loading brand for user:', brandError.message || brandError);
      }

      const hasBrand = !!brandRow;
      const hasApprovedBrand = brandRow?.status === 'approved';

      let effectiveRole = 'customer';
      if (user.email === ADMIN_EMAIL) {
        effectiveRole = 'admin';
      } else if (hasApprovedBrand) {
        effectiveRole = 'brand';
      }

      // For approved brands, prefer the brand name as the display name
      let effectiveName = profile?.name || '';
      if (effectiveRole === 'brand' && brandRow?.name) {
        effectiveName = brandRow.name;
      }

      setAuthUser({
        id: user.id,
        email: user.email,
        role: effectiveRole,
        name: effectiveName,
        brandLogoUrl: brandRow?.logo_url || null,
      });
      navigation.replace('Main');
    } catch (err) {
      Alert.alert('Error', 'Something went wrong with authentication.');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderLoginContent = () => (
    <SafeAreaView style={styles.screen}>
      <View style={styles.background} />
      <View style={styles.centerWrapper}>
        <View style={styles.cardStack}>
          <View style={styles.card}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>🛍️</Text>
            </View>
          </View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to manage your store and orders.
          </Text>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => Alert.alert('Forgot Password', 'Password reset coming soon.')}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>
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
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
            <Text style={styles.primaryButtonText}>
              {loading ? 'Please wait...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => Alert.alert('Google Sign-In', 'Google sign-in coming soon.')}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => navigation.navigate('Signup')}
              >
                Create account
              </Text>
            </Text>
          </View>
          </View>
          <View style={styles.cardBottomAccent} />
        </View>
      </View>
    </SafeAreaView>
  );

  return renderLoginContent();
}
export default WelcomeScreen;

const styles = StyleSheet.create({
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  form: {
    marginTop: 4,
    paddingVertical:20,
    // paddingHorizontal:30,
  },
  screen: {
    flex: 1,
    backgroundColor: '#E5EDFF', // soft blue background similar to design
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardStack: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 75,
    paddingVertical: 100,
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
    paddingBottom: 16,
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
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    paddingVertical:2,
    // paddingHorizontal:20,
    marginBottom: 6,

  },
  forgotText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    // paddingHorizontal: 2,
    // paddingVertical: 1,
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
    paddingVertical: 18,
    fontSize: 15,
    color: '#111827',
  },
  inputMultiline: {
    minHeight: 72,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    padding: 4,
    marginTop: 4,
  },
  roleOption: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#111827',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  roleTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 8,
    fontSize: 11,
    color: '#9CA3AF',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EA4335',
    marginRight: 8,
  },
  googleButtonText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  footerRow: {
    marginTop: 18,
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
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  genderOption: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  genderOptionActive: {
    backgroundColor: '#11126F',
    borderColor: '#11126F',
  },
  genderText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  genderTextActive: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  wizardFooter: {
    paddingTop: 8,
    paddingBottom: 4,
  },
});
