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
        .select('id, name, country, city, phone, address_line, is_primary')
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
          <Text style={styles.addressLabel}>{item.name || 'Address'}</Text>
          {isPrimaryCard && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
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
                <Text style={styles.sectionLabel}>PRIMARY ADDRESS</Text>
                {renderAddressCard(primaryAddress, true)}
              </View>
            )}

            {otherAddresses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>OTHER ADDRESSES</Text>
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
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontSize: 18,
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
    paddingVertical: 8,
    alignItems: 'center',
  },
  cardContainer: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  addressCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 12,
  },
  addressCardPrimary: {
    borderColor: '#11126F',
    backgroundColor: '#EEF2FF',
  },
  addressCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  defaultBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
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
    marginTop: 2,
  },
  addressName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 13,
    color: '#4B5563',
  },
  addressPhone: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#11126F',
  },
  addAddressPlus: {
    fontSize: 18,
    color: '#FFFFFF',
    marginRight: 6,
  },
  addAddressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
