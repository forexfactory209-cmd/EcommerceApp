import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, StatusBar, Animated, Easing, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Mail, Send } from 'lucide-react-native';
import BeegsoButton from '../components/BeegsoButton';

const { width } = Dimensions.get('window');

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const rectAnim = useRef(new Animated.Value(0)).current;

  const BRAND_COLOR = '#090966';

  useEffect(() => {
    // Entry animations
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

    // Background loop animations
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
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#090966" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headerSection}>
          <Animated.View style={[styles.bgCircle1, { transform: [{ translateY: circle1TranslateY }] }]} />
          <Animated.View style={[styles.bgCircle2, { transform: [{ translateX: circle2TranslateX }] }]} />
          <Animated.View style={[styles.bgRect, { transform: [{ rotate: rectRotate }] }]} />
        </View>

        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <ScrollView
            style={styles.contentContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>Forgot Password</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <View style={[
                  styles.inputContainer,
                  isEmailFocused && styles.inputFocused,
                  emailError && styles.inputError
                ]}>
                  <Mail
                    size={22}
                    color="#090966"
                    style={styles.inputIcon}
                  />
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
                {emailError && <Text style={styles.errorText}>{emailError}</Text>}
              </View>

              <BeegsoButton
                label={loading ? 'Sending...' : 'Send Reset Link'}
                onPress={handleSendReset}
                loading={loading}
                icon={Send}
                disabled={!email || emailError || loading}
              />

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Remembered your password? </Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Text style={styles.footerLink}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#090966',
  },
  headerSection: {
    height: '35%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
    position: 'relative',
    overflow: 'hidden',
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
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 100,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#090966',
    letterSpacing: 0.5,
  },
  form: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 18,
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
  inputFocused: {
    borderColor: '#090966',
    backgroundColor: '#fff',
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
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#090966',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#090966',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
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
  },
  footerLink: {
    color: '#090966',
    fontWeight: '800',
    marginLeft: 4,
    fontSize: 14,
  },
});
