import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
  Dimensions,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/store';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  Calendar,
  DollarSign,
  MapPin,
  Phone,
  MessageSquare,
  Download,
  RefreshCw,
  Filter,
  Search,
  Home,
  User,
  Store,
  Star,
  TrendingUp,
  Box,
  CreditCard,
  ShoppingBag,
  ArrowRight,
  Bell,
  Settings,
  Heart,
  Share2,
  MoreVertical,
  ChevronDown,
  X,
  Zap,
  Shield,
  Award,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';
const SUCCESS_COLOR = '#10B981';
const WARNING_COLOR = '#F59E0B';
const ERROR_COLOR = '#EF4444';
const INFO_COLOR = '#3B82F6';

const TrackOrderScreen = () => {
  const navigation = useNavigation();
  const authUserId = useStore((state) => state.authUserId);

  const [ordersList, setOrdersList] = useState([]);
  const [ordersListLoading, setOrdersListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const loadOrdersList = useCallback(async () => {
    if (!authUserId) return;
    try {
      setOrdersListLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, total, placed_at, items, shipping_method')
        .eq('customer_user_id', authUserId)
        .order('placed_at', { ascending: false });

      if (error) {
        console.warn('TrackOrder: error loading orders list', error.message || error);
        setOrdersList([]);
        return;
      }

      const mapped = Array.isArray(data)
        ? data.map((row) => {
            const raw = (row.status || 'pending').toLowerCase();

            let normalizedStatus = 'pending';
            let statusColor = WARNING_COLOR;
            let statusIcon = <Clock size={16} color={WARNING_COLOR} />;
            
            if (raw === 'delivered' || raw === 'customer_confirmed') {
              normalizedStatus = 'delivered';
              statusColor = SUCCESS_COLOR;
              statusIcon = <CheckCircle size={16} color={SUCCESS_COLOR} />;
            } else if (raw === 'declined' || raw === 'canceled' || raw === 'cancelled') {
              normalizedStatus = 'canceled';
              statusColor = ERROR_COLOR;
              statusIcon = <AlertCircle size={16} color={ERROR_COLOR} />;
            } else if (raw === 'shipped' || raw === 'on_the_way') {
              normalizedStatus = 'shipped';
              statusColor = INFO_COLOR;
              statusIcon = <Truck size={16} color={INFO_COLOR} />;
            }

            return {
              id: row.id,
              status: normalizedStatus,
              rawStatus: raw,
              total: Number(row.total) || 0,
              placedAt: row.placed_at ? new Date(row.placed_at).toLocaleDateString() : '',
              placedAtFull: row.placed_at ? new Date(row.placed_at) : null,
              items: Array.isArray(row.items) ? row.items : [],
              trackingNumber: null,
              sellerName: null,
              shippingMethod: row.shipping_method || null,
              statusColor,
              statusIcon,
            };
          })
        : [];

      setOrdersList(mapped);
    } catch (e) {
      console.warn('TrackOrder: exception loading orders list', e.message || e);
      setOrdersList([]);
    } finally {
      setOrdersListLoading(false);
    }
  }, [authUserId]);

  useFocusEffect(
    useCallback(() => {
      loadOrdersList();
    }, [loadOrdersList]),
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return [];

    let filtered = ordersList;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((o) => 
        o.id.toString().includes(query) ||
        o.items.some(item => item.name?.toLowerCase().includes(query))
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      if (dateFilter !== 'all') {
        filtered = filtered.filter(o => 
          o.placedAtFull && o.placedAtFull >= filterDate
        );
      }
    }

    return filtered;
  }, [ordersList, statusFilter, searchQuery, dateFilter]);

  const getStatusGradient = (status) => {
    switch (status) {
      case 'delivered':
        return ['#10B981', '#059669'];
      case 'shipped':
        return ['#3B82F6', '#1D4ED8'];
      case 'canceled':
        return ['#EF4444', '#DC2626'];
      default:
        return ['#F59E0B', '#D97706'];
    }
  };

  const renderOrderCard = ({ item, index }) => {
    const itemCount = Array.isArray(item.items) ? item.items.length : 0;
    const firstItems = Array.isArray(item.items) ? item.items.slice(0, 2) : [];
    const isSelected = item.id === selectedOrderId;
    const [gradientStart, gradientEnd] = getStatusGradient(item.status);

    return (
      <Animated.View
        style={[
          styles.orderCardWrapper,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.orderCard,
            isSelected && styles.orderCardSelected,
            { borderLeftColor: item.statusColor }
          ]}
          activeOpacity={0.8}
          onPress={() => {
            setSelectedOrderId(item.id);
            navigation.navigate('SimpleOrderTracking', { orderId: item.id });
          }}
        >
          <View style={[styles.statusBar, { backgroundColor: gradientStart }]}>
            <View style={styles.statusLeft}>
              {item.statusIcon}
              <Text style={styles.statusText}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
            </View>
            <Text style={styles.orderId}>#{item.id}</Text>
          </View>

          <View style={styles.orderContent}>
            <View style={styles.orderHeader}>
              <View style={styles.orderInfo}>
                <View style={styles.dateContainer}>
                  <Calendar size={14} color="#6B7280" />
                  <Text style={styles.orderDate}>{item.placedAt}</Text>
                </View>
                <Text style={styles.itemCount}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
              </View>
              <TouchableOpacity style={styles.moreButton}>
                <MoreVertical size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {firstItems.length > 0 && (
              <View style={styles.itemsPreview}>
                {firstItems.map((prod, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={styles.itemImagePlaceholder}>
                      <ShoppingBag size={16} color={BRAND_COLOR} />
                    </View>
                    <View style={styles.itemDetails}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {prod.name || 'Item'}
                      </Text>
                      <Text style={styles.itemQuantity}>Qty: {prod.quantity || 1}</Text>
                    </View>
                    <Text style={styles.itemPrice}>
                      ${((prod.price || 0) * (prod.quantity || 1)).toFixed(2)}
                    </Text>
                  </View>
                ))}
                {itemCount > 2 && (
                  <View style={styles.moreItemsContainer}>
                    <Text style={styles.moreItemsText}>+{itemCount - 2} more items</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.orderFooter}>
              <View style={styles.priceSection}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <View style={styles.priceRow}>
                  <DollarSign size={18} color={BRAND_COLOR} />
                  <Text style={styles.totalAmount}>{item.total.toFixed(2)}</Text>
                </View>
              </View>
              <View style={styles.actionSection}>
                {item.shippingMethod && (
                  <View style={styles.shippingBadge}>
                    <Truck size={12} color={BRAND_COLOR} />
                    <Text style={styles.shippingText}>{item.shippingMethod}</Text>
                  </View>
                )}
                <ArrowRight size={20} color={BRAND_COLOR} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const orderStats = useMemo(() => {
    const total = ordersList.length;
    const delivered = ordersList.filter(o => o.status === 'delivered').length;
    const pending = ordersList.filter(o => o.status === 'pending').length;
    const shipped = ordersList.filter(o => o.status === 'shipped').length;
    const totalSpent = ordersList.reduce((sum, o) => sum + o.total, 0);

    return { total, delivered, pending, shipped, totalSpent };
  }, [ordersList]);

  const filterOptions = [
    { id: 'all', label: 'All Orders', color: BRAND_COLOR, icon: <Package size={18} color="#FFFFFF" /> },
    { id: 'pending', label: 'Pending', color: WARNING_COLOR, icon: <Clock size={18} color="#FFFFFF" /> },
    { id: 'shipped', label: 'Shipped', color: INFO_COLOR, icon: <Truck size={18} color="#FFFFFF" /> },
    { id: 'delivered', label: 'Delivered', color: SUCCESS_COLOR, icon: <CheckCircle size={18} color="#FFFFFF" /> },
    { id: 'canceled', label: 'Canceled', color: ERROR_COLOR, icon: <AlertCircle size={18} color="#FFFFFF" /> },
  ];

  const dateFilterOptions = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_COLOR} />
      
      <Animated.View 
        style={[
          styles.header, 
          { 
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }]
          }
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>My Orders</Text>
            <Text style={styles.headerSubtitle}>Track and manage your orders</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Bell size={24} color="#FFFFFF" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.View style={[styles.quickStatsContainer, { opacity: fadeAnim }]}>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Package size={20} color={BRAND_COLOR} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{orderStats.total}</Text>
              <Text style={styles.statLabel}>Total Orders</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <CheckCircle size={20} color={SUCCESS_COLOR} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{orderStats.delivered}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <TrendingUp size={20} color={ACCENT_COLOR} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>${orderStats.totalSpent.toFixed(0)}</Text>
              <Text style={styles.statLabel}>Total Spent</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.searchFilterContainer, { opacity: fadeAnim }]}>
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={20} color="#6B7280" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search orders by ID or items..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} color={showFilters ? "#FFFFFF" : BRAND_COLOR} />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <Animated.View style={styles.filtersPanel}>
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {filterOptions.map((option) => {
                  const isActive = statusFilter === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.filterChip,
                        { backgroundColor: isActive ? option.color : '#F3F4F6' }
                      ]}
                      onPress={() => setStatusFilter(option.id)}
                    >
                      {option.icon}
                      <Text style={[
                        styles.filterChipText,
                        { color: isActive ? '#FFFFFF' : '#374151' }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Date Range</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {dateFilterOptions.map((option) => {
                  const isActive = dateFilter === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.dateChip,
                        { backgroundColor: isActive ? BRAND_COLOR : '#F3F4F6' }
                      ]}
                      onPress={() => setDateFilter(option.id)}
                    >
                      <Text style={[
                        styles.dateChipText,
                        { color: isActive ? '#FFFFFF' : '#374151' }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        )}
      </Animated.View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {ordersListLoading && ordersList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BRAND_COLOR} />
            <Text style={styles.loadingText}>Loading your orders...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Package size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || statusFilter !== 'all' || dateFilter !== 'all' 
                ? 'Try adjusting your filters or search' 
                : 'Start shopping to see your orders here'
              }
            </Text>
            <TouchableOpacity 
              style={styles.shopNowButton}
              onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            >
              <ShoppingBag size={18} color="#FFFFFF" />
              <Text style={styles.shopNowText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredOrders}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderOrderCard}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default TrackOrderScreen;

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_COLOR,
  },
  quickStatsContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  searchFilterContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: BRAND_COLOR,
  },
  filtersPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  orderCardWrapper: {
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: BRAND_COLOR,
  },
  orderCardSelected: {
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.2,
    elevation: 6,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BRAND_COLOR,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orderId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  orderContent: {
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderInfo: {
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  itemCount: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  moreButton: {
    padding: 4,
  },
  itemsPreview: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  moreItemsContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  moreItemsText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shippingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  shippingText: {
    fontSize: 11,
    color: BRAND_COLOR,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
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
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  shopNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  shopNowText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
