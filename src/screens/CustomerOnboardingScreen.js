import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, ImageBackground, Easing, Dimensions, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import OnboardingBgDefault from '../../assets/onboarding/bg_main.png';
import OnboardingBgSeller from '../../assets/onboarding/bg_seller.png';
import OnboardingBgTrust from '../../assets/onboarding/bg_trust.png';
import BeegsoButton from '../components/BeegsoButton';

const { width, height } = Dimensions.get('window');
const SLIDES = [
  {
    id: 1,
    headlineParts: [
      { text: 'Shop ', highlight: false },
      { text: 'Smarter', highlight: true },
      { text: ' Locally', highlight: false },
    ],
    subtext: 'Find trusted local products\nnear you—fresh, authentic,\nand delivered fast.',
    bg: OnboardingBgDefault,
  },
  {
    id: 2,
    headlineParts: [
      { text: 'Fast & ', highlight: false },
      { text: 'Reliable', highlight: true },
      { text: ' Delivery', highlight: false },
    ],
    subtext: 'Get what you need, when you need it.\nLightning-fast delivery from local sellers\nyou can trust.',
    bg: OnboardingBgSeller,
  },
  {
    id: 3,
    headlineParts: [
      { text: 'Grow Your ', highlight: false },
      { text: 'Business', highlight: true },
    ],
    subtext: 'Turn your passion into profit.\nReach more local customers and build\nyour brand with powerful tools.',
    bg: OnboardingBgTrust,
  },
];
const CustomerOnboardingScreen = ({ navigation }) => {
  const [index, setIndex] = React.useState(0);
  const setHasSeenCustomerOnboarding = useStore((state) => state.setHasSeenCustomerOnboarding);

  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Animated Background Shapes (Ported from WelcomeScreen)
  const circle1Anim = React.useRef(new Animated.Value(0)).current;
  const circle2Anim = React.useRef(new Animated.Value(0)).current;
  const rectAnim = React.useRef(new Animated.Value(0)).current;

  // Page Transition Animations
  const contentFade = React.useRef(new Animated.Value(1)).current;
  const contentSlide = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Logo Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Background shapes loop
    const createLoop = (anim, duration) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
    };

    createLoop(circle1Anim, 4000).start();
    createLoop(circle2Anim, 6000).start();
    createLoop(rectAnim, 8000).start();
  }, []);

  // Interpolations for shapes
  const circle1TranslateY = circle1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const circle2TranslateX = circle2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const rectRotate = rectAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  const handleSkip = () => {
    setHasSeenCustomerOnboarding(true);
    navigation.replace('Welcome');
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) {
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 0, duration: 250, useNativeDriver: false }),
        Animated.timing(contentSlide, { toValue: -40, duration: 250, useNativeDriver: false }),
      ]).start(() => {
        setIndex((prev) => prev + 1);
        contentSlide.setValue(40);
        Animated.parallel([
          Animated.timing(contentFade, { toValue: 1, duration: 350, useNativeDriver: false }),
          Animated.spring(contentSlide, { toValue: 0, friction: 8, tension: 40, useNativeDriver: false }),
        ]).start();
      });
    } else {
      handleSkip();
    }
  };

  const currentSlide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;



  return (
    <View style={styles.container}>
      <ImageBackground source={currentSlide.bg} style={styles.bgImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>

            {/* Animated Shapes */}
            <Animated.View style={[styles.bgCircle1, { transform: [{ translateY: circle1TranslateY }] }]} />
            <Animated.View style={[styles.bgCircle2, { transform: [{ translateX: circle2TranslateX }] }]} />
            <Animated.View style={[styles.bgRect, { transform: [{ rotate: rectRotate }] }]} />

            <Animated.View style={[styles.content, { opacity: contentFade, transform: [{ translateX: contentSlide }] }]}>
              {/* Top Logo Section */}
              <View style={styles.logoHeader}>
                <Animated.View style={[styles.logoPlaceholder, { transform: [{ scale: pulseAnim }] }]}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>B</Text>
                  </View>
                </Animated.View>
              </View>

              <View style={styles.spacer} />

              <View style={styles.textArea}>
                <Text style={styles.headline} numberOfLines={1} ellipsizeMode="clip">
                  {currentSlide.headlineParts.map((part, idx) => (
                    <Text key={String(idx)} style={part.highlight ? styles.headlineHighlight : undefined}>
                      {part.text}
                    </Text>
                  ))}
                </Text>
                <Text style={styles.subtext} numberOfLines={3}>
                  {currentSlide.subtext}
                </Text>
              </View>

              <View style={styles.controlsArea}>
                <View style={styles.paginationRow}>
                  {SLIDES.map((slide, i) => (
                    <View
                      key={slide.id}
                      style={[styles.dot, i === index && styles.dotActive]}
                    />
                  ))}
                </View>

                <BeegsoButton
                  label={isLast ? 'Get Started' : 'Next Step'}
                  onPress={handleNext}
                  icon={ChevronRight}
                  backgroundColor="#FFFFFF"
                  contentColor="#090966"
                  rippleColor="rgba(9, 9, 102, 0.12)"
                />
              </View>
            </Animated.View>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
};

export default CustomerOnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 102, 0.75)', // Primary color overlay with transparency
  },
  safeArea: {
    flex: 1,
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
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  logoHeader: {
    alignItems: 'center',
    marginTop: 10,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#090966',
  },
  spacer: {
    flex: 2,
  },
  textArea: {
    flex: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  headline: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 16,
  },
  headlineHighlight: {
    color: '#ffd60a',
  },
  subtext: {
    fontSize: 16,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '400',
  },
  controlsArea: {
    alignItems: 'center',
    marginTop: 20,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 5,
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 28,
  },
});
