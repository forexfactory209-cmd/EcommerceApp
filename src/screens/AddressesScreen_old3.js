import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Animated, Dimensions, StatusBar, Platform } from 'react-native';
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
  ChevronRight,
  User,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const BRAND_COLOR = '#090966';

const AddressesScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

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
    }, [loadAddresses]),
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

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

  const renderAddressCard = (item, isPrimaryCard = false) => (
    <Animated.View
      key={item.id}
      style={[
        styles.addressCard,
        isPrimaryCard && styles.primaryCard,
        { opacity: fadeAnim }
      ]}
    >
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AddAddress', { address: item })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.addressInfo}>
            <View style={[styles.avatarContainer, isPrimaryCard && styles.primaryAvatar]}>
              {isPrimaryCard ? (
                <Star size={20} color="#FFFFFF" />
              ) : (
                <User size={20} color={BRAND_COLOR} />
              )}
            </View>
            <View style={styles.nameContainer}>
              <Text style={styles.addressName}>{item.name || 'Address'}</Text>
              {isPrimaryCard && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>Primary</Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </View>

        <View style={styles.addressDetails}>
          <View style={styles.detailRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.detailText}>{item.address_line}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Home size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {item.city}
              {item.city && item.district ? ', ' : ''}
              {item.district}
              {(item.city || item.district) && item.country ? ', ' : ''}
              {item.country}
            </Text>
          </View>

          {item.phone && (
            <View style={styles.detailRow}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.detailText}>{item.phone}</Text>
            </View>
          )}

          {item.secondary_phone && (
            <View style={styles.detailRow}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.detailText}>{item.secondary_phone}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => navigation.navigate('AddAddress', { address: item })}
          >
            <Edit size={16} color={BRAND_COLOR} />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 size={16} color="#EF4444" />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_COLOR} />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
        >
          <ChevronRight size={24} color="#FFFFFF" style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
            <Text style={styles.loadingText}>Loading addresses...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <MapPin size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No addresses yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first delivery address to make checkout faster
            </Text>
            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={() => navigation.navigate('AddAddress')}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.addAddressText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.addressesList}>
            {primaryAddress && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Primary Address</Text>
                {renderAddressCard(primaryAddress, true)}
              </View>
            )}

            {otherAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Other Addresses</Text>
                {otherAddresses.map((addr) => renderAddressCard(addr, false))}
              </View>
            )}

            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={() => navigation.navigate('AddAddress')}
            >
              <Plus size={18} color="#FFFFFF" />
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
    paddingHorizontal: 20,
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
  addressesList: {
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryCard: {
    borderColor: BRAND_COLOR,
    borderWidth: 2,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.1,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  primaryAvatar: {
    backgroundColor: BRAND_COLOR,
  },
  nameContainer: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  primaryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addressDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: BRAND_COLOR,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLOR,
    paddingVertical: 14,
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
