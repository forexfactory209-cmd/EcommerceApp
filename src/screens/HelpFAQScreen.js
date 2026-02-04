import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, LayoutAnimation, Platform, UIManager, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Search, MessageCircle, Package, Truck, RotateCcw, CreditCard, ShieldCheck, ChevronDown, HelpCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HelpFAQScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const CategoryIcon = ({ id, color }) => {
    if (id === 'Orders') return <Package size={16} color={color} />;
    if (id === 'Shipping') return <Truck size={16} color={color} />;
    if (id === 'Returns') return <RotateCcw size={16} color={color} />;
    if (id === 'Payments') return <CreditCard size={16} color={color} />;
    return <HelpCircle size={16} color={color} />;
  };

  const FaqIcon = ({ category, color }) => {
    if (category === 'Orders') return <Package size={18} color={color} />;
    if (category === 'Shipping') return <Truck size={18} color={color} />;
    if (category === 'Returns') return <RotateCcw size={18} color={color} />;
    if (category === 'Payments') return <CreditCard size={18} color={color} />;
    if (category === 'Security') return <ShieldCheck size={18} color={color} />;
    return <HelpCircle size={18} color={color} />;
  };

  const AccordionItem = ({ item, expanded, onToggle }) => {
    const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(rotateAnim, {
        toValue: expanded ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }, [expanded, rotateAnim]);

    const rotate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    return (
      <View style={styles.faqCard}>
        <TouchableOpacity style={styles.faqHeader} activeOpacity={0.85} onPress={onToggle}>
          <View style={styles.faqHeaderLeft}>
            <View style={styles.faqIconCircle}>
              <FaqIcon category={item.category} color="#090966" />
            </View>
            <View style={styles.faqHeaderTextCol}>
              <Text style={styles.faqQuestion} numberOfLines={2}>
                {item.question}
              </Text>
              <Text style={styles.faqMeta} numberOfLines={1}>
                {item.category}
              </Text>
            </View>
          </View>

          <Animated.View style={{ transform: [{ rotate }] }}>
            <ChevronDown size={20} color="#9CA3AF" />
          </Animated.View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.faqBody}>
            <Text style={styles.faqAnswer}>{item.answer}</Text>
          </View>
        )}
      </View>
    );
  };

  const categories = [
    { id: 'All', label: 'All' },
    { id: 'Orders', label: 'Orders' },
    { id: 'Shipping', label: 'Shipping' },
    { id: 'Returns', label: 'Returns' },
    { id: 'Payments', label: 'Payments' },
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
      id: 'order-edit',
      category: 'Orders',
      question: 'Can I change or cancel my order after placing it?',
      answer:
        'If your order has not been confirmed or dispatched yet, you can request changes from the order details screen or contact support for quick help.',
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
      category: 'Payments',
      question: 'What payment methods are accepted?',
      answer:
        'We support major debit/credit cards and additional local payment options depending on your region. All methods are shown at checkout.',
    },
    {
      id: 'delivery-time',
      category: 'Shipping',
      question: 'How long does delivery take?',
      answer:
        'Delivery time depends on your city and the seller. You will see an estimated delivery time during checkout and inside your order details.',
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
      <LinearGradient
        colors={['#090966', '#11146E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft color="#FFFFFF" size={20} />
          </TouchableOpacity>
          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Help Center</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Quick answers, fast support
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.searchWrapper}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions, delivery, payments..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            const iconColor = active ? '#ffffff' : '#090966';
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.9}
              >
                <CategoryIcon id={cat.id} color={iconColor} />
                <Text
                  style={[
                    styles.categoryChipLabel,
                    active && styles.categoryChipLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Frequently asked</Text>
          <Text style={styles.sectionCount}>
            {filteredFaqs.length} result{filteredFaqs.length === 1 ? '' : 's'}
          </Text>
        </View>

        {filteredFaqs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Search size={22} color="#090966" />
            </View>
            <Text style={styles.emptyTitle}>No matches found</Text>
            <Text style={styles.emptySubtitle}>
              Try another keyword or choose a different category.
            </Text>
            <TouchableOpacity
              style={styles.emptyResetButton}
              activeOpacity={0.9}
              onPress={() => {
                setQuery('');
                setActiveCategory('All');
              }}
            >
              <Text style={styles.emptyResetButtonText}>Reset search</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredFaqs.map((item) => (
            <AccordionItem
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => toggleExpand(item.id)}
            />
          ))
        )}

        <View style={styles.helpCard}>
          <View style={styles.helpIconCircle}>
            <MessageCircle size={22} color="#11146E" />
          </View>
          <Text style={styles.helpTitle}>Need more help?</Text>
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
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  categoriesRow: {
    paddingTop: 12,
    paddingBottom: 2,
    paddingRight: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  categoryChipLabel: {
    fontSize: 13,
    color: '#090966',
    fontWeight: '700',
    marginLeft: 8,
  },
  categoryChipLabelActive: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  faqIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(9,9,102,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  faqHeaderTextCol: {
    flex: 1,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  faqMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  faqBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  faqAnswer: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(9,9,102,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyResetButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#090966',
  },
  emptyResetButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
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
