import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const WelcomeScreen = ({ navigation }) => {
  const setAuthUser = useStore((state) => state.setAuthUser);
  const hasSeenCustomerOnboarding = useStore((state) => state.hasSeenCustomerOnboarding);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);

  const ADMIN_EMAIL = 'caliaxmed488@gmail.com';

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing information', 'Please enter your email and password.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      Alert.alert('Missing information', 'Please enter your full name for registration.');
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      if (mode === 'register') {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (signUpError) {
          Alert.alert('Sign up failed', signUpError.message);
          return;
        }

        const user = signUpData.user;
        if (!user) {
          Alert.alert('Sign up failed', 'No user returned from Supabase.');
          return;
        }
        Alert.alert(
          'Account created',
          'Your account has been created. You can now sign in with your email and password.',
        );
        setMode('login');
        setPassword('');
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
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

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          Alert.alert('Error', profileError.message || 'Failed to load profile.');
          return;
        }

        const { data: brandRow, error: brandError } = await supabase
          .from('brands')
          .select('id, name, status, logo_url')
          .eq('user_id', user.id)
          .maybeSingle();

        if (brandError) {
          // Non-fatal: log but don't block login
          console.warn('Error loading brand for user:', brandError.message);
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
        let effectiveName = profile?.name || name.trim();
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
        if (effectiveRole === 'customer' && !hasSeenCustomerOnboarding) {
          navigation.replace('CustomerOnboarding');
        } else {
          navigation.replace('Main');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong with authentication.');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.appName}>CommerceX</Text>
          <Text style={styles.subtitle}>
            {mode === 'login'
              ? 'Sign in to continue as a customer or a brand.'
              : 'Create an account to continue as a customer or a brand.'}
          </Text>
        </View>

        <View style={styles.form}>
          {mode === 'register' && (
            <>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                value={name}
                onChangeText={setName}
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {mode === 'register' && (
            <>
              <Text style={styles.label}>Continue as</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'customer' && styles.roleOptionActive]}
                  onPress={() => setRole('customer')}
                >
                  <Text style={role === 'customer' ? styles.roleTextActive : styles.roleText}>Customer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleOption, role === 'brand' && styles.roleOptionActive]}
                  onPress={() => setRole('brand')}
                >
                  <Text style={role === 'brand' ? styles.roleTextActive : styles.roleText}>Brand</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
          <Text style={styles.primaryButtonText}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <View style={{ marginTop: 16, alignItems: 'center' }}>
          {mode === 'login' ? (
            <Text style={{ color: '#6b7280', fontSize: 13 }}>
              Don't have an account?{' '}
              <Text
                style={{ color: '#2563EB', fontWeight: '600' }}
                onPress={() => setMode('register')}
              >
                Sign up
              </Text>
            </Text>
          ) : (
            <Text style={{ color: '#6b7280', fontSize: 13 }}>
              Already have an account?{' '}
              <Text
                style={{ color: '#2563EB', fontWeight: '600' }}
                onPress={() => setMode('login')}
              >
                Sign in
              </Text>
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 32,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  form: {
    marginTop: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  roleRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    padding: 4,
    marginTop: 4,
  },
  roleOption: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#111827',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  roleTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
