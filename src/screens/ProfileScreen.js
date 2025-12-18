import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';

const ProfileScreen = ({ navigation }) => {
  const orders = useStore((state) => state.orders);
  const userType = useStore((state) => state.userType);
  const authEmail = useStore((state) => state.authEmail);
  const authRole = useStore((state) => state.authRole);
  const authUserId = useStore((state) => state.authUserId);
  const setUserType = useStore((state) => state.setUserType);
  const setUserProfile = useStore((state) => state.setUserProfile);
  const clearAuthUser = useStore((state) => state.clearAuthUser);

  const [brandId, setBrandId] = useState(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [activeSectionKey, setActiveSectionKey] = useState(null);

  useEffect(() => {
    const loadBrandForProfile = async () => {
      try {
        console.log('[ProfileScreen] Loading brand for authUserId:', authUserId, 'authRole:', authRole);
        if (!authUserId || authRole !== 'brand') {
          console.log('[ProfileScreen] Not a brand user, setting brandId to null');
          setBrandId(null);
          return;
        }

        const { data, error } = await supabase
          .from('brands')
          .select('id')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('Error loading brand for profile screen:', error.message || error);
          setBrandId(null);
          return;
        }

        const brandId = data?.id || null;
        console.log('[ProfileScreen] Loaded brandId:', brandId, typeof brandId);
        setBrandId(brandId);
      } catch (e) {
        console.warn('Unexpected error loading brand for profile screen:', e.message || e);
        setBrandId(null);
      } finally {
        setBrandLoading(false);
      }
    };

    loadBrandForProfile();
  }, [authUserId, authRole]);

  const myOrders =
    userType === 'brand' && authUserId
      ? orders.filter((o) => o.brand_user_id === authUserId)
      : orders;

  const totalOrders = myOrders.length;
  const deliveredCount = myOrders.filter((o) => o.status === 'Delivered').length;
  const pendingCount = myOrders.filter((o) => o.status !== 'Delivered').length;
  const totalSpent = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const ADMIN_EMAIL = 'caliaxmed488@gmail.com'; // Change to your admin email

  const renderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeaderRow}>
        <Text style={styles.orderTitle}>Order #{item.id}</Text>
        <Text style={styles.orderDate}>{item.date}</Text>
      </View>
      <Text style={styles.orderMeta}>
        {item.items.length} items
        <Text style={styles.orderMetaBold}> • ${item.total.toFixed(2)}</Text>
      </Text>
      {Array.isArray(item.items) && item.items.length > 0 && (
        <View style={styles.orderItemsList}>
          {item.items.slice(0, 3).map((prod) => (
            <Text key={prod.id} style={styles.orderItemLine}>
              {prod.quantity}x {prod.name}
            </Text>
          ))}
          {item.items.length > 3 && (
            <Text style={styles.orderItemMore}>
              +{item.items.length - 3} more
            </Text>
          )}
        </View>
      )}
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text
          style={
            item.status === 'Delivered'
              ? styles.statusDelivered
              : styles.statusPending
          }
        >
          {item.status}
        </Text>
      </View>
      <View style={styles.extraRow}>
        <Text style={styles.extraLabel}>Payment:</Text>
        <Text style={styles.extraValue}>{item.payment_method || 'N/A'}</Text>
      </View>
      {item.delivery_address ? (
        <View style={styles.extraAddress}>
          <Text style={styles.extraLabel}>Address:</Text>
          <Text style={styles.extraAddressText} numberOfLines={2}>
            {item.delivery_address}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (userType === 'customer' && authRole !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerBackground}>
            <View style={styles.headerContent}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {authEmail ? authEmail.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View style={styles.headerTextBlock}>
                <Text style={styles.headerName}>My Profile</Text>
                {authEmail && <Text style={styles.headerEmail}>{authEmail}</Text>}
                <Text style={styles.headerSubText}>Customer account</Text>
              </View>
            </View>
          </View>

          <View style={styles.profileCardWrapper}>
            <View style={styles.statsCardRow}>
              <View style={styles.statsColumn}>
                <Text style={styles.statsNumberPrimary}>{totalOrders}</Text>
                <Text style={styles.statsLabel}>Orders</Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsColumn}>
                <Text style={styles.statsNumberSuccess}>{deliveredCount}</Text>
                <Text style={styles.statsLabel}>Completed</Text>
              </View>
              <View style={styles.statsDivider} />
              <View style={styles.statsColumn}>
                <Text style={styles.statsNumberWarning}>{pendingCount}</Text>
                <Text style={styles.statsLabel}>Pending</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.orderHistoryButton}
              onPress={() => navigation.navigate('TrackOrder')}
            >
              <Text style={styles.orderHistoryButtonText}>View Order History</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionList}>
            <TouchableOpacity
              style={activeSectionKey === 'EditProfile' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => {
                setActiveSectionKey('EditProfile');
                navigation.navigate('EditProfile');
              }}
            >
              <Text style={activeSectionKey === 'EditProfile' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={activeSectionKey === 'Addresses' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => {
                setActiveSectionKey('Addresses');
                navigation.navigate('Addresses');
              }}
            >
              <Text style={activeSectionKey === 'Addresses' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Saved Addresses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={activeSectionKey === 'Billing' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => {
                setActiveSectionKey('Billing');
                navigation.navigate('Billing');
              }}
            >
              <Text style={activeSectionKey === 'Billing' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Payment Methods</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={activeSectionKey === 'Wishlist' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => {
                setActiveSectionKey('Wishlist');
                navigation.navigate('Wishlist');
              }}
            >
              <Text style={activeSectionKey === 'Wishlist' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Favorites</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={activeSectionKey === 'Notifications' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => {
                setActiveSectionKey('Notifications');
                navigation.navigate('Notifications');
              }}
            >
              <Text style={activeSectionKey === 'Notifications' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={activeSectionKey === 'HelpSupport' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => {
                setActiveSectionKey('HelpSupport');
              }}
            >
              <Text style={activeSectionKey === 'HelpSupport' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Help & Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={activeSectionKey === 'TrackOrder' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => {
                setActiveSectionKey('TrackOrder');
                navigation.navigate('TrackOrder');
              }}
            >
              <Text style={activeSectionKey === 'TrackOrder' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Track Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={activeSectionKey === 'BecomeSeller' ? styles.sectionItemHighlighted : styles.sectionItem}
              onPress={() => navigation.navigate('BrandOnboarding')}
            >
              <Text style={activeSectionKey === 'BecomeSeller' ? styles.sectionItemHighlightedLabel : styles.sectionItemLabel}>Become a Seller</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              try {
                await supabase.auth.signOut();
              } catch (e) {
              }
              clearAuthUser();
              setUserProfile({ name: '', email: '' });
              setUserType('customer');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            }}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>My Profile</Text>

        {__DEV__ && (
          <View style={styles.roleSwitcherRow}>
            <Text style={styles.roleLabel}>Account type:</Text>
            <View style={styles.roleButtonsRow}>
              <Text
                style={userType === 'customer' ? styles.roleButtonActive : styles.roleButton}
                onPress={() => setUserType('customer')}
              >
                Customer
              </Text>
              <Text
                style={userType === 'brand' ? styles.roleButtonActive : styles.roleButton}
                onPress={() => setUserType('brand')}
              >
                Brand
              </Text>
            </View>
          </View>
        )}

        {userType !== 'brand' && authRole !== 'admin' && (
          <TouchableOpacity
            style={styles.brandButton}
            onPress={() => navigation.navigate('BrandOnboarding')}
          >
            <Text style={styles.brandButtonText}>Become a Brand</Text>
          </TouchableOpacity>
        )}

        {authRole === 'brand' && (
          <>
            <TouchableOpacity
              style={styles.brandButton}
              onPress={() => navigation.navigate('BrandOnboarding')}
            >
              <Text style={styles.brandButtonText}>Edit Brand Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.brandButton}
              disabled={!brandId || brandLoading}
              onPress={() => {
                console.log('[ProfileScreen] CreateAnnouncement pressed, brandId:', brandId, typeof brandId);
                if (!brandId) return;
                navigation.navigate('CreateAnnouncement', { brandId });
              }}
            >
              <Text style={styles.brandButtonText}>
                {brandLoading ? 'Loading brand...' : 'Create Announcement'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {authEmail === ADMIN_EMAIL && (
          <>
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => navigation.navigate('AdminBrands')}
            >
              <Text style={styles.adminButtonText}>Admin: Manage Brands</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => navigation.navigate('AdminProducts')}
            >
              <Text style={styles.adminButtonText}>Admin: Manage Products</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => navigation.navigate('AdminCustomers')}
            >
              <Text style={styles.adminButtonText}>Admin: Manage Customers</Text>
            </TouchableOpacity>
          </>
        )}

        {authRole !== 'admin' && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Orders</Text>
                <Text style={styles.statValue}>{totalOrders}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Delivered</Text>
                <Text style={styles.statValue}>{deliveredCount}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={styles.statValue}>{pendingCount}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Spent</Text>
                <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Order History</Text>

            {myOrders.length === 0 ? (
              <Text style={styles.emptyText}>You have no orders yet.</Text>
            ) : (
              <View style={{ paddingBottom: 24 }}>
                {myOrders.map((item, index) => (
                  <React.Fragment key={`${item.id}-${index}`}>{renderItem({ item })}</React.Fragment>
                ))}
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            try {
              await supabase.auth.signOut();
            } catch (e) {
            }
            clearAuthUser();
            setUserProfile({ name: '', email: '' });
            setUserType('customer');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Welcome' }],
            });
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  roleSwitcherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  roleLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  roleButtonsRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    padding: 2,
  },
  roleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
  roleButtonActive: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    color: '#EFF6FF',
    fontWeight: '600',
    fontSize: 14,
  },
  brandButton: {
    marginTop: 40,
    marginBottom: 30,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    backgroundColor: '#2563EB',
  },
  brandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EFF6FF',
  },
  adminButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 30,
    borderColor: '#EFF6FF',
    backgroundColor: '#2563EB',
  },
  adminButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#9ca3af',
  },
  logoutButton: {
    marginTop: 24,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  headerBackground: {
    backgroundColor: '#2563EB',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
  },
  headerTextBlock: {
    flex: 1,
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerEmail: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 4,
  },
  headerSubText: {
    fontSize: 12,
    color: '#BFDBFE',
    marginTop: 2,
  },
  profileCardWrapper: {
    marginTop: -24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  statsCardRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statsColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statsDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  statsNumberPrimary: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  statsNumberSuccess: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16A34A',
  },
  statsNumberWarning: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F97316',
  },
  statsLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  orderHistoryButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderHistoryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionList: {
    marginTop: 16,
  },
  sectionItem: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionItemLabel: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  sectionItemHighlighted: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  sectionItemHighlightedLabel: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  orderHistorySection: {
    marginTop: 16,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  orderMeta: {
    marginTop: 4,
    color: '#6b7280',
    marginBottom: 8,
  },
  orderMetaBold: {
    fontWeight: '700',
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statusDelivered: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  statusPending: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
  },
  orderItemsList: {
    marginTop: 8,
  },
  orderItemLine: {
    fontSize: 13,
    color: '#4b5563',
  },
  orderItemMore: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  extraRow: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  extraLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 4,
  },
  extraValue: {
    fontSize: 13,
    color: '#111827',
  },
  extraAddress: {
    marginTop: 4,
  },
  extraAddressText: {
    fontSize: 12,
    color: '#4b5563',
  },
});
