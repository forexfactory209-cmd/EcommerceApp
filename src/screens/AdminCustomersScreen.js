import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const AdminCustomersScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const computeSegment = (totalOrders, totalSpent) => {
    if (totalOrders >= 5 || totalSpent >= 500) return 'VIP';
    if (totalOrders >= 2) return 'Active';
    if (totalOrders === 1) return 'New';
    return 'Prospect';
  };

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const { data: orderRows, error: orderError } = await supabase
        .from('orders')
        .select('id, customer_user_id, total, placed_at')
        .order('placed_at', { ascending: false });

      if (orderError) {
        console.warn('Admin customers: error loading orders', orderError.message || orderError);
        setCustomers([]);
        return;
      }

      const validRows = Array.isArray(orderRows)
        ? orderRows.filter((row) => row.customer_user_id)
        : [];

      const byCustomer = new Map();

      validRows.forEach((row) => {
        const id = row.customer_user_id;
        if (!id) return;

        if (!byCustomer.has(id)) {
          byCustomer.set(id, {
            id,
            name: null,
            email: null,
            totalOrders: 0,
            totalSpent: 0,
            lastOrderDate: null,
            segment: 'Prospect',
          });
        }

        const existing = byCustomer.get(id);
        const total = Number(row.total) || 0;
        existing.totalOrders += 1;
        existing.totalSpent += total;

        if (row.placed_at) {
          const currentDate = existing.lastOrderDate
            ? new Date(existing.lastOrderDate)
            : null;
          const newDate = new Date(row.placed_at);
          if (!currentDate || newDate > currentDate) {
            existing.lastOrderDate = row.placed_at;
          }
        }
      });

      const customerIds = Array.from(byCustomer.keys());

      if (customerIds.length > 0) {
        try {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', customerIds);

          if (profileError) {
            console.warn('Admin customers: error loading profiles', profileError.message || profileError);
          } else if (Array.isArray(profileRows)) {
            const profileById = new Map();
            profileRows.forEach((p) => {
              if (!p?.user_id) return;
              profileById.set(p.user_id, p);
            });

            byCustomer.forEach((value, id) => {
              const profile = profileById.get(id);
              if (profile) {
                value.name = profile.name || value.name;
              }
            });
          }
        } catch (e) {
          console.warn('Admin customers: exception loading profiles', e.message || e);
        }
      }

      const result = Array.from(byCustomer.values()).map((c) => {
        const segment = computeSegment(c.totalOrders, c.totalSpent);
        let lastOrderDisplay = null;
        if (c.lastOrderDate) {
          const d = new Date(c.lastOrderDate);
          lastOrderDisplay = d.toLocaleDateString();
        }

        return {
          ...c,
          // Use only the real profile name loaded from Supabase.
          // If there is no profile name, keep name as null so the UI can reflect that.
          name: c.name || null,
          lastOrderDate: lastOrderDisplay,
          segment,
        };
      });

      result.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
      setCustomers(result);
    } catch (e) {
      console.warn('Admin customers: exception loading customers', e.message || e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers]),
  );

  const filteredCustomers = useMemo(() => {
    let list = customers || [];

    if (selectedSegment !== 'all') {
      list = list.filter(
        (c) => c.segment && c.segment.toLowerCase() === selectedSegment,
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => {
        const name = (c.name || '').toString().toLowerCase();
        const email = (c.email || '').toString().toLowerCase();
        const id = (c.id || '').toString().toLowerCase();
        return name.includes(q) || email.includes(q) || id.includes(q);
      });
    }

    return list;
  }, [customers, searchQuery, selectedSegment]);

  const renderCustomer = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {item.name ? item.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.customerName}>{item.name}</Text>
            {item.email ? (
              <Text style={styles.customerEmail} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
          </View>
          <View style={styles.segmentPillWrapper}>
            <Text
              style={[
                styles.segmentPill,
                item.segment === 'VIP' && styles.segmentPillVip,
                item.segment === 'Active' && styles.segmentPillActive,
                item.segment === 'New' && styles.segmentPillNew,
                item.segment === 'Prospect' && styles.segmentPillProspect,
              ]}
            >
              {item.segment}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaColumn}>
            <Text style={styles.metaLabel}>Customer ID</Text>
            <Text style={styles.metaValue}>{item.id}</Text>
          </View>
          <View style={styles.metaColumn}>
            <Text style={styles.metaLabel}>Total Orders</Text>
            <Text style={styles.metaValue}>{item.totalOrders}</Text>
          </View>
          <View style={styles.metaColumn}>
            <Text style={styles.metaLabel}>Total Spent</Text>
            <Text style={styles.metaValue}>${item.totalSpent.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <Text style={styles.metaLabel}>Last Order</Text>
            <Text style={styles.metaValue}>
              {item.lastOrderDate ? item.lastOrderDate : 'No orders yet'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewProfileButton}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('AdminCustomerDetails', {
                customerId: item.id,
                customerName: item.name,
              })
            }
          >
            <Text style={styles.viewProfileText}>View details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
        >
          <Text style={styles.backIcon}>←</Text>
          <Text style={styles.backText}>Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Customers</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
          <Text style={styles.summaryLabel}>Total Customers</Text>
          <Text style={styles.summaryValue}>{customers.length}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSoft]}>
          <Text style={styles.summaryLabel}>VIP Customers</Text>
          <Text style={styles.summaryValue}>
            {customers.filter((c) => c.segment === 'VIP').length}
          </Text>
        </View>
      </View>

      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or ID"
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Segment</Text>
        <View style={styles.chipRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'vip', label: 'VIP' },
            { id: 'active', label: 'Active' },
            { id: 'new', label: 'New' },
            { id: 'prospect', label: 'Prospects' },
          ].map((seg) => (
            <TouchableOpacity
              key={seg.id}
              style={[
                styles.chip,
                selectedSegment === seg.id && styles.chipActive,
              ]}
              onPress={() => setSelectedSegment(seg.id)}
            >
              <Text
                style={
                  selectedSegment === seg.id
                    ? styles.chipTextActive
                    : styles.chipText
                }
              >
                {seg.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && filteredCustomers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomer}
          contentContainerStyle={
            filteredCustomers.length === 0
              ? styles.emptyContainer
              : { paddingBottom: 24 }
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No customers match your filters.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AdminCustomersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  backIcon: {
    fontSize: 16,
    color: '#111827',
    marginRight: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryCardPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#1d4ed8',
  },
  summaryCardSoft: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
    color: '#111827',
  },
  searchSection: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1d4ed8',
  },
  chipText: {
    fontSize: 12,
    color: '#4b5563',
    fontWeight: '500',
  },
  chipTextActive: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  headerTextBlock: {
    flex: 1,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  customerEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  segmentPillWrapper: {
    marginLeft: 8,
  },
  segmentPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#e5e7eb',
  },
  segmentPillVip: {
    backgroundColor: '#facc15',
  },
  segmentPillActive: {
    backgroundColor: '#bbf7d0',
  },
  segmentPillNew: {
    backgroundColor: '#bfdbfe',
  },
  segmentPillProspect: {
    backgroundColor: '#e5e7eb',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaColumn: {
    flex: 1,
    marginRight: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  metaValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
  },
  viewProfileButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  viewProfileText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
});

