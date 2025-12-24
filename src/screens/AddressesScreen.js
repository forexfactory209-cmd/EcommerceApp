import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const AddressesScreen = ({ navigation }) => {
  const authUserId = useStore((state) => state.authUserId);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!authUserId) {
      setAddresses([]);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('id, name, country, city, phone, secondary_phone, address_line, is_primary')
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
    <View
      key={item.id}
      style={[styles.addressCard, isPrimaryCard && styles.addressCardPrimary]}
    >
      <View style={styles.addressCardHeaderRow}>
        <View style={styles.addressCardTitleRow}>
          <View style={styles.addressAvatar}>
            <Text style={styles.addressAvatarText}>
              {(item.name || 'H').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.addressLabel}>{item.name || 'Address'}</Text>
            {isPrimaryCard && (
              <Text style={styles.addressSubLabel}>Default</Text>
            )}
          </View>
        </View>
        <View style={styles.addressCardActionsRow}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('AddAddress', { address: item })}
          >
            <Text style={styles.iconButtonText}>✎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.iconButtonDelete]}
            onPress={() => handleDelete(item.id)}
          >
            <Text style={styles.iconButtonText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.addressContent}>
        <Text style={styles.addressName}>{item.name || 'John Doe'}</Text>
        <Text style={styles.addressLine}>{item.address_line}</Text>
        <Text style={styles.addressLine}>
          {item.city}
          {item.city && item.country ? ', ' : ''}
          {item.country}
        </Text>
        {item.phone ? <Text style={styles.addressPhone}>{item.phone}</Text> : null}
        {item.secondary_phone ? (
          <Text style={styles.addressPhone}>{item.secondary_phone}</Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
        >
          <Text style={styles.headerBackIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyTitle}>No addresses yet</Text>
          <Text style={styles.emptyText}>
            Add your first delivery address so checkout is faster next time.
          </Text>
          <TouchableOpacity
            style={[styles.addAddressButton, { marginTop: 24 }]}
            onPress={() => navigation.navigate('AddAddress')}
          >
            <Text style={styles.addAddressPlus}>＋</Text>
            <Text style={styles.addAddressText}>Add New Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardContainer}>
            {primaryAddress && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Primary Address</Text>
                {renderAddressCard(primaryAddress, true)}
              </View>
            )}

            {otherAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Other Addresses</Text>
                {otherAddresses.map((addr) => renderAddressCard(addr, false))}
              </View>
            )}

            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={() => navigation.navigate('AddAddress')}
            >
              <Text style={styles.addAddressPlus}>＋</Text>
              <Text style={styles.addAddressText}>Add New Address</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default AddressesScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerBackIcon: {
    fontSize: 16,
    color: '#111827',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  cardContainer: {
    gap: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  addressCardPrimary: {
    borderColor: '#090966',
  },
  addressCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addressAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#090966',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  addressSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  addressCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    backgroundColor: '#FFFFFF',
  },
  iconButtonDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  iconButtonText: {
    fontSize: 13,
  },
  addressContent: {
    marginTop: 4,
  },
  addressName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  addressLine: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 2,
  },
  addressPhone: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  addAddressButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#090966',
  },
  addAddressPlus: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 6,
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
