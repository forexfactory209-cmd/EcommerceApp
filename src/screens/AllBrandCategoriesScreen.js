import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

const BRAND_AUDIENCE_CATEGORIES = [
  { id: 'men', label: 'Men' },
  { id: 'women', label: 'Women' },
  { id: 'kids', label: 'Kids' },
  { id: 'cosmetics_beauty', label: 'Cosmetics & Beauty' },
];

const AllBrandCategoriesScreen = ({ navigation, route }) => {
  const brands = route?.params?.brands || [];

  const categories = useMemo(() => {
    const counts = {
      men: 0,
      women: 0,
      kids: 0,
      cosmetics_beauty: 0,
    };

    const firstLogos = {
      men: null,
      women: null,
      kids: null,
      cosmetics_beauty: null,
    };

    brands.forEach((b) => {
      const explicit = (b.audience || b.category || '').toString().toLowerCase();
      const name = (b.name || '').toLowerCase();

      const isMen =
        explicit === 'men' ||
        name.includes("men's") ||
        name.includes('men ') ||
        name.includes('male');

      const isWomen =
        explicit === 'women' ||
        name.includes("women's") ||
        name.includes('women ') ||
        name.includes('female') ||
        name.includes('lady');

      const isKids =
        explicit === 'kids' ||
        name.includes('kid') ||
        name.includes('child') ||
        name.includes('children') ||
        name.includes('boys') ||
        name.includes('girls');

      const isCosmetics =
        explicit === 'cosmetics_beauty' ||
        explicit === 'cosmetics' ||
        explicit === 'beauty' ||
        name.includes('cosmetic') ||
        name.includes('makeup') ||
        name.includes('beauty') ||
        name.includes('skincare');

      if (isMen) {
        counts.men += 1;
        if (!firstLogos.men && b.logo_url) firstLogos.men = b.logo_url;
      }
      if (isWomen) {
        counts.women += 1;
        if (!firstLogos.women && b.logo_url) firstLogos.women = b.logo_url;
      }
      if (isKids) {
        counts.kids += 1;
        if (!firstLogos.kids && b.logo_url) firstLogos.kids = b.logo_url;
      }
      if (isCosmetics) {
        counts.cosmetics_beauty += 1;
        if (!firstLogos.cosmetics_beauty && b.logo_url)
          firstLogos.cosmetics_beauty = b.logo_url;
      }
    });

    return BRAND_AUDIENCE_CATEGORIES.map((cat) => ({
      ...cat,
      count: counts[cat.id] || 0,
      image: firstLogos[cat.id],
    }));
  }, [brands]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      activeOpacity={0.9}
      onPress={() =>
        navigation.navigate('AllBrands', {
          initialAudience: item.id,
        })
      }
    >
      <View style={styles.categoryImageWrapper}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.categoryImage} resizeMode="cover" />
        ) : (
          <View style={styles.categoryPlaceholder} />
        )}
      </View>
      <View style={styles.categoryOverlay}>
        <Text style={styles.categoryName}>{item.label}</Text>
        <Text style={styles.categoryCount}>{item.count} Brands</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#090966" size={20} />
        </TouchableOpacity>
        <Text style={styles.title}>Brand Categories</Text>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
};

export default AllBrandCategoriesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5FF',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0E7FF',
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#090966',
    marginLeft: 16,
  },
  listContent: {
    paddingTop: 24,
    gap:7,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  categoryCard: {
    flex: 1,
    maxWidth: '48%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  categoryImageWrapper: {
    height: 190,
    width: '100%',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryPlaceholder: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  categoryOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  categoryCount: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});
