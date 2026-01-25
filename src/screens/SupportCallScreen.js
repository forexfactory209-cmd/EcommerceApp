import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const PRIMARY = '#090966';

const SupportCallScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'right', 'bottom', 'left']}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Support</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconCircleLarge}>
            <Text style={styles.iconEmoji}>🎧</Text>
          </View>

          {/* Title + subtitle */}
          <Text style={styles.title}>We&apos;re here to help</Text>
          <Text style={styles.subtitle}>
            Need urgent assistance with an order? Give our support team a call
            directly.
          </Text>

          {/* STATUS CARD */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Open Now</Text>
            </View>

            <Text style={styles.statusLabel}>CURRENT WAIT TIME</Text>
            <Text style={styles.statusWaitTime}>~2 Minutes</Text>

            <View style={styles.statusDivider} />

            <View style={styles.hoursRow}>
              <Text style={styles.hoursLabel}>Hours (EST)</Text>
              <Text style={styles.hoursValue}>Mon–Fri 9:00 – 18:00</Text>
            </View>
          </View>

          {/* Phone number */}
          <Text style={styles.phoneNumber}>+1 (800) 123-4567</Text>

          {/* Primary CTA */}
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Call Now</Text>
          </TouchableOpacity>

          {/* Secondary buttons */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity style={styles.secondaryPill}>
              <Text style={styles.secondaryPillText}>Live Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryPill, { marginLeft: 12 }]}
              onPress={() => navigation.navigate('SupportEmail')}
            >
              <Text style={styles.secondaryPillText}>Email Us</Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer */}
          <Text style={styles.disclaimerText}>
            Standard carrier rates may apply.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SupportCallScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#090966',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconCircleLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 40,
    color: PRIMARY,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 18,
  },

  // STATUS CARD
  statusCard: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap:16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  statusLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 2,
  },
  statusWaitTime: {
    fontSize: 11,
    color: '#4B5563',
    marginBottom: 10,
  },
  statusDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 10,
    marginTop: 2,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hoursLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  hoursValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },

  phoneNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  secondaryPill: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  secondaryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
});