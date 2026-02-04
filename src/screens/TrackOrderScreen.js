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
  Search,
  Filter,
  ShoppingBag,
  MoreVertical,
  X,
  TrendingUp,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
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

    return filtered;
  }, [ordersList, statusFilter, searchQuery]);

  const renderOrderCard = ({ item }) => {
    const itemCount = Array.isArray(item.items) ? item.items.length : 0;
    const firstItem = Array.isArray(item.items) && item.items.length > 0 ? item.items[0] : null;

    return (
      <Animated.View style={[styles.orderCard, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.orderCardContent}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SimpleOrderTracking', { orderId: item.id })}
        >
          {/* Header */}
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <Text style={styles.orderNumber}>#{item.id}</Text>
              <Text style={styles.orderDate}>{item.placedAt}</Text>
            </View>
            <View style={styles.orderHeaderRight}>
              {item.statusIcon}
              <Text style={[styles.orderStatus, { color: item.statusColor }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.orderContent}>
            {firstItem && (
              <View style={styles.itemRow}>
                <ShoppingBag size={16} color="#6B7280" />
                <Text style={styles.itemName} numberOfLines={1}>
                  {firstItem.name || 'Item'}
                </Text>
                {itemCount > 1 && (
                  <Text style={styles.moreItemsText}>+{itemCount - 1} more</Text>
                )}
              </View>
            )}

            {/* Footer */}
            <View style={styles.orderFooter}>
              <View style={styles.priceContainer}>
                <DollarSign size={16} color={BRAND_COLOR} />
                <Text style={styles.totalAmount}>{item.total.toFixed(2)}</Text>
              </View>
              {item.shippingMethod && (
                <View style={styles.shippingContainer}>
                  <Truck size={14} color="#6B7280" />
                  <Text style={styles.shippingText}>{item.shippingMethod}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const orderStats = useMemo(() => {
    const total = ordersList.length;
    const delivered = ordersList.filter(o => o.status === 'delivered').length;
    const totalSpent = ordersList.reduce((sum, o) => sum + o.total, 0);

    return { total, delivered, totalSpent };
  }, [ordersList]);

  // Fixed background colors for each status chip.
  const filterOptions = [
    { id: 'all',       label: 'All',       color: '#FFFFFF', icon: <Package size={16} color="#111827" /> },
    { id: 'pending',   label: 'Pending',   color: '#06B6D4', icon: <Clock size={16} color="#FFFFFF" /> }, // cyan
    { id: 'shipped',   label: 'Shipped',   color: ACCENT_COLOR, icon: <Truck size={16} color="#FFFFFF" /> }, // secondary yellow
    { id: 'delivered', label: 'Delivered', color: '#10B981', icon: <CheckCircle size={16} color="#FFFFFF" /> }, // green
    { id: 'canceled',  label: 'Canceled',  color: '#EF4444', icon: <AlertCircle size={16} color="#FFFFFF" /> }, // red
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND_COLOR} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Main', { screen: 'Profile' })}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Package size={20} color={BRAND_COLOR} />
          <Text style={styles.statValue}>{orderStats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <CheckCircle size={20} color={SUCCESS_COLOR} />
          <Text style={styles.statValue}>{orderStats.delivered}</Text>
          <Text style={styles.statLabel}>Delivered</Text>
        </View>
        <View style={styles.statItem}>
          <TrendingUp size={20} color={BRAND_COLOR} />
          <Text style={styles.statValue}>${orderStats.totalSpent.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Spent</Text>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#6B7280" style={{ marginRight: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders..."
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

      {/* Filter Categories - Visible by Default */}
      {showFilters && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filterOptions.map((option) => {
              const isActive = statusFilter === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.filterChip,
                    {
                      // Selected tab = primary dark blue, others keep their own bg
                      backgroundColor: isActive ? BRAND_COLOR : option.color,
                      borderColor: isActive ? BRAND_COLOR : option.color,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setStatusFilter(option.id)}
                >
                  {option.icon}
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color:
                          isActive
                            ? '#FFFFFF'
                            : option.id === 'all'
                            ? '#111827'
                            : '#FFFFFF',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Orders List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
              {searchQuery || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Start shopping to see your orders here'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {filteredOrders.map((item) => (
              <View key={item.id} style={{ marginBottom: 12 }}>
                {renderOrderCard({ item })}
              </View>
            ))}
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BRAND_COLOR,
    marginRight: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND_COLOR,
    flexShrink: 0,
  },
  filterButtonActive: {
    backgroundColor: BRAND_COLOR,
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  ordersList: {
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardContent: {
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderHeaderLeft: {
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
  },
  orderHeaderRight: {
    alignItems: 'center',
    gap: 4,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderContent: {
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  moreItemsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_COLOR,
  },
  shippingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shippingText: {
    fontSize: 12,
    color: '#6B7280',
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
  },
});
