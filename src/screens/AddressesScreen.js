import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';

const AddressesScreen = ({ navigation }) => {
  const orders = useStore((state) => state.orders);

  const addresses = useMemo(() => {
    const seen = new Set();
    const list = [];
    orders.forEach((o) => {
      const addr = o.delivery_address;
      if (!addr || typeof addr !== 'string') return;
      const key = addr.trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      list.push({ id: key, address: addr });
    });
    return list;
  }, [orders]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.addressText}>{item.address}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Saved Addresses</Text>
      {addresses.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <Text style={styles.emptyTitle}>No addresses yet</Text>
          <Text style={styles.emptyText}>Addresses will appear here after you place orders.</Text>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
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
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addressText: {
    fontSize: 14,
    color: '#111827',
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
