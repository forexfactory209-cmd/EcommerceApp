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

const ContactSupportScreen = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'right', 'bottom', 'left']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Support</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Icon */}
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🔔</Text>
          </View>
        </View>

        {/* Title + subtitle */}
        <Text style={styles.title}>How can we help?</Text>
        <Text style={styles.subtitle}>
          Our team is available 24/7 to assist with your inquiries.
        </Text>

        {/* Contact options label */}
        <Text style={styles.sectionLabel}>CONTACT OPTIONS</Text>

        {/* Options card */}
        <View style={styles.optionsBlock}>
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('SupportEmail')}
          >
            <View style={styles.optionIconCircle}>
              <Text style={styles.optionIconEmoji}>✉️</Text>
            </View>
            <View style={styles.optionTextBlock}>
              <Text style={styles.optionTitle}>Email Us</Text>
              <Text style={styles.optionSubtitle}>
                Response within 24 hours
              </Text>
            </View>
            <Text style={styles.optionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionRow, { marginTop: 12 }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('SupportCall')}
          >
            <View style={styles.optionIconCircle}>
              <Text style={styles.optionIconEmoji}>📞</Text>
            </View>
            <View style={styles.optionTextBlock}>
              <Text style={styles.optionTitle}>Call Us</Text>
              <Text style={styles.optionSubtitle}>
                Mon–Fri, 9am – 5pm EST
              </Text>
            </View>
            <Text style={styles.optionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Footer link */}
        <View style={styles.footerBlock}>
          <Text style={styles.footerHint}>Prefer to solve it yourself?</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('HelpFAQ')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.footerLink}>Visit our Help Center ↗</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ContactSupportScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4FF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  backIcon: {
    fontSize: 18,
    color: '#111827',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  iconEmoji: {
    fontSize: 36,
    color: PRIMARY,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 10,
  },
  optionsBlock: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F9FAFF',
  },
  optionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconEmoji: {
    fontSize: 18,
    color: PRIMARY,
  },
  optionTextBlock: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  optionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  optionChevron: {
    fontSize: 18,
    color: '#D1D5DB',
  },
  footerBlock: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
});