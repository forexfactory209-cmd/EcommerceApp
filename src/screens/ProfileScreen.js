import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import {
  User,
  Package,
  MapPin,
  Store,
  HelpCircle,
  AlertCircle,
  FileText,
  ShieldCheck,
  LogOut as LogOutIcon,
  ShoppingBag,
  Truck,
  Clock3,
  DollarSign,
  Settings,
  ChevronRight,
  Wallet,
  ArrowLeft as BackIcon,
  Edit3 as EditIcon,
} from 'lucide-react-native';

const ProfileScreen = ({ navigation }) => {
  const orders = useStore((state) => state.orders);
  const userType = useStore((state) => state.userType);
  const authEmail = useStore((state) => state.authEmail);
  const authRole = useStore((state) => state.authRole);
  const authUserId = useStore((state) => state.authUserId);
  const userProfile = useStore((state) => state.userProfile);
  const seenDeliveredOrdersCount = useStore((state) => state.seenDeliveredOrdersCount || 0);
  const setSeenDeliveredOrdersCount = useStore((state) => state.setSeenDeliveredOrdersCount);
  const setUserType = useStore((state) => state.setUserType);
  const setUserProfile = useStore((state) => state.setUserProfile);
  const clearAuthUser = useStore((state) => state.clearAuthUser);

  const [brandId, setBrandId] = useState(null);
  const [brandLoading, setBrandLoading] = useState(true);

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

  // Ensure customer profile data (name, username, avatar_url, etc.) is loaded
  // into the global store so the header can show it without requiring a
  // round-trip through the Edit Profile screen.
  useEffect(() => {
    const loadCustomerProfile = async () => {
      if (!authUserId || authRole === 'brand') return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, username, gender, dob, country, city, district, address, address_descr, avatar_url')
          .eq('user_id', authUserId)
          .maybeSingle();

        if (error) {
          console.warn('Error loading customer profile for header:', error.message || error);
          return;
        }

        if (data) {
          setUserProfile({
            name: data.name || '',
            username: data.username || '',
            email: authEmail || '',
            gender: data.gender || '',
            dob: data.dob || '',
            country: data.country || '',
            city: data.city || '',
            district: data.district || '',
            address: data.address || '',
            address_descr: data.address_descr || '',
            avatar_url: data.avatar_url || null,
          });
        }
      } catch (e) {
        console.warn('Unexpected error loading customer profile for header:', e.message || e);
      }
    };

    loadCustomerProfile();
  }, [authUserId, authRole, authEmail, setUserProfile]);

  const myOrders =
    userType === 'brand' && authUserId
      ? orders.filter((o) => o.brand_user_id === authUserId)
      : orders;

  const totalOrders = myOrders.length;
  const deliveredCount = myOrders.filter((o) => o.status === 'Delivered').length;
  const pendingCount = myOrders.filter((o) => o.status !== 'Delivered').length;
  const totalSpent = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const unseenDeliveredCount = Math.max(deliveredCount - (seenDeliveredOrdersCount || 0), 0);

  const displayName =
    userProfile?.name?.trim() || userProfile?.username?.trim() || 'Guest User';
  const displayEmail = userProfile?.email || authEmail || 'No email';

  const ADMIN_EMAIL = 'caliaxmed488@gmail.com'; // Change to your admin email

  const [showAllOrders, setShowAllOrders] = useState(false);

  const latestThreeOrders = myOrders.slice(0, 3);
  const displayedOrders = showAllOrders ? myOrders : latestThreeOrders;

  const OrderCard = React.memo(({ item }) => (
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
  ));

  const renderItem = ({ item }) => <OrderCard item={item} />;

  if (userType === 'customer' && authRole !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        {/* Top section with image and dark blue overlay like signup */}
        <View style={styles.topSection}>
          {/* Background image */}
          <Image 
            source={require('../../assets/photo1.jpg')} // Using existing image
            style={styles.backgroundImage}
            resizeMode="cover"
          />
          
          {/* Dark blue overlay */}
          <View style={styles.blueOverlay} />

          {/* Profile content in top section */}
          <View style={styles.topContent}>
            <View style={styles.profileHeader}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <BackIcon size={24} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
                <EditIcon size={20} color="#FBBF24" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfoSection}>
              <View style={styles.profileCard}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatarCircle}>
                    {userProfile?.avatar_url ? (
                      <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={styles.avatarText}>{displayName?.[0]?.toUpperCase() || 'A'}</Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.editBadge} onPress={() => navigation.navigate('EditProfile')}>
                    <EditIcon size={12} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.userInfoContainer}>
                  <Text style={styles.userName}>{displayName}</Text>
                  <Text style={styles.userEmail}>{displayEmail}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Bottom white section with curved top like signup */}
        <View style={styles.bottomSection}>
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Account Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>Account</Text>
                </View>
                <View style={styles.sectionHeaderLine} />
              </View>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('EditProfile')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <User size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>Profile Settings</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => {
                setSeenDeliveredOrdersCount(deliveredCount);
                navigation.navigate('TrackOrder');
              }}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <Package size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>My Orders</Text>
                </View>
                {unseenDeliveredCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unseenDeliveredCount}</Text>
                  </View>
                )}
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Addresses')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <MapPin size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>Saved Addresses</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('FollowedStores')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <Store size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>Followed Stores</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Support Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>Support</Text>
                </View>
                <View style={styles.sectionHeaderLine} />
              </View>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('HelpFAQ')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <HelpCircle size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>FAQ</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ReportProblem')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <AlertCircle size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>Report a Problem</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ContactSupport')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <HelpCircle size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>Contact Support</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Legal Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLine} />
                <View style={styles.sectionTitleContainer}>
                  <Text style={styles.sectionTitle}>Legal</Text>
                </View>
                <View style={styles.sectionHeaderLine} />
              </View>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('TermsConditions')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <FileText size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>Terms & Conditions</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('PrivacyPolicy')}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconCircle, styles.iconPurple]}>
                    <ShieldCheck size={18} color="#ffffff" />
                  </View>
                  <Text style={styles.menuText}>Privacy & Policy</Text>
                </View>
                <ChevronRight size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Logout Button */}
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
              <LogOutIcon size={18} color="#FBBF24" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  const isBrandRole = authRole === 'brand';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.mainContent}>
        <View>
          <Text style={styles.title}>{isBrandRole ? 'Brand Role Profile' : 'My Profile'}</Text>

          {!isBrandRole && __DEV__ && (
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

          {!isBrandRole && userType !== 'brand' && authRole !== 'admin' && (
            <TouchableOpacity
              style={styles.brandButton}
              onPress={() => navigation.navigate('BrandOnboarding')}
            >
              <Text style={styles.brandButtonText}>Become a Brand</Text>
            </TouchableOpacity>
          )}

          {isBrandRole && (
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

          {!isBrandRole && authEmail === ADMIN_EMAIL && (
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
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => navigation.navigate('AdminSupportTickets')}
              >
                <Text style={styles.adminButtonText}>Admin: Customer Reports</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => navigation.navigate('AdminOrders')}
              >
                <Text style={styles.adminButtonText}>Admin: Manage Orders</Text>
              </TouchableOpacity>
            </>
          )}

          {authRole !== 'admin' && (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statIconWrapper}>
                    <View style={[styles.iconCircle, styles.iconCircleGray]}>
                      <ShoppingBag size={16} color="#4B5563" />
                    </View>
                  </View>
                  <Text style={styles.statLabel}>Total Orders</Text>
                  <Text style={styles.statValue}>{totalOrders}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statIconWrapper}>
                    <View style={[styles.iconCircle, styles.iconCircleGray]}>
                      <Truck size={16} color="#4B5563" />
                    </View>
                  </View>
                  <Text style={styles.statLabel}>Delivered</Text>
                  <Text style={styles.statValue}>{deliveredCount}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statIconWrapper}>
                    <View style={[styles.iconCircle, styles.iconCircleGray]}>
                      <Clock3 size={16} color="#4B5563" />
                    </View>
                  </View>
                  <Text style={styles.statLabel}>Pending</Text>
                  <Text style={styles.statValue}>{pendingCount}</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statIconWrapper}>
                    <View style={[styles.iconCircle, styles.iconCircleGray]}>
                      <DollarSign size={16} color="#4B5563" />
                    </View>
                  </View>
                  <Text style={styles.statLabel}>Total Spent</Text>
                  <Text style={styles.statValue}>${totalSpent.toFixed(0)}</Text>
                </View>
              </View>

              {!isBrandRole && (
                <>
                  <View style={styles.orderHistoryHeaderRow}>
                    <Text style={styles.sectionTitle}>Order History</Text>
                    {myOrders.length > 3 && (
                      <TouchableOpacity
                        onPress={() => setShowAllOrders((prev) => !prev)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.seeAllText}>
                          {showAllOrders ? 'Show less' : 'See all'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {myOrders.length === 0 && (
                    <Text style={styles.emptyText}>You have no orders yet.</Text>
                  )}
                </>
              )}
            </>
          )}
        </View>

        {authRole !== 'admin' && !isBrandRole && myOrders.length > 0 && (
          <View style={styles.ordersListContainer}>
            <FlatList
              data={displayedOrders}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              initialNumToRender={6}
              windowSize={5}
              maxToRenderPerBatch={10}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          </View>
        )}
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
    </SafeAreaView>
  );
}

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  // Top section with image and dark blue overlay like signup
  topSection: {
    height: '45%',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  blueOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 9, 102, 0.85)',
  },
  
  // Content in top section
  topContent: {
    position: 'absolute',
    top: 50,
    left: 25,
    right: 25,
    bottom: 30,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  profileInfoSection: {
    alignItems: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 16,
    backdropFilter: 'blur(15px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 18,
  },
  avatarCircle: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 29.5,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#090966',
    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  userInfoContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
    letterSpacing: 0.6,
  },
  userEmail: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  
  // Bottom white section with curved top like signup
  bottomSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    paddingTop: 40,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20, // Same as home screen
  },
  
  // Sections
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#e5e7eb',
    transform: [{ skewX: '-15deg' }], // Angled lines
  },
  sectionTitleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#090966', // Primary color
    borderRadius: 8, // Small rounding
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FBBF24', // Secondary color (yellow)
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginBottom: 8,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconPurple: {
    backgroundColor: '#090966',
  },
  menuText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#090966',
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 10,
  },
  badgeText: {
    color: '#090966', // Primary color
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Logout button with brand colors
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a015c', // Deep purple brand color
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 30,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff', // White text on dark background
  },
});
