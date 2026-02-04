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
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const BRAND_COLOR = '#090966';
const ACCENT_COLOR = '#FBBF24';

const TrackOrderScreen = () => {
  const navigation = useNavigation();
  const authUserId = useStore((state) => state.authUserId);

  const [ordersList, setOrdersList] = useState([]);
  const [ordersListLoading, setOrdersListLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
            if (raw === 'delivered' || raw === 'customer_confirmed') {
              normalizedStatus = 'delivered';
            } else if (raw === 'declined' || raw === 'canceled' || raw === 'cancelled') {
              normalizedStatus = 'canceled';
            } else if (raw === 'shipped' || raw === 'on_the_way') {
              normalizedStatus = 'shipped';
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
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return [];

    let filtered = ordersList;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((o) => 
        o.id.toString().includes(query) ||
        o.items.some(item => item.name?.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [ordersList, statusFilter, searchQuery]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle size={20} color="#22C55E" />;
      case 'shipped':
        return <Truck size={20} color="#3B82F6" />;
      case 'canceled':
        return <AlertCircle size={20} color="#EF4444" />;
      default:
        return <Clock size={20} color="#F59E0B" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered':
        return '#22C55E';
      case 'shipped':
        return '#3B82F6';
      case 'canceled':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const renderOrderCard = ({ item }) => {
    const itemCount = Array.isArray(item.items) ? item.items.length : 0;
    const firstItems = Array.isArray(item.items) ? item.items.slice(0, 2) : [];
    const isSelected = item.id === selectedOrderId;

    return (
      <TouchableOpacity
        style={[styles.orderCard, isSelected && styles.orderCardSelected]}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedOrderId(item.id);
          navigation.navigate('SimpleOrderTracking', { orderId: item.id });
        }}
      >
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <View style={styles.orderIconContainer}>
              <Package size={24} color={BRAND_COLOR} />
            </View>
            <View style={styles.orderTitleContainer}>
              <Text style={styles.orderNumber}>Order #{item.id}</Text>
              <Text style={styles.orderDate}>{item.placedAt}</Text>
            </View>
          </View>
          <View style={styles.orderHeaderRight}>
            {getStatusIcon(item.status)}
            <Text style={[styles.orderStatus, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Items Preview */}
        {firstItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.itemsLabel}>Items</Text>
            <View style={styles.itemsList}>
              {firstItems.map((prod, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <Box size={16} color="#6B7280" style={{ marginRight: 8 }} />
                  <Text style={styles.itemText}>
                    {prod.quantity || 1}x {prod.name || 'Item'}
                  </Text>
                </View>
              ))}
              {itemCount > 2 && (
                <Text style={styles.moreItemsText}>+{itemCount - 2} more items</Text>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.orderFooter}>
          <View style={styles.orderFooterLeft}>
            <View style={styles.priceContainer}>
              <DollarSign size={16} color={BRAND_COLOR} />
              <Text style={styles.orderTotal}>{item.total.toFixed(2)}</Text>
            </View>
            {item.shippingMethod && (
              <View style={styles.shippingContainer}>
                <Truck size={14} color="#6B7280" />
                <Text style={styles.shippingText}>{item.shippingMethod}</Text>
              </View>
            )}
          </View>
          <ChevronLeft size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatCard = ({ icon, label, value, color }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        {icon}
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );

  const orderStats = useMemo(() => {
    const total = ordersList.length;
    const delivered = ordersList.filter(o => o.status === 'delivered').length;
    const pending = ordersList.filter(o => o.status === 'pending').length;
    const shipped = ordersList.filter(o => o.status === 'shipped').length;
    const totalSpent = ordersList.reduce((sum, o) => sum + o.total, 0);

    return { total, delivered, pending, shipped, totalSpent };
  }, [ordersList]);

  const filterOptions = [
    { id: 'all', label: 'All Orders', icon: <Package size={16} color={BRAND_COLOR} /> },
    { id: 'pending', label: 'Pending', icon: <Clock size={16} color="#F59E0B" /> },
    { id: 'shipped', label: 'Shipped', icon: <Truck size={16} color="#3B82F6" /> },
    { id: 'delivered', label: 'Delivered', icon: <CheckCircle size={16} color="#22C55E" /> },
    { id: 'canceled', label: 'Canceled', icon: <AlertCircle size={16} color="#EF4444" /> },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_COLOR} />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }]
          }
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Orders</Text>
          <Text style={styles.headerSubtitle}>Track your deliveries</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={loadOrdersList}>
          <RefreshCw size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6B7280" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </Animated.View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
          {renderStatCard({ icon: <Package size={20} color={BRAND_COLOR} />, label: 'Total Orders', value: orderStats.total, color: BRAND_COLOR })}
          {renderStatCard({ icon: <CheckCircle size={20} color="#22C55E" />, label: 'Delivered', value: orderStats.delivered, color: '#22C55E' })}
          {renderStatCard({ icon: <TrendingUp size={20} color={ACCENT_COLOR} />, label: 'Total Spent', value: `$${orderStats.totalSpent.toFixed(0)}`, color: ACCENT_COLOR })}
        </Animated.View>

        {/* Filter Tabs */}
        <Animated.View style={[styles.filterContainer, { opacity: fadeAnim }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filterOptions.map((option) => {
              const isActive = statusFilter === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => setStatusFilter(option.id)}
                >
                  <View style={[styles.filterIcon, isActive && styles.filterIconActive]}>
                    {option.icon}
                  </View>
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Orders List */}
        <Animated.View style={[styles.ordersContainer, { opacity: fadeAnim }]}>
          {ordersListLoading && ordersList.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BRAND_COLOR} />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Package size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try adjusting your search' : 'Start shopping to see your orders here'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderOrderCard}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Header
  header: {
    backgroundColor: BRAND_COLOR,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  searchBar: {
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
  // Stats
  statsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Filter
  filterContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabActive: {
    backgroundColor: BRAND_COLOR,
  },
  filterIcon: {
    marginRight: 8,
  },
  filterIconActive: {
    // Icon color changes automatically
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterLabelActive: {
    color: '#FFFFFF',
  },
  // Orders
  content: {
    flex: 1,
  },
  ordersContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(9, 9, 102, 0.08)',
  },
  orderCardSelected: {
    borderColor: BRAND_COLOR,
    shadowColor: BRAND_COLOR,
    shadowOpacity: 0.15,
  },
  // Order Header
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  orderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND_COLOR + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderTitleContainer: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  // Items Section
  itemsSection: {
    marginBottom: 16,
  },
  itemsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  itemsList: {
    marginLeft: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  moreItemsText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Order Footer
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  orderFooterLeft: {
    flex: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND_COLOR,
    marginLeft: 4,
  },
  shippingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shippingText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  // Loading and Empty States
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TrackOrderScreen;
