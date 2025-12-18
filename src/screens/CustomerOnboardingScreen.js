import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import BuyerImg from '../../assets/onboarding/buyer.jpg';
import SellerImg from '../../assets/onboarding/seller.jpg';
import TrustImg from '../../assets/onboarding/trust.jpg';

const SLIDES = [
  {
    id: 1,
    type: 'buyer',
    headline: 'Shop from trusted local sellers',
    subtext: 'Discover products from verified vendors near you.',
  },
  {
    id: 2,
    type: 'seller',
    headline: 'Sell your products easily',
    subtext: 'List items, manage orders, and grow your business.',
  },
  {
    id: 3,
    type: 'trust',
    headline: 'Safe payments & reliable delivery',
    subtext: 'Secure checkout, order tracking, and customer support.',
  },
];
const CustomerOnboardingScreen = ({ navigation }) => {
  const [index, setIndex] = useState(0);
  const setHasSeenCustomerOnboarding = useStore((state) => state.setHasSeenCustomerOnboarding);

  const handleSkip = () => {
    setHasSeenCustomerOnboarding(true);
    navigation.replace('Welcome');
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) {
      setIndex((prev) => prev + 1);
    } else {
      handleSkip();
    }
  };

  const currentSlide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.illustrationArea}>
          <View style={styles.illustrationCard}>
            {currentSlide.type === 'buyer' && (
              <Image source={BuyerImg} style={styles.illustrationImage} resizeMode="contain" />
            )}

            {currentSlide.type === 'seller' && (
              <Image source={SellerImg} style={styles.illustrationImage} resizeMode="contain" />
            )}

            {currentSlide.type === 'trust' && (
              <Image source={TrustImg} style={styles.illustrationImage} resizeMode="contain" />
            )}
          </View>
        </View>

        <View style={styles.textArea}>
          <Text style={styles.headline}>{currentSlide.headline}</Text>
          <Text style={styles.subtext}>{currentSlide.subtext}</Text>
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

          <TouchableOpacity
            style={[styles.nextButton, isLast && styles.getStartedButton]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>{isLast ? 'Get Started' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CustomerOnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  illustrationArea: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCard: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  floatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  productCard: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    marginRight: 8,
  },
  productCardSecondary: {
    opacity: 0.6,
  },
  vendorRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  vendorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A7F3D0',
    marginHorizontal: 4,
  },
  uploadPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#059669',
  },
  uploadPillText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallIconCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    marginLeft: 8,
  },
  dashboardRow: {
    width: '100%',
    marginTop: 16,
  },
  dashboardBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#BBF7D0',
    marginBottom: 6,
  },
  dashboardBarShort: {
    width: '60%',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginTop: 12,
  },
  trustIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  controlsArea: {
    alignItems: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#059669',
    width: 16,
  },
  nextButton: {
    backgroundColor: '#000000',
    width: '100%',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  getStartedButton: {
    paddingHorizontal: 28,
  },
});
