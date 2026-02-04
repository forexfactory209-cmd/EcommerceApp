import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../store/store';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
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
  Star,
  Settings,
  MessageSquare,
  BarChart3,
  Bell,
  Lock,
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
  const setOrders = useStore((state) => state.setOrders);

  const [brandId, setBrandId] = useState(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [brandProfile, setBrandProfile] = useState(null);

  useEffect(() => {
    const loadBrandForProfile = async () => {
      try {
        console.log('[ProfileScreen] Loading brand for authUserId:', authUserId, 'authRole:', authRole);
        if (!authUserId || authRole !== 'brand') {
          console.log('[ProfileScreen] Not a brand user, setting brandId to null');
          setBrandId(null);
          setBrandProfile(null);
          return;
        }

        const { data, error } = await supabase
          .from('brands')
          .select('id,name,logo_url,rating_average,rating_count,followers_count,created_at')
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
        if (data) {
          setBrandProfile({
            id: data.id,
            name: data.name || null,
            logo_url: data.logo_url || null,
            rating_average: typeof data.rating_average === 'number' ? data.rating_average : null,
            rating_count: typeof data.rating_count === 'number' ? data.rating_count : 0,
            followers_count:
              typeof data.followers_count === 'number' && !Number.isNaN(data.followers_count)
                ? data.followers_count
                : 0,
            created_at: data.created_at || null,
          });
        } else {
          setBrandProfile(null);
        }
      } catch (e) {
        console.warn('Unexpected error loading brand for profile screen:', e.message || e);
        setBrandId(null);
        setBrandProfile(null);
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

  // For brand users, ensure global orders include the full history of orders
  // for this brand, derived from order_items joined to orders.
  useFocusEffect(
    useCallback(() => {
      if (!authUserId || authRole !== 'brand') return undefined;

      let isActive = true;

      const loadBrandOrders = async () => {
        try {
          const { data, error } = await supabase
            .from('order_items')
            .select(
              `
              id,
              order_id,
              product_id,
              brand_user_id,
              name,
              quantity,
              unit_price,
              color,
              size,
              delivery_type,
              image_url,
              orders:orders (
                id,
                subtotal,
                shipping,
                total,
                status,
                placed_at,
                payment_method,
                delivery_address,
                shipping_method,
                promo_code,
                customer_name,
                customer_phone,
                customer_secondary_phone,
                brand_accepted_at,
                on_the_way_at,
                delivered_at
              )
            `,
            )
            .eq('brand_user_id', authUserId)
            .order('order_id', { ascending: false });

          if (error) {
            console.warn('ProfileScreen: failed to load brand orders', error.message || error);
            return;
          }

          if (!isActive) return;

          const byOrderId = (data || []).reduce((acc, row) => {
            const o = row.orders;
            if (!o) return acc;

            const orderId = o.id;
            if (!acc[orderId]) {
              acc[orderId] = {
                id: orderId,
                items: [],
                subtotal: Number(o.subtotal) || 0,
                shipping: Number(o.shipping) || 0,
                total: Number(o.total) || 0,
                status: o.status || 'Pending',
                date: o.placed_at ? new Date(o.placed_at).toLocaleDateString() : '',
                brand_user_id: authUserId,
                payment_method: o.payment_method || 'cash_on_delivery',
                delivery_address: o.delivery_address || '',
                shipping_method: o.shipping_method || null,
                promo_code: o.promo_code || null,
                customer_name: o.customer_name || null,
                customer_phone: o.customer_phone || null,
                customer_secondary_phone: o.customer_secondary_phone || null,
                brand_accepted_at: o.brand_accepted_at || null,
                on_the_way_at: o.on_the_way_at || null,
                delivered_at: o.delivered_at || null,
              };
            }

            acc[orderId].items.push({
              id: row.product_id || row.id,
              name: row.name,
              quantity: row.quantity,
              price: row.unit_price,
              color: row.color,
              size: row.size,
              delivery_type: row.delivery_type,
              image: row.image_url,
            });

            return acc;
          }, {});

          const mapped = Object.values(byOrderId);
          setOrders(mapped);
        } catch (e) {
          console.warn('ProfileScreen: unexpected error loading brand orders', e.message || e);
        }
      };

      loadBrandOrders();

      return () => {
        isActive = false;
      };
    }, [authUserId, authRole, setOrders]),
  );

  const myOrders =
    userType === 'brand' && authUserId
      ? orders.filter((o) => o.brand_user_id === authUserId)
      : orders;

  const totalOrders = myOrders.length;
  const deliveredCount = myOrders.filter((o) => o.status === 'Delivered').length;
  const pendingCount = myOrders.filter((o) => o.status !== 'Delivered').length;
  const totalSpent = myOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  const brandRatingAvg =
    typeof brandProfile?.rating_average === 'number' && !Number.isNaN(brandProfile.rating_average)
      ? brandProfile.rating_average
      : null;
  const brandRatingCount =
    typeof brandProfile?.rating_count === 'number' && !Number.isNaN(brandProfile.rating_count)
      ? brandProfile.rating_count
      : 0;
  const followerCount =
    typeof brandProfile?.followers_count === 'number' && !Number.isNaN(brandProfile.followers_count)
      ? brandProfile.followers_count
      : 0;

  const brandDisplayName =
    (brandProfile?.name && brandProfile.name.trim()) ||
    (userProfile?.name && userProfile.name.trim()) ||
    'Brand Store';

  const brandLogoUrl = brandProfile?.logo_url || userProfile?.avatar_url || null;

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
      <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
        <View style={styles.headerBackground}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('EditProfile');
              }}
            >
              <Text style={styles.headerEditText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerAvatarSection}>
            <View style={styles.profileAvatarWrapper}>
              <View style={styles.avatarCircle}>
                {userProfile?.avatar_url ? (
                  <Image
                    source={{ uri: userProfile.avatar_url }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarInitial}>
                    {displayName?.[0]?.toUpperCase() || 'A'}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.avatarEditBadge}
                onPress={() => navigation.navigate('EditProfile')}
              >
                <Text style={styles.avatarEditBadgeText}>✎</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.headerName}>{displayName}</Text>
            <Text style={styles.headerEmail}>{displayEmail}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.profileScrollContent}>
          <View style={styles.profileSectionCard}>
            <TouchableOpacity
              style={styles.profileSectionRow}
              onPress={() => {
                navigation.navigate('EditProfile');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCirclePrimary]}>
                  <User size={18} color="#ffffff" />
                </View>
                <Text style={styles.profileSectionLabel}>Profile Settings</Text>
              </View>
              {/* <Text style={styles.profileSectionChevron}>{'>'}</Text> */}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileSectionRow}
              onPress={() => {
                setSeenDeliveredOrdersCount(deliveredCount);
                navigation.navigate('TrackOrder');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCirclePurple]}>
                  <Package size={18} color="#ffffff" />
                </View>
                <Text style={styles.profileSectionLabel}>My Orders</Text>
              </View>
              {unseenDeliveredCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unseenDeliveredCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileSectionRow}
              onPress={() => {
                navigation.navigate('Addresses');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCirclePrimaryLight]}>
                  <MapPin size={18} color="#ffffff" />
                </View>
                <Text style={styles.profileSectionLabel}>Saved Addresses</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileSectionRow, styles.profileSectionRowLast]}
              onPress={() => {
                navigation.navigate('FollowedStores');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCircleIndigo]}>
                  <Store size={18} color="#ffffff" />
                </View>
                <Text style={styles.profileSectionLabel}>Followed Stores</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.profileSectionCard}>
            <TouchableOpacity
              style={styles.profileSectionRow}
              onPress={() => {
                navigation.navigate('HelpFAQ');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCircleGray]}>
                  <HelpCircle size={18} color="#fff" />
                </View>
                <Text style={styles.profileSectionLabel}>FAQ</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileSectionRow}
              onPress={() => {
                navigation.navigate('ReportProblem');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCircleGray]}>
                  <AlertCircle size={18} color="#fff"/>
                </View>
                <Text style={styles.profileSectionLabel}>Report Problem</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileSectionRow}
              onPress={() => {
                navigation.navigate('ContactSupport');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCircleGray]}>
                  <HelpCircle size={18} color="#fff" />
                </View>
                <Text style={styles.profileSectionLabel}>Contact Support</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.profileSectionRow}
              onPress={() => {
                navigation.navigate('TermsConditions');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCircleGray]}>
                  <FileText size={18} color="#fff" />
                </View>
                <Text style={styles.profileSectionLabel}>Terms and Condition</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileSectionRow, styles.profileSectionRowLast]}
              onPress={() => {
                navigation.navigate('PrivacyPolicy');
              }}
            >
              <View style={styles.profileSectionLeft}>
                <View style={[styles.iconCircle, styles.iconCircleGray]}>
                  <ShieldCheck size={18} color="#fff" />
                </View>
                <Text style={styles.profileSectionLabel}>Privacy Policy</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.logoutFullWidthButton}
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
            <View style={styles.logoutContentRow}>
              <LogOutIcon size={18} color="#EF4444" />
              <Text style={styles.logoutFullWidthText}>Log Out</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.appVersionText}>App Version 2.4.0</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const isBrandRole = authRole === 'brand';

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore sign-out errors, we'll still clear local state
    }
    clearAuthUser();
    setUserProfile({ name: '', email: '' });
    setUserType('customer');
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  // --- Brand profile layout (for authRole === 'brand') ---
  if (isBrandRole) {
    return (
      <SafeAreaView style={styles.brandContainer} edges={['top', 'right', 'bottom', 'left']}>
        <ScrollView contentContainerStyle={styles.brandScrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          {/* <View style={styles.brandHeaderRow}>
            <Text style={styles.brandHeaderTitle}>Profile</Text>
            <TouchableOpacity style={styles.brandHeaderIconButton} onPress={() => navigation.navigate('BrandOnboarding')}>
              <Settings color="#0F172A" size={18} />
            </TouchableOpacity>
          </View> */}

          {/* Avatar + Name */}
          <View style={styles.brandAvatarSection}>
            <View style={styles.brandAvatarWrapper}>
              <View style={styles.brandAvatarCircle}>
                {brandLogoUrl ? (
                  <Image source={{ uri: brandLogoUrl }} style={styles.brandAvatarImage} />
                ) : (
                  <Text style={styles.brandAvatarInitial}>
                    {(brandDisplayName || 'B').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.brandAvatarBadge}>
                <Text style={styles.brandAvatarBadgeText}>✓</Text>
              </View>
            </View>
            <Text style={styles.brandNameTitle}>{brandDisplayName}</Text>
            <View style={styles.brandTagRow}>
              <View style={styles.brandTagPill}>
                <Text style={styles.brandTagPillText}>Trusted Seller</Text>
              </View>
              <Text style={styles.brandTagMeta}>
                {brandProfile?.created_at ? ` · Since ${new Date(brandProfile.created_at).getFullYear()}` : ''}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.brandStatsCardsRow}>
            <View style={styles.brandStatCard}>
              <Text style={styles.brandStatValue}>
                {brandRatingAvg != null ? brandRatingAvg.toFixed(1) : '0.0'}
              </Text>
              <Text style={styles.brandStatLabel}>
                Rating{brandRatingCount ? ` • ${brandRatingCount}` : ''}
              </Text>
            </View>
            <View style={styles.brandStatCard}>
              <Text style={styles.brandStatValue}>{followerCount}</Text>
              <Text style={styles.brandStatLabel}>Followers</Text>
            </View>
            <View style={styles.brandStatCard}>
              <Text style={styles.brandStatValue}>{totalOrders}</Text>
              <Text style={styles.brandStatLabel}>Orders</Text>
            </View>
          </View>

          {/* STORE & BUSINESS */}
          <View style={styles.brandSectionGroup}>
            <Text style={styles.brandSectionLabel}>STORE & BUSINESS</Text>
            <View style={styles.brandSectionCard}>
              <TouchableOpacity
                style={styles.brandRow}
                onPress={() => navigation.navigate('BrandOnboarding')}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <Store size={18} color="#11126F" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Store Profile</Text>
                    <Text style={styles.brandRowSubtitle}>Manage logo, banner, and description</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.brandRow}
                onPress={() => {
                  if (brandId) {
                    navigation.navigate('Brand', { brandId });
                  }
                }}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#ECFEFF' }]}>
                    <Store size={18} color="#0369A1" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Store Preview</Text>
                    <Text style={styles.brandRowSubtitle}>View as customer</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.brandRow, styles.brandRowLast]}>
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#F5F3FF' }]}>
                    <FileText size={18} color="#4C1D95" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Business Information</Text>
                    <Text style={styles.brandRowSubtitle}>Legal and tax details</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* PERFORMANCE */}
          <View style={styles.brandSectionGroup}>
            <Text style={styles.brandSectionLabel}>PERFORMANCE</Text>
            <View style={styles.brandSectionCard}>
              <TouchableOpacity
                style={styles.brandRow}
                onPress={() => navigation.navigate('BrandReviews')}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#FEF9C3' }]}>
                    <Star size={18} color="#CA8A04" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Reviews & Ratings</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.brandRow, styles.brandRowLast]}
                onPress={() => navigation.navigate('BrandAnalytics')}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <BarChart3 size={18} color="#11126F" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Analytics</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* COMMUNICATION */}
          <View style={styles.brandSectionGroup}>
            <Text style={styles.brandSectionLabel}>COMMUNICATION</Text>
            <View style={styles.brandSectionCard}>
              <TouchableOpacity
                style={styles.brandRow}
                onPress={() => navigation.navigate('BrandQA')}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#ECFEFF' }]}>
                    <MessageSquare size={18} color="#0369A1" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Q/A</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.brandRow, styles.brandRowLast]}
                onPress={() => navigation.navigate('BrandDisputes')}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#FEF2F2' }]}>
                    <AlertCircle size={18} color="#B91C1C" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Disputes & Support</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ACCOUNT & SECURITY */}
          {/* <View style={styles.brandSectionGroup}>
            <Text style={styles.brandSectionLabel}>ACCOUNT & SECURITY</Text>
            <View style={styles.brandSectionCard}>
              <TouchableOpacity
                style={styles.brandRow}
                onPress={() => navigation.navigate('EditProfile')}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <User size={18} color="#11126F" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Account Settings</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.brandRow}>
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Bell size={18} color="#1D4ED8" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Notification Settings</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.brandRow, styles.brandRowLast]}>
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <Lock size={18} color="#11126F" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Security</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View> */}

          {/* LEGAL */}
          <View style={styles.brandSectionGroup}>
            <Text style={styles.brandSectionLabel}>LEGAL</Text>
            <View style={styles.brandSectionCard}>
              <TouchableOpacity
                style={styles.brandRow}
                onPress={() => navigation.navigate('TermsConditions')}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#EEF2FF' }]}>
                    <FileText size={18} color="#11126F" />
                  </View>
                  <View>
                    <Text style={styles.brandRowTitle}>Terms & Policies</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.brandRow, styles.brandRowLast]}
                onPress={handleLogout}
              >
                <View style={styles.brandRowLeft}>
                  <View style={[styles.brandIconCircle, { backgroundColor: '#FEF2F2' }]}>
                    <LogOutIcon size={18} color="#B91C1C" />
                  </View>
                  <View>
                    <Text style={[styles.brandRowTitle, { color: '#B91C1C' }]}>Log out</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.brandVersionText}>Version 2.4.0 (Build 302)</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
        onPress={handleLogout}
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
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  mainContent: {
    flex: 1,
    paddingTop: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 24,
  },
  settingsGroup: {
    marginBottom: 24,
  },
  settingsGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  settingsRowChevron: {
    fontSize: 18,
    color: '#D1D5DB',
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
  orderHistoryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#9ca3af',
  },
  ordersListContainer: {
    flex: 1,
    marginTop: 4,
  },
  logoutButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignSelf: 'center',
    marginBottom: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  // --- Brand profile styles ---
  brandContainer: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  brandScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  brandHeaderIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  brandAvatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandAvatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#11126F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  brandAvatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandAvatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarBadgeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  brandNameTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  brandTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  brandTagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E0E7FF',
  },
  brandTagPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#11126F',
  },
  brandTagMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  brandStatsCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  brandStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  brandStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  brandStatLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  brandSectionGroup: {
    marginTop: 16,
  },
  brandSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  brandSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  brandRowLast: {
    borderBottomWidth: 0,
  },
  brandRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandRowTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  brandRowSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  brandVersionText: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  headerBackground: {
    backgroundColor: '#090966',
    paddingTop: 14,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 32,
    height: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSideSpacer: {
    width: 32,
    height: 20,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  // headerBackIcon: {
  //   color: '#ffffff',
  //   fontSize: 18,
  //   fontWeight: '600',
  // },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerEditText: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '500',
  },
  headerAvatarSection: {
    marginTop: 28,
    alignItems: 'center',
  },
  profileAvatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 16,
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
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadgeText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
  },
  profileScrollContent: {
    paddingTop: 20,
    paddingHorizontal: 4,
    paddingBottom: 32,
  },
  profileSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap:10,
  },
  profileSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  profileSectionRowLast: {
    borderBottomWidth: 0,
  },
  profileSectionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileSectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 12,
  },
  profileSectionChevron: {
    fontSize: 18,
    color: '#D1D5DB',
    marginLeft: 8,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCirclePrimary: {
    backgroundColor:  '#312E81',
  },
  iconCirclePurple: {
    backgroundColor:  '#312E81',
  },
  iconCirclePrimaryLight: {
    backgroundColor:  '#312E81',
  },
  iconCircleIndigo: {
    backgroundColor: '#312E81',
  },
  iconCircleGray: {
    backgroundColor:  '#312E81',
  },
  logoutFullWidthButton: {
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  logoutContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutFullWidthText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  appVersionText: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
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
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
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
