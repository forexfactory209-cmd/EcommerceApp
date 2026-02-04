import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Animated, Dimensions, StatusBar, Platform, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import {
  MapPin,
  Phone,
  Home,
  Plus,
  Edit,
  Trash2,
  Star,
  ChevronLeft,
  User,
  Navigation,
  CheckCircle,
  Map,
  Building2,
  Crown,
  Sparkles,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';

const AddressesScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  const cardAnimations = React.useRef({}).current;

  const loadAddresses = useCallback(async () => {
    if (!authUserId) {
      setAddresses([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('id, name, country, city, district, phone, secondary_phone, address_line, address_descr, is_primary')
        .eq('user_id', authUserId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Addresses: failed to load addresses', error.message || error);
        setAddresses([]);
        return;
      }

      setAddresses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Addresses: unexpected error', e.message || e);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }, [loadAddresses]),
  );

  const handleDelete = (addressId) => {
    Alert.alert('Delete address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('customer_addresses')
              .delete()
              .eq('id', addressId);
            if (error) {
              console.warn('Addresses: failed to delete address', error.message || error);
              Alert.alert('Error', 'Could not delete address. Please try again.');
              return;
            }
            loadAddresses();
          } catch (e) {
            console.warn('Addresses: unexpected error deleting address', e.message || e);
            Alert.alert('Error', 'Something went wrong. Please try again.');
          }
        },
      },
    ]);
  };

  const primaryAddress = addresses.find((a) => a.is_primary);
  const otherAddresses = addresses.filter((a) => !a.is_primary);

  const renderAddressCard = (item, isPrimaryCard = false, index = 0) => {
    const delay = index * 100;
    
    // Initialize animation for this card if not exists
    if (!cardAnimations[item.id]) {
      cardAnimations[item.id] = new Animated.Value(0);
      Animated.timing(cardAnimations[item.id], {
        toValue: 1,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }).start();
    }

    return (
      <Animated.View
        key={item.id}
        style={[
          styles.addressCard,
          isPrimaryCard && styles.primaryCard,
          {
            opacity: cardAnimations[item.id],
            transform: [
              {
                translateY: cardAnimations[item.id].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.cardContent}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('AddAddress', { address: item })}
        >
          {/* Premium Header for Primary Address */}
          {isPrimaryCard && (
            <View style={styles.premiumHeader}>
              <View style={styles.premiumBadge}>
                <Crown size={16} color="#FFFFFF" />
                <Text style={styles.premiumText}>PRIMARY ADDRESS</Text>
              </View>
              <Sparkles size={20} color={ACCENT_COLOR} />
            </View>
          )}

          {/* Main Content */}
          <View style={styles.cardMain}>
            <View style={styles.addressHeader}>
              <View style={styles.avatarSection}>
                <View style={[styles.avatar, isPrimaryCard && styles.primaryAvatar]}>
                  {isPrimaryCard ? (
                    <Home size={24} color="#FFFFFF" />
                  ) : (
                    <MapPin size={24} color={BRAND_COLOR} />
                  )}
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressName}>{item.name || 'Address'}</Text>
                  <Text style={styles.addressLocation}>
                    {item.city}, {item.country}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('AddAddress', { address: item })}
              >
                <Edit size={18} color={BRAND_COLOR} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.addressDetails}>
              <View style={styles.detailRow}>
                <Navigation size={16} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={2}>
                  {item.address_line}
                </Text>
              </View>

              {item.phone && (
                <View style={styles.detailRow}>
                  <Phone size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{item.phone}</Text>
                </View>
              )}

              {item.district && (
                <View style={styles.detailRow}>
                  <Building2 size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{item.district}</Text>
                </View>
              )}
            </View>

            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteAction]}
                onPress={() => handleDelete(item.id)}
              >
                <Trash2 size={16} color="#EF4444" />
                <Text style={styles.deleteText}>Remove</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('AddAddress', { address: item })}
              >
                <CheckCircle size={16} color={BRAND_COLOR} />
                <Text style={styles.selectText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_COLOR} />
      
      {/* Elegant Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
        >
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
            <Text style={styles.loadingText}>Loading your addresses...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Map size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No saved addresses</Text>
            <Text style={styles.emptySubtitle}>
              Add your first address to make checkout faster and easier
            </Text>
            <TouchableOpacity
              style={styles.addFirstButton}
              onPress={() => navigation.navigate('AddAddress')}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addFirstText}>Add Your First Address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.addressesList}>
            {/* Primary Address Section */}
            {primaryAddress && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Primary Address</Text>
                {renderAddressCard(primaryAddress, true, 0)}
              </View>
            )}

            {/* Other Addresses Section */}
            {otherAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Other Addresses</Text>
                {otherAddresses.map((addr, index) => renderAddressCard(addr, false, index + 1))}
              </View>
            )}

            {/* Add New Address Button */}
            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={() => navigation.navigate('AddAddress')}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addAddressText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddressesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: BRAND_COLOR,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: BRAND_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addFirstText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addressesList: {
    gap: 24,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginLeft: 4,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  primaryCard: {
    borderColor: BRAND_COLOR,
    borderWidth: 2,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.15,
    elevation: 8,
  },
  cardContent: {
    overflow: 'hidden',
  },
  premiumHeader: {
    backgroundColor: 'linear-gradient(135deg, #090966 0%, #1a1a7e 100%)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  premiumText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cardMain: {
    padding: 20,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  primaryAvatar: {
    backgroundColor: BRAND_COLOR,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  addressLocation: {
    fontSize: 14,
    color: '#6B7280',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  addressDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  deleteAction: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  selectAction: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: BRAND_COLOR,
  },
  selectText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  addAddressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
