import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, StatusBar, ScrollView, ImageBackground, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Mail, ShoppingBag, ArrowRight } from 'lucide-react-native';
import BeegsoButton from '../components/BeegsoButton';

const { width, height } = Dimensions.get('window');

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [emailError, setEmailError] = useState('');

  const validateEmail = (val) => {
    if (!val) return null;
    const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!emailRegex.test(val)) {
      return "Please enter a valid email address";
    }
    return null;
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    setEmailError(validateEmail(val) || '');
  };

  const handleSendReset = async () => {
    const trimmedEmail = email.trim();
    const error = validateEmail(trimmedEmail);

    if (!trimmedEmail) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }

    if (error) {
      Alert.alert('Invalid email', error);
      setEmailError(error);
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: 'ecommerceapp://reset-password',
      });

      if (error) {
        Alert.alert('Reset failed', error.message || 'Unable to send reset email.');
        return;
      }

      Alert.alert(
        'Check your email',
        'We have sent a password reset link to your email address.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (err) {
      console.error('ForgotPassword error:', err);
      Alert.alert('Error', 'Something went wrong while sending the reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ImageBackground
        source={require('../../assets/photo4.jpg')}
        style={styles.bgImage}
        resizeMode="cover"
      >
        <View style={styles.bgOverlay}>
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.headerContainer}>
              {/* Logo Section */}
              <View style={styles.logoCircle}>
                <ShoppingBag size={28} color="#090966" fill="#090966" />
              </View>
              <View style={styles.brandRow}>
                <Text style={styles.brandName}>Beegso</Text>
                <Text style={styles.brandDot}>.</Text>
              </View>
            </View>
          </SafeAreaView>

          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.bottomSheet}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                <Text style={styles.title}>Forgot Password</Text>

                <View style={styles.inputWrapper}>
                  <View
                    style={[
                      styles.inputContainer,
                      isEmailFocused && styles.inputFocused,
                      emailError && styles.inputError,
                    ]}
                  >
                    <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email Address"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={handleEmailChange}
                      onFocus={() => setIsEmailFocused(true)}
                      onBlur={() => setIsEmailFocused(false)}
                    />
                  </View>
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                </View>

                <BeegsoButton
                  label={loading ? 'Sending...' : 'Send Reset Link'}
                  onPress={handleSendReset}
                  loading={loading}
                  disabled={!email || !!emailError || loading}
                  icon={ArrowRight}
                  style={{ backgroundColor: '#5B5EA6', marginTop: 12 }} // Using a direct style override close to reference
                />

                <View style={styles.footerRow}>
                  <Text style={styles.footerText}>Remembered your password? </Text>
                  <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.footerLink}>Back to Sign In</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>HELP</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.contactSupportButton}
                  onPress={() => Alert.alert('Support', 'Contact support feature coming soon.')}
                >
                  <Text style={styles.contactSupportText}>Contact Support</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </View>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#090966',
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bgOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 102, 0.85)', // Slightly darker overlay for contrast
  },
  safeArea: {
    alignItems: 'center',
    height: '35%', // Top section height
    justifyContent: 'center',
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800', // Heavy bold
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  brandDot: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FBBF24', // Yellow dot
  },
  keyboardView: {
    flex: 1,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    // Shadow for the card feel
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -5 },
    elevation: 10,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
  },
  inputFocused: {
    borderColor: '#090966',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#090966',
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  mainButton: {
    marginTop: 8,
    backgroundColor: '#6366F1', // Indigo color from screenshot, adjusting
    // BeegsoButton handles its own styles, usually primary color. 
  },
  footerRow: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  footerLink: {
    fontSize: 14,
    color: '#111827', // Black/Dark for link
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
    opacity: 0.5,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  contactSupportButton: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  contactSupportText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
