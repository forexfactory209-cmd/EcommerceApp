import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';

const SLIDES = [
  {
    id: 1,
    title: 'Find clothes easily from top stores',
    image: require('../../assets/photo3.jpg'),
  },
  {
    id: 2,
    title: 'Search by picture or product code',
    image: require('../../assets/photo2.jpg'),
  },
  {
    id: 3,
    title: 'Fast delivery anywhere in the city',
    image: require('../../assets/photo4.jpg'),
  },
  {
    id: 4,
    title: 'Shop from verified local stores',
    image: require('../../assets/photo1.jpg'),
  },
];
const CustomerOnboardingScreen = ({ navigation }) => {
  const [index, setIndex] = useState(0);
  const setHasSeenCustomerOnboarding = useStore((state) => state.setHasSeenCustomerOnboarding);

  const handleSkip = () => {
    setHasSeenCustomerOnboarding(true);
    navigation.replace('Main');
  };

  const handleNext = () => {
    if (index < SLIDES.length - 1) {
      setIndex((prev) => prev + 1);
    } else {
      handleSkip();
    }
  };

  const currentSlide = SLIDES[index];

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground
        source={currentSlide.image}
        resizeMode="cover"
        style={styles.background}
      >
        <View style={styles.overlay} />

        <View style={styles.content}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.slideArea}>
            <Text style={styles.title}>{currentSlide.title}</Text>
          </View>

          <View style={styles.bottomArea}>
            <View style={styles.paginationRow}>
              {SLIDES.map((slide, i) => (
                <View
                  key={slide.id}
                  style={[styles.dot, i === index && styles.dotActive]}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

export default CustomerOnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  topRow: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  skipText: {
    fontSize: 14,
    color: '#E5E7EB',
    fontWeight: '600',
  },
  slideArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bottomArea: {
    paddingBottom: 8,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#2563EB',
    width: 16,
  },
  nextButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
