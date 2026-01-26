import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, StatusBar, Linking, Animated, Easing, Dimensions, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import { Mail, Lock, LogIn, Eye, EyeOff, ShoppingBag } from 'lucide-react-native';
import BeegsoButton from '../components/BeegsoButton';
import OnboardingBg from '../../assets/onboarding/bg_main.png';
import { registerForPushNotificationsAsync } from './pushNotifications';

const { width } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const setAuthUser = useStore((state) => state.setAuthUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Entry Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;

  // Background Shape Animations
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const rectAnim = useRef(new Animated.Value(0)).current;

  // Logo Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const ADMIN_EMAIL = 'caliaxmed488@gmail.com';
  const BRAND_COLOR = '#090966';
  const ACCENT_GOLD = '#ffd60a';

  // Component-level animations for interaction
  const forgotPasswordScale = useRef(new Animated.Value(1)).current;
  const forgotPasswordOpacity = useRef(new Animated.Value(1)).current;
  const createAccountScale = useRef(new Animated.Value(1)).current;
  const createAccountOpacity = useRef(new Animated.Value(1)).current;
  const googleButtonScale = useRef(new Animated.Value(1)).current;

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

    // Logo Pulse Animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
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

  // Interaction Animation Helpers
  const handlePressIn = (scaleAnim, opacityAnim) => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }),
      opacityAnim && Animated.timing(opacityAnim, { toValue: 0.7, duration: 150, useNativeDriver: true }),
    ].filter(Boolean)).start();
  };

  const handlePressOut = (scaleAnim, opacityAnim) => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      opacityAnim && Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ].filter(Boolean)).start();
  };

  const finalizeLogin = async (user) => {
    if (!user) return;

    try {
      const [
        { data: profile, error: profileError },
        { data: brandRow, error: brandError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, name, username')
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
        console.warn('Error loading brand for user:', brandError.message || brandError);
      }

      let effectiveProfile = profile;

      if (!effectiveProfile) {
        const userMeta = user.user_metadata || {};
        const inferredNameFromEmail = typeof user.email === 'string' ? user.email.split('@')[0] : null;
        const inferredName =
          userMeta.full_name ||
          userMeta.name ||
          userMeta.user_name ||
          userMeta.preferred_username ||
          inferredNameFromEmail;

        const { data: createdProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              user_id: user.id,
              name: inferredName || null,
            },
            { onConflict: 'user_id' },
          )
          .select('user_id, name, username')
          .maybeSingle();

        if (upsertError) {
          console.warn('[WelcomeScreen] Profile upsert error during login:', upsertError.message || upsertError);
        } else {
          effectiveProfile = createdProfile || profile;
        }
      }

      const hasApprovedBrand = brandRow?.status === 'approved';

      let effectiveRole = 'customer';
      if (user.email === ADMIN_EMAIL) {
        effectiveRole = 'admin';
      } else if (hasApprovedBrand) {
        effectiveRole = 'brand';
      }

      let effectiveName = effectiveProfile?.name || '';
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

      // Register this device for push notifications after we have a valid user session
      try {
        await registerForPushNotificationsAsync(user.id);
      } catch (pushErr) {
        console.warn('Failed to register push notifications:', pushErr);
      }

      navigation.replace('Main');
    } catch (err) {
      console.error('Finalize login error:', err);
      Alert.alert('Error', 'Something went wrong while finalizing sign in.');
    }
  };

  useEffect(() => {
    const extractParamsFromUrl = (urlString) => {
      if (!urlString) return { accessToken: null, refreshToken: null, type: null };

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
        type: searchParams.get('type'),
      };
    };

    const handleRecoveryLink = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) return;

        const { accessToken, refreshToken, type } = extractParamsFromUrl(url);

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

          if (type === 'recovery') {
            navigation.replace('ResetPassword');
          } else {
            navigation.replace('Main');
          }
        }
      } catch (err) {
        console.error('WelcomeScreen recovery link handling error:', err);
      }
    };

    handleRecoveryLink();
  }, [navigation]);

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (!error && data?.session) {
          navigation.replace('Main');
        }
      } catch (err) {
        console.error('WelcomeScreen session check error:', err);
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'ecommerceapp://auth-callback',
        },
      });

      if (error) {
        Alert.alert('Google Sign-In failed', error.message || 'Unable to sign in with Google.');
        return;
      }

      if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      Alert.alert('Error', 'Something went wrong with Google sign-in.');
    } finally {
      setGoogleLoading(false);
    }
  };

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

      // Fetch profile and brand metadata in parallel
      const [
        { data: profile, error: profileError },
        { data: brandRow, error: brandError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, name, username')
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
        console.warn('Error loading brand for user:', brandError.message || brandError);
      }

      const hasApprovedBrand = brandRow?.status === 'approved';

      let effectiveRole = 'customer';
      if (user.email === ADMIN_EMAIL) {
        effectiveRole = 'admin';
      } else if (hasApprovedBrand) {
        effectiveRole = 'brand';
      }

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

  return (
    <View style={styles.screen}>
      <ImageBackground source={OnboardingBg} style={styles.bgImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#090966" />
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              {/* Top Header Section with Animated Shapes */}
              <View style={styles.headerSection}>
                {/* Animated Background Shapes */}
                <Animated.View style={[styles.bgCircle1, { transform: [{ translateY: circle1TranslateY }] }]} />
                <Animated.View style={[styles.bgCircle2, { transform: [{ translateX: circle2TranslateX }] }]} />
                <Animated.View style={[styles.bgRect, { transform: [{ rotate: rectRotate }] }]} />

                {/* Animated Logo Container */}
                <View style={styles.logoContainerWrapper}>
                  {/* Pulse Ring */}
                  <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: 0.3 }]} />

                  <View style={styles.logoCircle}>
                    <ShoppingBag size={28} color="#090966" strokeWidth={2.5} />
                  </View>
                </View>

                {/* Beautified App Title */}
                <View style={styles.titleRow}>
                  <Text style={styles.headerTitle}>Beegso</Text>
                  <Text style={styles.headerAccent}>.</Text>
                </View>
              </View>

              {/* Bottom Sheet Section */}
              <Animated.View
                style={[
                  styles.bottomSheet,
                  {
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                {/* Use ScrollView to ensure Footer is reachable */}
                <ScrollView
                  style={styles.contentContainer}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Welcome Back: Smaller and Primary Color */}
                  <Text style={styles.welcomeText}>Welcome Back</Text>

                  <View style={styles.form}>
                    <View style={styles.fieldGroup}>
                      <View style={[styles.inputContainer, isEmailFocused && styles.inputFocused]}>
                        <Mail size={22} color="#4c4c9d" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Email Address"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={email}
                          onChangeText={setEmail}
                          onFocus={() => setIsEmailFocused(true)}
                          onBlur={() => setIsEmailFocused(false)}
                        />
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <View style={[styles.inputContainer, isPasswordFocused && styles.inputFocused]}>
                        <Lock size={22} color="#4c4c9d" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Password"
                          placeholderTextColor="#9CA3AF"
                          secureTextEntry={!showPassword}
                          value={password}
                          onChangeText={setPassword}
                          onFocus={() => setIsPasswordFocused(true)}
                          onBlur={() => setIsPasswordFocused(false)}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                          {showPassword ? (
                            <EyeOff size={22} color="#4c4c9d" />
                          ) : (
                            <Eye size={22} color="#4c4c9d" />
                          )}
                        </TouchableOpacity>
                      </View>

                      <Animated.View style={{ transform: [{ scale: forgotPasswordScale }], opacity: forgotPasswordOpacity }}>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('ForgotPassword')}
                          onPressIn={() => handlePressIn(forgotPasswordScale, forgotPasswordOpacity)}
                          onPressOut={() => handlePressOut(forgotPasswordScale, forgotPasswordOpacity)}
                          activeOpacity={1}
                          style={styles.forgotWrapper}
                        >
                          <Text style={styles.forgotText}>Forgot Password?</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>

                    <BeegsoButton
                      label={loading ? 'Signing In...' : 'Sign In'}
                      onPress={handleAuth}
                      loading={loading}
                      icon={LogIn}
                      disabled={!email || !password || loading}
                    />

                    <View style={styles.dividerRow}>
                      <View style={styles.divider} />
                      <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                      <View style={styles.divider} />
                    </View>

                    <Animated.View style={{ transform: [{ scale: googleButtonScale }] }}>
                      <TouchableOpacity
                        style={styles.googleButton}
                        onPress={handleGoogleSignIn}
                        onPressIn={() => handlePressIn(googleButtonScale)}
                        onPressOut={() => handlePressOut(googleButtonScale)}
                        activeOpacity={0.9}
                        disabled={googleLoading}
                      >
                        <View style={styles.googleIconWrapper}>
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>G</Text>
                        </View>
                        <Text style={styles.googleButtonText}>
                          {googleLoading ? 'Signing in...' : 'Sign in with Google'}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.footerRow}>
                      <Text style={styles.footerText}>
                        Don't have an account?{' '}
                      </Text>
                      <Animated.View style={{ transform: [{ scale: createAccountScale }], opacity: createAccountOpacity }}>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('Signup')}
                          onPressIn={() => handlePressIn(createAccountScale, createAccountOpacity)}
                          onPressOut={() => handlePressOut(createAccountScale, createAccountOpacity)}
                          activeOpacity={1}
                        >
                          <Text style={styles.footerLink}>Create account</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    </View>
                  </View>
                </ScrollView>
              </Animated.View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}

export default WelcomeScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 102, 0.75)', // Higher transparency to see bg
  },
  safeArea: {
    flex: 1,
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
  logoContainerWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff', // White logo circle for clarity
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  headerAccent: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ffd60a',
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -24,
    overflow: 'hidden', // Ensure scrolling clips correctly
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 40,
  },
  welcomeText: {
    fontSize: 22, // Smaller size as requested
    fontWeight: '700',
    color: '#090966', // Primary color
    marginBottom: 28,
    textAlign: 'center',
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
    backgroundColor: '#F9FAFB', // Reverted to default styling look
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
  },
  inputFocused: {
    borderColor: '#090966',
    backgroundColor: '#fff',
    // borderWidth: 1, // Removed extra heavy border width to fix "Remove default focus" complaint if related to boldness
  },
  inputIcon: {
    marginRight: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#090966',
    fontWeight: '500', // Lighter weight (was 600)
  },
  eyeIcon: {
    padding: 8,
  },
  forgotWrapper: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotText: {
    fontSize: 13,
    color: '#090966',
    fontWeight: '600',
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    height: 56,
  },
  googleIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  footerRow: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20, // Extra padding for scroll
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
