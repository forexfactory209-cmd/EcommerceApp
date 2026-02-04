import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, Animated, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { Heart, ShoppingCart, Trash2, X, Search } from 'lucide-react-native';

// Brand colors
const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';
const SUCCESS_COLOR = '#10B981';
const BACKGROUND_COLOR = '#f9fafb';

const WishlistScreen = ({ navigation }) => {
  const wishlist = useStore((state) => state.wishlist);
  const removeFromWishlist = useStore((state) => state.removeFromWishlist);
  const addToCart = useStore((state) => state.addToCart);
  const [editingMode, setEditingMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showOptions, setShowOptions] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter wishlist based on search query
  const filteredWishlist = useMemo(() => {
    if (!searchQuery.trim()) {
      return wishlist;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return wishlist.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.brand.toLowerCase().includes(query)
    );
  }, [wishlist, searchQuery]);

  const handleRemoveFromWishlist = (itemId) => {
    Alert.alert(
      'Remove from Wishlist',
      'Are you sure you want to remove this item from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeFromWishlist(itemId)
        },
      ]
    );
  };

  const handleAddToCart = (item) => {
    addToCart(item);
    Alert.alert(
      'Added to Cart',
      `${item.name} has been added to your cart.`,
      [
        { text: 'OK' },
        { 
          text: 'View Cart', 
          onPress: () => navigation.navigate('Cart')
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Wishlist',
      'Are you sure you want to remove all items from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            wishlist.forEach(item => removeFromWishlist(item.id));
            setEditingMode(false);
            setSelectedItems(new Set());
          }
        },
      ]
    );
  };

  const handleLongPress = (item) => {
    setShowOptions(item.id);
  };

  const handleSwipeLeft = (itemId) => {
    handleRemoveFromWishlist(itemId);
  };

  const getAvailabilityStatus = (item) => {
    // Mock availability logic
    const random = Math.random();
    if (random < 0.1) return { text: 'Out of stock', color: '#EF4444' };
    if (random < 0.2) return { text: 'Price dropped!', color: SUCCESS_COLOR };
    return { text: 'In stock', color: SUCCESS_COLOR };
  };

  const renderItem = ({ item }) => {
    const availability = getAvailabilityStatus(item);
    const isSelected = selectedItems.has(item.id);
    
    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={[styles.card, isSelected && styles.cardSelected]}
          onPress={() => navigation.navigate('ProductDetails', { product: item })}
          onLongPress={() => handleLongPress(item)}
          activeOpacity={0.9}
        >
          <View style={styles.imageWrapper}>
            <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
            {editingMode && (
              <TouchableOpacity
                style={styles.selectCheckbox}
                onPress={() => {
                  const newSelected = new Set(selectedItems);
                  if (isSelected) {
                    newSelected.delete(item.id);
                  } else {
                    newSelected.add(item.id);
                  }
                  setSelectedItems(newSelected);
                }}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <X size={12} color="#ffffff" />}
                </View>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>{item.brand}</Text>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.availability, { color: availability.color }]}>
                {availability.text}
              </Text>
            </View>
            <View style={styles.priceSection}>
              <Text style={styles.price}>${item.price}</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleAddToCart(item)}
                >
                  <ShoppingCart size={16} color={BRAND_COLOR} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleRemoveFromWishlist(item.id)}
                >
                  <Heart size={16} color="#EF4444" fill="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        {showOptions === item.id && (
          <View style={styles.optionsOverlay}>
            <TouchableOpacity
              style={styles.optionsBackdrop}
              onPress={() => setShowOptions(null)}
            />
            <View style={styles.optionsMenu}>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  handleAddToCart(item);
                  setShowOptions(null);
                }}
              >
                <ShoppingCart size={18} color={BRAND_COLOR} />
                <Text style={styles.optionText}>Add to Cart</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => {
                  handleRemoveFromWishlist(item.id);
                  setShowOptions(null);
                }}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text style={styles.optionText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>Wishlist</Text>
            <Text style={styles.subtitle}>
              {searchQuery ? `${filteredWishlist.length} of ${wishlist.length} items` : `${wishlist.length} ${wishlist.length === 1 ? 'item' : 'items'}`}
            </Text>
          </View>
          {wishlist.length > 0 && (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => {
                  if (editingMode) {
                    setEditingMode(false);
                    setSelectedItems(new Set());
                  } else {
                    setEditingMode(true);
                  }
                }}
              >
                <Text style={styles.headerButtonText}>
                  {editingMode ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
              {editingMode && selectedItems.size > 0 && (
                <TouchableOpacity
                  style={[styles.headerButton, styles.clearButton]}
                  onPress={() => {
                    Alert.alert(
                      'Remove Selected',
                      `Remove ${selectedItems.size} selected items?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => {
                            selectedItems.forEach(id => removeFromWishlist(id));
                            setEditingMode(false);
                            setSelectedItems(new Set());
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.clearButtonText}>Remove ({selectedItems.size})</Text>
                </TouchableOpacity>
              )}
              {wishlist.length > 1 && !editingMode && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleClearAll}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        {/* Search Bar */}
        {wishlist.length > 0 && (
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search wishlist..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {wishlist.length === 0 ? (
        /* Empty Wishlist Section */
        <View style={styles.emptyWrapper}>
          <Heart size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyText}>Tap the heart icon on products to save them here.</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.browseButtonText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : filteredWishlist.length === 0 ? (
        /* No Search Results Section */
        <View style={styles.emptyWrapper}>
          <Search size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptyText}>Try searching with different keywords or clear the search to see all items.</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.browseButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredWishlist}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default WishlistScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  
  // Header Section
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  subtitle: {
    marginTop: 4,
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  clearButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  clearButtonText: {
    color: '#EF4444',
  },
  
  // Search Bar
  searchContainer: {
    marginTop: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: BRAND_COLOR,
    paddingVertical: 4,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  // Wishlist Items Section
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  cardContainer: {
    marginBottom: 12,
    position: 'relative',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardSelected: {
    borderColor: BRAND_COLOR,
    backgroundColor: '#F0F9FF',
  },
  imageWrapper: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    marginRight: 12,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectCheckbox: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: BRAND_COLOR,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brand: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
    marginTop: 4,
  },
  availability: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  priceSection: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Options Menu
  optionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  optionsBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  optionsMenu: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    minWidth: 150,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  // Empty Wishlist Section
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginBottom: 12,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  browseButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
