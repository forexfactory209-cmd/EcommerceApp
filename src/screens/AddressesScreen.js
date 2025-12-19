import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
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

  const renderItem = ({ item }) => (
    <View style={[styles.card, item.is_primary && styles.cardPrimary]}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardName}>{item.name || 'Recipient'}</Text>
          {item.phone ? <Text style={styles.cardMeta}>{item.phone}</Text> : null}
        </View>
        <View style={styles.cardHeaderRight}>
          {item.is_primary && <Text style={styles.primaryBadge}>Primary</Text>}
          <View style={styles.cardHeaderActionsRow}>
            <TouchableOpacity
              style={styles.editChip}
              onPress={() => navigation.navigate('AddAddress', { address: item })}
            >
              <Text style={styles.editChipText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteChip}
              onPress={() => handleDelete(item.id)}
            >
              <Text style={styles.deleteChipText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <Text style={styles.cardAddress} numberOfLines={2}>
        {item.address_line}
      </Text>
      <Text style={styles.cardMeta}>
        {item.city}
        {item.city && item.country ? ', ' : ''}
        {item.country}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Saved Addresses</Text>

      {loading ? (
        <View style={styles.emptyWrapper}>
          <ActivityIndicator />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyTitle}>No addresses yet</Text>
          <Text style={styles.emptyText}>Add your first delivery address so checkout is faster next time.</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddAddress')}
      >
        <Text style={styles.addButtonText}>Add New Address</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backProfileButton}
        onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
      >
        <Text style={styles.backProfileText}>Back to Profile</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default AddressesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardPrimary: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  cardHeaderActionsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  primaryBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B5CF6',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cardAddress: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 13,
    color: '#6B7280',
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
  editChip: {
    marginTop: 4,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  editChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  deleteChip: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  deleteChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  addButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  backProfileButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  backProfileText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
});
