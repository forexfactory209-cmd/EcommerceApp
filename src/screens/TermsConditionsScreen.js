import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail } from 'lucide-react-native';

const TERMS_TABS = [
  { id: 'user', label: 'User Accounts' },
  { id: 'vendor', label: 'Vendor Policy' },
  { id: 'payments', label: 'Payments' },
];

const TERMS_SECTIONS = [
  {
    id: 'intro',
    number: '1',
    title: 'Introduction & Acceptance',
    body:
      'By accessing or using the Service you agree to be bound by these Terms. If you disagree with any part of the terms then you may not access the Service. These Terms apply to all visitors, users, and others who access or use the Service.',
  },
  {
    id: 'user-accounts',
    number: '2',
    title: 'User Accounts',
    body:
      'You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.',
  },
  {
    id: 'payments-billing',
    number: '3',
    title: 'Payments & Billing',
    body:
      'All purchases are processed securely through our payment partners. You agree to provide current, complete and accurate purchase and account information for all purchases made via the marketplace.',
  },
  {
    id: 'returns-refunds',
    number: '4',
    title: 'Returns & Refunds',
    body:
      'Return and refund options may vary by vendor. Please review the return policy on the product page or order details before placing an order.',
  },
];

const TermsConditionsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('user');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeRow}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Official Policy</Text>
        </View>

        <Text style={styles.lastUpdatedLabel}>Last Updated: October 24, 2023</Text>

        <Text style={styles.mainTitle}>Welcome to ShopEase</Text>
        <Text style={styles.mainSubtitle}>
          Please read these terms and conditions carefully before using our multivendor marketplace application.
          By accessing or using the service, you agree to be bound by these terms.
        </Text>

        <View style={styles.tabsRow}>
          {TERMS_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.9}
              >
                <Text style={[styles.tabChipLabel, active && styles.tabChipLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {TERMS_SECTIONS.map((section) => (
          <View key={section.id} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCircle}>
                <Text style={styles.sectionCircleText}>{section.number}</Text>
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionChevron}>▾</Text>
            </View>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionButton, styles.actionDecline]}>
            <Text style={styles.actionDeclineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionAgree]}>
            <Text style={styles.actionAgreeText}>I Agree</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.stillQuestionsTitle}>Still have questions?</Text>
        <Text style={styles.stillQuestionsSubtitle}>
          If you have any questions about these Terms, please contact us.
        </Text>

        <View style={styles.emailCard}>
          <View style={styles.emailIconCircle}>
            <Mail size={18} color="#11146E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emailTitle}>Email Support</Text>
            <Text style={styles.emailSubtitle}>legal@shopease.com</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TermsConditionsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#090966',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#090966',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  lastUpdatedLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  tabChipActive: {
    backgroundColor: '#11146E',
  },
  tabChipLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  tabChipLabelActive: {
    color: '#FFFFFF',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sectionCircleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#11146E',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  sectionChevron: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  sectionBody: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDecline: {
    marginRight: 8,
    backgroundColor: '#E5E7EB',
  },
  actionAgree: {
    marginLeft: 8,
    backgroundColor: '#11146E',
  },
  actionDeclineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  actionAgreeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stillQuestionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  stillQuestionsSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
  },
  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emailIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  emailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  emailSubtitle: {
    fontSize: 13,
    color: '#2563EB',
  },
});
