import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, MessageCircle } from 'lucide-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HelpFAQScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const categories = [
    { id: 'All', label: 'All' },
    { id: 'Orders', label: 'Orders' },
    { id: 'Shipping', label: 'Shipping' },
    { id: 'Returns', label: 'Returns' },
  ];

  const allFaqs = [
    {
      id: 'track-order',
      category: 'Orders',
      question: 'How do I track my order?',
      answer:
        'You can track your order from the My Orders section in your profile. Tap on an order to see its live tracking and latest status updates.',
    },
    {
      id: 'return-policy',
      category: 'Returns',
      question: 'What is the return policy for different vendors?',
      answer:
        'Each vendor may have a slightly different return policy. You can see the return policy on the product page or inside the order details screen.',
    },
    {
      id: 'change-address',
      category: 'Shipping',
      question: 'Can I change my shipping address?',
      answer:
        'If your order has not yet been shipped, you can request an address change from the order details screen or by contacting support.',
    },
    {
      id: 'contact-seller',
      category: 'Orders',
      question: 'How do I contact a seller?',
      answer:
        'Open the product or order details and use the Contact Seller option to send a message directly to the vendor.',
    },
    {
      id: 'payment-methods',
      category: 'Orders',
      question: 'What payment methods are accepted?',
      answer:
        'We support major debit/credit cards and additional local payment options depending on your region. All methods are shown at checkout.',
    },
  ];

  const filteredFaqs = useMemo(() => {
    let list = allFaqs;

    if (activeCategory !== 'All') {
      list = list.filter((f) => f.category === activeCategory);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q),
      );
    }

    return list;
  }, [allFaqs, activeCategory, query]);

  const toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        <Text style={styles.headerTitle}>Help & FAQ</Text>
      </View>

      <View style={styles.searchWrapper}>
        <Search size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for answers..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.categoriesRow}>
        {categories.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat.id)}
              activeOpacity={0.9}
            >
              <Text
                style={[
                  styles.categoryChipLabel,
                  active && styles.categoryChipLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>Top Questions</Text>

        {filteredFaqs.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <View key={item.id} style={styles.faqCard}>
              <TouchableOpacity
                style={styles.faqHeader}
                activeOpacity={0.8}
                onPress={() => toggleExpand(item.id)}
              >
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Text style={styles.faqChevron}>{expanded ? '−' : '+'}</Text>
              </TouchableOpacity>
              {expanded && (
                <View style={styles.faqBody}>
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.helpCard}>
          <View style={styles.helpIconCircle}>
            <MessageCircle size={22} color="#11146E" />
          </View>
          <Text style={styles.helpTitle}>Still need help?</Text>
          <Text style={styles.helpSubtitle}>
            If you couldn\'t find the answer you were looking for, our support team is here.
          </Text>
          <TouchableOpacity
            style={styles.helpButton}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('ContactSupport')}
          >
            <Text style={styles.helpButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HelpFAQScreen;

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
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  categoriesRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#11146E',
  },
  categoryChipLabel: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  categoryChipLabelActive: {
    color: '#FFFFFF',
  },
  content: {
    paddingBottom: 24,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  faqChevron: {
    fontSize: 18,
    color: '#9CA3AF',
  },
  faqBody: {
    marginTop: 6,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#4B5563',
  },
  helpCard: {
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  helpIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  helpSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  helpButton: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#11146E',
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
