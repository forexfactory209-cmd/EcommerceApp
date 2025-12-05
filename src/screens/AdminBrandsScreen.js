import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const AdminBrandsScreen = ({ navigation }) => {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadBrands = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('id, user_id, name, status, contact_email, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to load brands.');
        return;
      }
      const rows = data || [];
      // Show all brands so admin can always select a brand to manage
      setBrands(rows);
    } catch (e) {
      console.error('Load brands error:', e);
      Alert.alert('Error', 'Something went wrong while loading brands.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBrands();
    setRefreshing(false);
  };

  const updateStatus = async (id, status) => {
    try {
      const { error } = await supabase
        .from('brands')
        .update({ status })
        .eq('id', id);

      if (error) {
        Alert.alert('Error', error.message || 'Failed to update brand status.');
        return;
      }

      setBrands((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b)),
      );
    } catch (e) {
      console.error('Update brand status error:', e);
      Alert.alert('Error', 'Something went wrong while updating brand status.');
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.brandName}>{item.name}</Text>
        <Text
          style={[
            styles.statusBadge,
            item.status === 'approved' && styles.statusApproved,
            item.status === 'rejected' && styles.statusRejected,
          ]}
        >
          {item.status}
        </Text>
      </View>
      {item.contact_email ? (
        <Text style={styles.brandEmail}>{item.contact_email}</Text>
      ) : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewVendorButton]}
          onPress={() => {
            if (!item.user_id) {
              Alert.alert('Missing brand user', 'This brand has no linked user_id.');
              return;
            }
            navigation.navigate('AdminVendor', {
              brandUserId: item.user_id,
              brandName: item.name,
            });
          }}
        >
          <Text style={styles.actionText}>View Vendor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => updateStatus(item.id, 'approved')}
        >
          <Text style={styles.actionText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => updateStatus(item.id, 'rejected')}
        >
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.pendingButton]}
          onPress={() => updateStatus(item.id, 'pending')}
        >
          <Text style={styles.actionText}>Pending</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Main', { screen: 'Profile' })}
        >
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dashboardButton}
          onPress={() => navigation.navigate('AdminDashboard')}
        >
          <Text style={styles.dashboardButtonText}>Revenue Dashboard</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Brand Applications</Text>
      <FlatList
        data={brands}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={brands.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }}
        ListEmptyComponent={!loading && (
          <Text style={styles.emptyText}>No brand applications yet.</Text>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
};

export default AdminBrandsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 50,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  dashboardButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  dashboardButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#9ca3af',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  brandEmail: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
    backgroundColor: '#e0f2fe',
    textTransform: 'capitalize',
  },
  statusApproved: {
    color: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  statusRejected: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: '#16a34a',
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  pendingButton: {
    backgroundColor: '#6b7280',
  },
  viewVendorButton: {
    backgroundColor: '#2563EB',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
