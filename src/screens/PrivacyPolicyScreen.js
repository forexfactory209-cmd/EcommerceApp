import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

const PRIVACY_TABS = [
  { id: 'general', label: 'General' },
  { id: 'collection', label: 'Collection' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'security', label: 'Security' },
];

const PRIVACY_SECTIONS = [
  {
    id: 'info-we-collect',
    icon: '🧾',
    title: '1. Information We Collect',
    lines: [
      'We collect personal details to facilitate your experience, including:',
      '• Identity Data: Name, username, or similar identifier.',
      '• Contact Data: Billing address, delivery address, email address, and telephone numbers.',
      '• Transaction Data: Details about payments to and from you and other details of products you have purchased from our vendors.',
    ],
  },
  {
    id: 'sharing-with-vendors',
    icon: '🤝',
    title: '2. Sharing with Vendors',
    lines: [
      'To fulfill your orders, we share limited personal data with independent vendors such as:',
      '• Your contact and delivery details.',
      '• Order information and product details.',
      'Vendors are required to use this data only for fulfilling your order and complying with applicable laws.',
    ],
  },
  {
    id: 'data-security',
    icon: '🔒',
    title: '3. Data Security',
    lines: [
      'We apply technical and organizational measures to protect your information from unauthorized access, loss, or misuse.',
      'However, no online service is completely secure, so we cannot guarantee absolute security.',
    ],
  },
  {
    id: 'your-rights',
    icon: '📄',
    title: '4. Your Rights',
    lines: [
      'Depending on your region, you may have rights to access, correct, or delete your data.',
      'You can also object to certain processing or request a copy of your data. Contact support if you wish to exercise these rights.',
    ],
  },
];

const PrivacyPolicyScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [expandedId, setExpandedId] = useState('info-we-collect');

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color="#111827" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdatedLabel}>LAST UPDATED: OCTOBER 24, 2023</Text>
        <Text style={styles.mainTitle}>Your Privacy Matters</Text>
        <Text style={styles.mainSubtitle}>
          This policy outlines how we collect, use, and protect your data across our multivendor marketplace.
          Because you buy directly from independent sellers, some of your data is shared to fulfill orders.
        </Text>

        <View style={styles.tabsRow}>
          {PRIVACY_TABS.map((tab) => {
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

        {PRIVACY_SECTIONS.map((section) => {
          const expanded = expandedId === section.id;
          return (
            <View key={section.id} style={styles.sectionCard}>
              <TouchableOpacity
                style={styles.sectionHeader}
                activeOpacity={0.8}
                onPress={() => toggleExpand(section.id)}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionIconCircle}>
                    <Text style={styles.sectionIconText}>{section.icon}</Text>
                  </View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Text style={styles.sectionChevron}>{expanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>
              {expanded && (
                <View style={styles.sectionBody}>
                  {section.lines.map((line, idx) => (
                    <Text key={idx} style={styles.sectionLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Have questions about your data?</Text>
          <Text style={styles.helpSubtitle}>
            Our Data Protection Officer is available to answer any concerns regarding your privacy.
          </Text>
          <TouchableOpacity
            style={styles.helpButton}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('ReportProblem')}
          >
            <Text style={styles.helpButtonText}>Contact Support Team</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          By using this app, you acknowledge that you have read and understood this Privacy Policy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PrivacyPolicyScreen;

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
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#11146E',
  },
  content: {
    paddingBottom: 24,
  },
  lastUpdatedLabel: {
    fontSize: 11,
    fontWeight: '600',
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
    paddingHorizontal: 14,
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
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionIconText: {
    fontSize: 16,
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
    marginTop: 6,
  },
  sectionLine: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 2,
  },
  helpCard: {
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: '#11146E',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  helpSubtitle: {
    fontSize: 13,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  helpButton: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  helpButtonText: {
    color: '#11146E',
    fontSize: 14,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 16,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
