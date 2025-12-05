import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShoppingCart, Heart, Star } from 'lucide-react-native';
import { useStore } from '../store/store';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUserProductRating, upsertUserProductRating, fetchProductRatingSummary } from '../services/ratings';

const ProductDetailsScreen = ({ route, navigation }) => {
  const { product } = route.params;
  const addToCart = useStore((state) => state.addToCart);
  const wishlist = useStore((state) => state.wishlist);
  const addToWishlist = useStore((state) => state.addToWishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const userType = useStore((state) => state.userType);
  const authRole = useStore((state) => state.authRole);
  const products = useStore((state) => state.products);
  const productRatings = useStore((state) => state.productRatings);
  const setProductRating = useStore((state) => state.setProductRating);
  const authUserId = useStore((state) => state.authUserId);

  const inWishlist = wishlist.some((item) => item.id === product.id);

  const quantity = Number(product.quantity ?? 0);
  const availabilityLabel = quantity > 0 ? `${quantity} in stock` : 'Out of stock';

  const baseProducts = Array.isArray(products) ? products : [];

  const isBrandUser = userType === 'brand' || authRole === 'brand';
  const isAdminUser = authRole === 'admin';
  const ownsProduct = !!(authUserId && product.brand_user_id && product.brand_user_id === authUserId);

  const currentRating = productRatings[product.id] || 0;

  const similarProducts = useMemo(() => {
    const brandName = product.brand || '';
    const brandUserId = product.brand_user_id || null;

    if (!brandName) return [];

    return baseProducts
      .filter((p) => {
        if (p.id === product.id) return false;

        const sameBrand = (p.brand || '') === brandName;
        const sameStore = brandUserId && p.brand_user_id === brandUserId;

        // Prefer same store + same brand when store id exists,
        // otherwise just match on brand.
        return brandUserId ? sameBrand && sameStore : sameBrand;
      })
      .slice(0, 6);
  }, [baseProducts, product]);

  const handleCopyCode = async () => {
    if (!product.code) return;
    await Clipboard.setStringAsync(product.code.toString());
    Alert.alert('Copied', 'Product code copied to clipboard.');
  };

  const images = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }
    if (product.image) {
      return [product.image];
    }
    return [];
  }, [product]);

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const deliveryOptions = Array.isArray(product.deliveryOptions) ? product.deliveryOptions : [];

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(colors[0] || null);
  const [selectedSize, setSelectedSize] = useState(sizes[0] || null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(
    deliveryOptions[0]?.id || null,
  );

  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);

  const imageScrollRef = useRef(null);

  const currentPrice = Number(product.price) || 0;
  const flashPriceRaw =
    product.flash_price != null && product.flash_price !== ''
      ? Number(product.flash_price)
      : null;

  let isFlashActive = false;
  let flashPrice = null;
  if (flashPriceRaw != null && !Number.isNaN(flashPriceRaw) && flashPriceRaw > 0) {
    try {
      const now = new Date();
      const start = product.flash_start_at ? new Date(product.flash_start_at) : null;
      const end = product.flash_end_at ? new Date(product.flash_end_at) : null;
      const hasQty = product.flash_quantity != null;
      const sold = Number(product.flash_sold) || 0;
      const qtyOk = !hasQty || sold < product.flash_quantity;

      if (start && end && start <= now && end > now) {
        if (qtyOk) {
          isFlashActive = true;
          flashPrice = flashPriceRaw;
        }
      }
    } catch (e) {
      // ignore date parse errors
    }
  }

  const isFlashSoldOut = (() => {
    if (!product.flash_price) return false;
    const now = new Date();
    const start = product.flash_start_at ? new Date(product.flash_start_at) : null;
    const end = product.flash_end_at ? new Date(product.flash_end_at) : null;
    if (!start || !end || start > now || end <= now) return false;
    if (product.flash_quantity == null) return false;
    const sold = Number(product.flash_sold) || 0;
    return sold >= product.flash_quantity;
  })();

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadRating = async () => {
        try {
          if (!product?.id) return;

          if (authUserId) {
            const existing = await fetchUserProductRating(product.id, authUserId);
            if (!isActive) return;
            if (typeof existing === 'number') {
              setProductRating(product.id, existing);
            }
          }

          const summary = await fetchProductRatingSummary(product.id);
          if (!isActive) return;
          setAvgRating(summary.avg);
          setRatingCount(summary.count);
        } catch (e) {
          console.warn('Failed to load product rating', e.message || e);
        }
      };

      loadRating();

      return () => {
        isActive = false;
      };
    }, [authUserId, product?.id, setProductRating])
  );

  return (
    <View style={styles.container}>
      {/* Image Header with simple slider */}
      <View style={styles.imageHeader}>
        {images.length > 0 && (
          <ScrollView
            ref={imageScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const width = Dimensions.get('window').width;
              const index = Math.round(e.nativeEvent.contentOffset.x / width);
              if (index !== selectedImageIndex) {
                setSelectedImageIndex(index);
              }
            }}
            scrollEventThrottle={16}
          >
            {images.map((uri, index) => (
              <View key={index} style={styles.slideWrapper}>
                <Image source={{ uri }} style={styles.headerImage} resizeMode="cover" />
              </View>
            ))}
          </ScrollView>
        )}
        {images.length > 1 && (
          <View style={styles.dotsRow}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === selectedImageIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
        <SafeAreaView style={styles.headerOverlay}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.iconButton}
          >
            <ArrowLeft color="black" size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              if (authRole === 'admin') {
                return;
              }
              if (inWishlist) {
                removeFromWishlist(product.id);
              } else {
                addToWishlist(product);
              }
            }}
          >
            <Heart
              size={24}
              color={inWishlist ? '#ef4444' : '#9ca3af'}
              fill={inWishlist ? '#ef4444' : 'transparent'}
            />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* Content */}
      <View style={styles.contentPanel}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.titleRow}>
             <View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productBrand}>{product.brand}</Text>
              {isFlashActive && (
                <View style={styles.flashBadgeDetail}>
                  <Text style={styles.flashBadgeDetailText}>Flash Sale</Text>
                </View>
              )}
              {isFlashSoldOut && (
                <View style={styles.flashSoldOutBadge}>
                  <Text style={styles.flashSoldOutBadgeText}>Sold out</Text>
                </View>
              )}
             </View>
             <View style={styles.ratingRow}>
             {[1, 2, 3, 4, 5].map((star) => {
                const active = currentRating ? currentRating >= star : avgRating >= star;

                // For normal customers: interactive rating
                if (!isBrandUser && !isAdminUser) {
                  return (
                    <TouchableOpacity
                      key={star}
                      onPress={async () => {
                        setProductRating(product.id, star);
                        try {
                          if (authUserId) {
                            await upsertUserProductRating(product.id, authUserId, star);
                          }
                        } catch (e) {
                          console.warn('Failed to save product rating', e.message || e);
                        }
                      }}
                      style={styles.ratingStarButton}
                    >
                      <Star
                        size={20}
                        color={active ? '#FBBF24' : '#D1D5DB'}
                        fill={active ? '#FBBF24' : 'transparent'}
                      />
                    </TouchableOpacity>
                  );
                }

                // For brand/admin: read-only stars (no onPress)
                return (
                  <View key={star} style={styles.ratingStarButton}>
                    <Star
                      size={20}
                      color={active ? '#FBBF24' : '#D1D5DB'}
                      fill={active ? '#FBBF24' : 'transparent'}
                    />
                  </View>
                );
              })}
              <Text style={styles.ratingText}>
                {currentRating
                  ? currentRating.toFixed(1)
                  : avgRating != null
                  ? avgRating.toFixed(1)
                  : '0.0'}
                {ratingCount > 0 ? ` (${ratingCount})` : ''}
              </Text>
             </View>
          </View>

          <Text style={styles.description}>
            {product.description}
          </Text>

          {product.code ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Product code</Text>
              <View style={styles.codeRow}>
                <View style={styles.codeValueWrapper}>
                  <Text style={styles.codeValue}>{product.code}</Text>
                </View>
                <TouchableOpacity style={styles.codeCopyButton} onPress={handleCopyCode}>
                  <Text style={styles.codeCopyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Availability</Text>
            <Text style={styles.availabilityText}>{availabilityLabel}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sellerRow}>
              <View>
                <Text style={styles.sectionLabel}>Seller</Text>
                <Text style={styles.sellerValue}>{product.brand || 'Store'}</Text>
              </View>
              {product.brand ? (
                <TouchableOpacity
                  style={styles.viewStoreButton}
                  onPress={() =>
                    navigation.navigate('Brand', {
                      brand: {
                        name: product.brand,
                        user_id: product.brand_user_id || null,
                      },
                    })
                  }
                >
                  <Text style={styles.viewStoreButtonText}>View Store</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {colors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Color</Text>
              <View style={styles.chipRow}>
                {colors.map((color, index) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.chip,
                      selectedColor === color && styles.chipActive,
                    ]}
                    onPress={() => {
                      setSelectedColor(color);
                      setSelectedImageIndex(index);
                      const width = Dimensions.get('window').width;
                      if (imageScrollRef.current && images.length > index) {
                        imageScrollRef.current.scrollTo({
                          x: width * index,
                          animated: true,
                        });
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedColor === color && styles.chipTextActive,
                      ]}
                    >
                      {color}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {sizes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Size</Text>
              <View style={styles.chipRow}>
                {sizes.map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.chip,
                      selectedSize === size && styles.chipActive,
                    ]}
                    onPress={() => setSelectedSize(size)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedSize === size && styles.chipTextActive,
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {deliveryOptions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Delivery</Text>
              {deliveryOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.deliveryRow,
                    selectedDeliveryId === opt.id && styles.deliveryRowActive,
                  ]}
                  onPress={() => setSelectedDeliveryId(opt.id)}
                >
                  <View>
                    <Text style={styles.deliveryTitle}>{opt.label}</Text>
                    {opt.eta ? (
                      <Text style={styles.deliveryMeta}>{opt.eta}</Text>
                    ) : null}
                  </View>
                  {typeof opt.price === 'number' && (
                    <Text style={styles.deliveryPrice}>${opt.price}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {similarProducts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Similar products</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarList}
              >
                {similarProducts.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.similarCard}
                    onPress={() => navigation.push('ProductDetails', { product: item })}
                    activeOpacity={0.9}
                  >
                    <View style={styles.similarImageWrapper}>
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          style={styles.similarImage}
                          resizeMode="cover"
                        />
                      ) : null}
                    </View>
                    <Text style={styles.similarBrand}>{item.brand}</Text>
                    <Text style={styles.similarName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.similarPrice}>${item.price}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.priceSection}>
            <View>
              <Text style={styles.priceLabel}>Price</Text>
              {isFlashActive && flashPrice != null && flashPrice > 0 ? (
                <View>
                  <Text style={styles.priceOriginal}>${currentPrice.toFixed(2)}</Text>
                  <Text style={styles.priceValue}>${flashPrice.toFixed(2)}</Text>
                </View>
              ) : (
                <Text style={styles.priceValue}>${currentPrice.toFixed(2)}</Text>
              )}
            </View>

            <View style={styles.footerButtonsRow}>
              {ownsProduct && (isBrandUser || isAdminUser) && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('EditProduct', { product })}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
              {!isAdminUser && !isBrandUser ? (
                <TouchableOpacity
                  onPress={() => {
                    addToCart({
                      ...product,
                      selectedColor,
                      selectedSize,
                      selectedDeliveryId,
                    });
                    navigation.navigate('Billing');
                  }}
                  style={[styles.addButton, styles.buyNowButton]}
                >
                  <Text style={styles.buyNowButtonText}>Buy Now</Text>
                </TouchableOpacity>
              ) : null}
              {!isAdminUser && !isBrandUser && (
                <TouchableOpacity 
                  onPress={() => {
                    addToCart({
                      ...product,
                      selectedColor,
                      selectedSize,
                      selectedDeliveryId,
                    });
                    navigation.navigate('Main', { screen: 'Cart' });
                  }}
                  style={styles.addButton}
                >
                  <ShoppingCart color="white" size={24} />
                  <Text style={styles.addButtonText}>Add to Cart</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ProductDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeValueWrapper: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  codeValue: {
    fontWeight: '700',
    color: '#111827',
  },
  codeCopyButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  codeCopyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sellerValue: {
    fontSize: 14,
    color: '#4b5563',
    marginTop: 4,
  },
  viewStoreButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  viewStoreButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  editButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  imageHeader: {
    height: '45%',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  slideWrapper: {
    width: Dimensions.get('window').width,
    height: '100%',
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 16,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: '#2563EB',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  contentPanel: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginTop: -40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  productBrand: {
    color: '#9ca3af',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStarButton: {
    marginLeft: 2,
  },
  ratingText: {
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 4,
  },
  description: {
    color: '#6b7280',
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    color: '#111827',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  deliveryRowActive: {
    borderColor: '#2563EB',
    backgroundColor: '#eff6ff',
  },
  deliveryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  deliveryMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  deliveryPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLabel: {
    color: '#9ca3af',
    fontSize: 14,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#2563EB',
    // paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 8,
  },
  flashSoldOutBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fca5a5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  flashSoldOutBadgeText: {
    color: '#991b1b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
