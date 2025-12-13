import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Star } from 'lucide-react-native';
import { useStore } from '../store/store';
import { fetchProductsFromSupabase } from '../services/products';
import { fetchManyProductRatingSummaries } from '../services/ratings';
import { supabase } from '../lib/supabase';

const BrandScreen = ({ route, navigation }) => {
  const { brandId, brand: routeBrand } = route.params || {};
  const products = useStore((state) => state.products);
  const followedBrandIds = useStore((state) => state.followedBrandIds || []);
  const toggleFollowBrand = useStore((state) => state.toggleFollowBrand);
  const [remoteProducts, setRemoteProducts] = useState([]);
  const [ratingStats, setRatingStats] = useState({});
  const [fetchedBrand, setFetchedBrand] = useState(null);
  const [brandRatingAvg, setBrandRatingAvg] = useState(null);
  const [brandRatingCount, setBrandRatingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        const data = await fetchProductsFromSupabase();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setRemoteProducts(data);
        }
      } catch (e) {
        Alert.alert('Supabase error', e.message || 'Failed to load products from Supabase');
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const brand = fetchedBrand || routeBrand || null;
  const baseData = remoteProducts.length > 0 ? remoteProducts : products;
  const brandUserId = brand?.user_id || null;
  const brandName = (brand?.name || '').toString();
  const brandDiscount =
    typeof brand?.discount_percentage === 'number' && !Number.isNaN(brand.discount_percentage)
      ? brand.discount_percentage
      : null;

  useEffect(() => {
    let isMounted = true;

    const loadBrand = async () => {
      try {
        // If we already have full brand with contact info, skip fetch
        if (routeBrand?.contact_email || routeBrand?.contact_phone || routeBrand?.description) {
          return;
        }

        // If we have no identifiers and no name, we can't fetch anything
        if (!brandId && !routeBrand?.user_id && !routeBrand?.name) return;

        // Prefer id, then user_id, then fallback to name
        let column = 'id';
        let value = brandId;

        if (!value && routeBrand?.user_id) {
          column = 'user_id';
          value = routeBrand.user_id;
        } else if (!value && !routeBrand?.user_id && routeBrand?.name) {
          column = 'name';
          value = routeBrand.name;
        }

        const { data, error } = await supabase
          .from('brands')
          .select('*')
          .eq(column, value)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.warn('Error loading brand profile:', error.message || error);
          return;
        }

        if (data) {
          setFetchedBrand(data);
        }
      } catch (e) {
        if (!isMounted) return;
        console.warn('Error loading brand profile:', e.message || e);
      }
    };

    loadBrand();

    return () => {
      isMounted = false;
    };
  }, [brandId, routeBrand]);

  const brandProducts = baseData.filter((p) => {
    const hasBrandUser = !!brandUserId;

    if (hasBrandUser) {
      return p.brand_user_id && p.brand_user_id === brandUserId;
    }

    return (p.brand || '') === brandName;
  });

  useEffect(() => {
    const loadRatingStats = async () => {
      try {
        const ids = baseData
          .filter((p) => {
            const hasBrandUser = !!brandUserId;

            if (hasBrandUser) {
              return p.brand_user_id && p.brand_user_id === brandUserId;
            }

            return (p.brand || '') === brandName;
          })
          .map((p) => p.id)
          .filter(Boolean);
        if (ids.length === 0) {
          setRatingStats({});
          return;
        }

        const result = await fetchManyProductRatingSummaries(ids);
        setRatingStats(result || {});
      } catch (e) {
        console.warn('Failed to load brand rating stats', e.message || e);
      }
    };

    loadRatingStats();
  }, [baseData, brandUserId, brandName]);

  useEffect(() => {
    const computeAndPersistBrandRating = async () => {
      const entries = Object.values(ratingStats || {});
      if (!entries.length) {
        setBrandRatingAvg(null);
        setBrandRatingCount(0);
        return;
      }

      let totalWeighted = 0;
      let totalCount = 0;

      entries.forEach((stats) => {
        const avg = typeof stats?.avg === 'number' ? stats.avg : null;
        const count = typeof stats?.count === 'number' ? stats.count : 0;
        if (!avg || count <= 0) return;
        totalWeighted += avg * count;
        totalCount += count;
      });

      if (totalCount <= 0) {
        setBrandRatingAvg(null);
        setBrandRatingCount(0);
        return;
      }

      const avgValue = totalWeighted / totalCount;
      setBrandRatingAvg(avgValue);
      setBrandRatingCount(totalCount);

      const effectiveId = (brand && (brand.id || brandId)) || null;
      if (!effectiveId) return;

      try {
        await supabase
          .from('brands')
          .update({ rating_average: avgValue, rating_count: totalCount })
          .eq('id', effectiveId);
      } catch (e) {
        console.warn('Failed to persist brand rating stats', e.message || e);
      }
    };

    computeAndPersistBrandRating();
  }, [ratingStats, brand, brandId]);

  const renderItem = ({ item }) => {
    const stats = ratingStats[item.id];
    const rating = stats?.avg ?? 0;
    const ratingCount = stats?.count ?? 0;

    const currentPrice = Number(item.price) || 0;
    const flashPrice =
      item.flash_price != null && item.flash_price !== ''
        ? Number(item.flash_price)
        : null;

    let isFlashActive = false;
    if (flashPrice != null && !Number.isNaN(flashPrice) && flashPrice > 0) {
      try {
        const now = new Date();
        const start = item.flash_start_at ? new Date(item.flash_start_at) : null;
        const end = item.flash_end_at ? new Date(item.flash_end_at) : null;
        const hasQty = item.flash_quantity != null;
        const sold = Number(item.flash_sold) || 0;
        const qtyOk = !hasQty || sold < item.flash_quantity;

        if (start && end && qtyOk && start <= now && end > now) {
          isFlashActive = true;
        }
      } catch (e) {
        // ignore date parse errors
      }
    }

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetails', { product: item })}
      >
        <View style={styles.productImageWrapper}>
          <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
          {isFlashActive && (
            <View style={styles.flashBadge}>
              <Text style={styles.flashBadgeText}>Flash Sale</Text>
            </View>
          )}
        </View>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.productFooterRow}>
          <View style={styles.productRatingRow}>
            <Star
              size={14}
              color={rating ? '#FBBF24' : '#D1D5DB'}
              fill={rating ? '#FBBF24' : 'transparent'}
            />
            <Text style={styles.productRatingText}>
              {rating ? rating.toFixed(1) : '0.0'}
              {ratingCount > 0 ? ` (${ratingCount})` : ''}
            </Text>
          </View>
          {(() => {
            if (isFlashActive && flashPrice != null && flashPrice > 0) {
              const original = currentPrice > 0 ? currentPrice : flashPrice;
              return (
                <View style={styles.productPriceCol}>
                  <Text style={styles.productPriceOriginal}>${original.toFixed(2)}</Text>
                  <Text style={styles.productPriceDiscount}>${flashPrice.toFixed(2)}</Text>
                </View>
              );
            }

            const discount = brandDiscount;

            if (!discount || currentPrice <= 0) {
              return <Text style={styles.productPrice}>${currentPrice.toFixed(2)}</Text>;
            }

            const factor = 1 - discount / 100;
            if (factor <= 0) {
              return <Text style={styles.productPrice}>${currentPrice.toFixed(2)}</Text>;
            }

            const originalPrice = Number((currentPrice / factor).toFixed(2));

            return (
              <View style={styles.productPriceCol}>
                <Text style={styles.productPriceOriginal}>${originalPrice.toFixed(2)}</Text>
                <Text style={styles.productPriceDiscount}>${currentPrice.toFixed(2)}</Text>
              </View>
            );
          })()}
        </View>
      </TouchableOpacity>
    );
  };

  const effectiveBrandId = (brand && (brand.id || brandId)) || null;
  const isFollowed = effectiveBrandId
    ? followedBrandIds.includes(effectiveBrandId)
    : false;

  useEffect(() => {
    let isMounted = true;

    const loadFollowersCount = async () => {
      if (!effectiveBrandId) {
        if (isMounted) setFollowersCount(0);
        return;
      }

      try {
        const { count, error } = await supabase
          .from('brand_follows')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', effectiveBrandId);

        if (!isMounted) return;

        if (error) {
          console.warn('Failed to load followers count', error.message || error);
          return;
        }

        const resolvedCount = typeof count === 'number' ? count : 0;
        setFollowersCount(resolvedCount);

        try {
          await supabase
            .from('brands')
            .update({ followers_count: resolvedCount })
            .eq('id', effectiveBrandId);
        } catch (e) {
          console.warn('Failed to persist followers count', e.message || e);
        }
      } catch (e) {
        if (!isMounted) return;
        console.warn('Failed to load followers count', e.message || e);
      }
    };

    loadFollowersCount();

    return () => {
      isMounted = false;
    };
  }, [effectiveBrandId]);

  return (
    <SafeAreaView style={styles.container}>
      {brand?.banner_url ? (
        <View style={styles.bannerWrapper}>
          <Image
            source={{ uri: brand.banner_url }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={22} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>{brand?.name || 'Brand'}</Text>
          <Text style={styles.headerSubtitle}>Products from this brand</Text>
        </View>
        {effectiveBrandId && (
          <TouchableOpacity
            style={[styles.followButton, isFollowed && styles.followButtonActive]}
            onPress={() => toggleFollowBrand(effectiveBrandId)}
          >
            <Text style={[styles.followButtonText, isFollowed && styles.followButtonTextActive]}>
              {isFollowed ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.brandInfo}>
        <View style={styles.brandIconWrapper}>
          {brand?.logo_url ? (
            <Image source={{ uri: brand.logo_url }} style={styles.brandLogo} resizeMode="contain" />
          ) : (
            <Text style={styles.brandIconText}>
              {(brand?.name || '?').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.brandTextWrapper}>
          <Text style={styles.brandName}>{brand?.name || 'Unknown brand'}</Text>
          <View style={styles.brandStatsRow}>
            <View style={styles.brandStatsItem}>
              <View style={styles.brandStatsRatingRow}>
                <Star
                  size={16}
                  color={brandRatingAvg ? '#F59E0B' : '#D1D5DB'}
                  fill={brandRatingAvg ? '#F59E0B' : 'transparent'}
                />
                <Text style={styles.brandStatsPrimaryText}>
                  {brandRatingAvg ? brandRatingAvg.toFixed(1) : '0.0'}
                </Text>
              </View>
              <Text style={styles.brandStatsSecondaryText}>
                {brandRatingCount > 0 ? `${brandRatingCount} reviews` : 'No reviews yet'}
              </Text>
            </View>
            <View style={styles.brandStatsItem}>
              <Text style={styles.brandStatsPrimaryText}>{followersCount}</Text>
              <Text style={styles.brandStatsSecondaryText}>Followers</Text>
            </View>
            <View style={styles.brandStatsItem}>
              <Text style={styles.brandStatsPrimaryText}>{brandProducts.length}</Text>
              <Text style={styles.brandStatsSecondaryText}>Products</Text>
            </View>
          </View>
          {brand?.description ? (
            <Text style={styles.brandDescription}>{brand.description}</Text>
          ) : null}
          {brand?.contact_email ? (
            <Text style={styles.brandContact}>Email: {brand.contact_email}</Text>
          ) : null}
          {brand?.contact_phone ? (
            <Text style={styles.brandContact}>Phone: {brand.contact_phone}</Text>
          ) : null}

          {(brand?.contact_email || brand?.contact_phone) && (
            <View style={styles.contactActionsRow}>
              {brand?.contact_email ? (
                <TouchableOpacity
                  style={[styles.contactActionButton, styles.contactEmailButton]}
                  onPress={() => Linking.openURL(`mailto:${brand.contact_email}`)}
                >
                  <Text style={styles.contactActionText}>Email Brand</Text>
                </TouchableOpacity>
              ) : null}
              {brand?.contact_phone ? (
                <TouchableOpacity
                  style={[styles.contactActionButton, styles.contactPhoneButton]}
                  onPress={() => Linking.openURL(`tel:${brand.contact_phone}`)}
                >
                  <Text style={styles.contactActionText}>Call Brand</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {brandProducts.length === 0 ? (
        <Text style={styles.emptyText}>No products for this brand yet.</Text>
      ) : (
        <FlatList
          data={brandProducts}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default BrandScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bannerWrapper: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
    height: 140,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  followButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    marginLeft: 8,
  },
  followButtonActive: {
    backgroundColor: '#111827',
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  followButtonTextActive: {
    color: '#ffffff',
  },
  brandInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  brandIconWrapper: {
    width: 70,
    height: 70,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  brandLogo: {
    width: 56,
    height: 56,
  },
  brandIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  brandTextWrapper: {
    flex: 1,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  brandStatsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  brandStatsItem: {
    marginRight: 16,
  },
  brandStatsRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandStatsPrimaryText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  brandStatsSecondaryText: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
  },
  brandMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  brandDescription: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 8,
    lineHeight: 20,
  },
  brandContact: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  contactActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  contactActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginRight: 8,
  },
  contactEmailButton: {},
  contactPhoneButton: {},
  contactActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  emptyText: {
    marginTop: 24,
    textAlign: 'center',
    color: '#9ca3af',
  },
  listContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  productCard: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  productImageWrapper: {
    height: 190,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginBottom: 10,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  flashBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flashBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  productPriceCol: {
    alignItems: 'flex-end',
  },
  productPriceOriginal: {
    fontSize: 11,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  productPriceDiscount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  productFooterRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productRatingText: {
    marginLeft: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
});
