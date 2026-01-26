// src/screens/NotificationsScreen.js
import React, { useState, useEffect } from 'react';

import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Bell, BellOff, Check } from 'lucide-react-native';
import { useStore } from '../store/store';

import { supabase } from '../lib/supabase';
import { subscribeToNotifications, fetchNotificationsForUser } from './notificationsHelpers';

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const followedBrandIds = useStore((state) => state.followedBrandIds || []);

  const fetchNotifications = async (targetUserId) => {
    try {
      setLoading(true);
      let effectiveUserId = targetUserId || userId;

      if (!effectiveUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return;
        }
        effectiveUserId = user.id;
        setUserId(user.id);
      }

      const data = await fetchNotificationsForUser(effectiveUserId);
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);

    } finally {
      setLoading(false);
      setRefreshing(false);
    };
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, is_read: true } 
          : notification
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(notifications.map(notification => 
        ({ ...notification, is_read: true })
      ));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationPress = async (item) => {
    try {
      // Mark as read locally and in Supabase
      if (!item.is_read) {
        await markAsRead(item.id);
      }

      const data = item.data || {};
      // Prefer the top-level type column, fall back to any nested data.type for legacy rows
      const type = item.type || data.type;

      // Order created for a brand/vendor: jump to the Brand Orders tab, focusing the "New" list
      if (type === 'order_created') {
        navigation.navigate('Main', {
          screen: 'BrandOrders',
          params: data.order_id
            ? { highlightOrderId: data.order_id }
            : undefined,
        });
        return;
      }

      // Customer order status update: go to the tracking details for that specific order
      if (type === 'order_status' && data.order_id) {
        navigation.navigate('SimpleOrderTracking', {
          orderId: data.order_id,
        });
        return;
      }

      // Product Q&A for brand owner: go to the central Brand Q&A inbox
      if (type === 'new_question' || type === 'question') {
        navigation.navigate('BrandQA');
        return;
      }

      // Reviews & ratings for brand owner: go to the BrandReviews screen
      if (
        type === 'review' ||
        type === 'new_review' ||
        type === 'product_review'
      ) {
        navigation.navigate('BrandReviews');
        return;
      }

      // Any other brand-related notification (flash sale, announcement, etc.):
      // take user to that brand's product list screen
      if (item.brand_id) {
        navigation.navigate('Brand', {
          brandId: item.brand_id,
          brand: item.brands || null,
        });
        return;
      }

      // Other notification types (without brand) can be extended later

    } catch (e) {
      console.warn('Error handling notification press', e.message || e);
    }
  };

  useEffect(() => {
    let unsubscribe;

    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          await fetchNotifications();
          return;
        }

        setUserId(user.id);
        await fetchNotifications(user.id);

        unsubscribe = subscribeToNotifications(user.id, (notification) => {
          setNotifications((current) => [notification, ...current]);
        });
      } catch (err) {
        console.error('Error initializing notifications screen:', err);
      }
    };

    init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSectionLabel = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfGiven = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (startOfGiven.getTime() === startOfToday.getTime()) {
      return 'Today';
    }
    if (startOfGiven.getTime() === startOfYesterday.getTime()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const visibleNotifications = notifications;

  const renderItem = ({ item, index }) => {
    const currentSection = getSectionLabel(item.created_at);
    const prevItem = index > 0 ? visibleNotifications[index - 1] : null;
    const prevSection = prevItem ? getSectionLabel(prevItem.created_at) : null;
    const showSectionHeader = index === 0 || currentSection !== prevSection;

    return (
      <View style={styles.itemWrapper}>
        {showSectionHeader && (
          <Text style={styles.sectionHeader}>{currentSection}</Text>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleNotificationPress(item)}
          style={[
            styles.notificationItem,
            !item.is_read && styles.unreadNotification,
          ]}
        >
          <View style={styles.notificationHeader}>
            <View style={styles.iconCircle}>
              {item.brands?.logo_url ? (
                <Image
                  source={{ uri: item.brands.logo_url }}
                  style={styles.iconImage}
                />
              ) : (
                <Text style={styles.iconInitial}>
                  {item.brands?.name?.charAt(0)?.toUpperCase() || 'B'}
                </Text>
              )}
            </View>

            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
              <View style={styles.notificationFooter}>
                <Text style={styles.notificationTime}>
                  {formatTime(item.created_at)}
                </Text>
                {!item.is_read && <View style={styles.unreadDot} />}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {notifications.some(n => !n.is_read) && (
            <TouchableOpacity 
              onPress={markAllAsRead}
              style={styles.markAllButton}
            >
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={visibleNotifications}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchNotifications(userId);
            }}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <BellOff size={48} color="#CCCCCC" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>When you get notifications, they'll appear here</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F4F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  itemWrapper: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 8,
  },
  notificationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  unreadNotification: {
    backgroundColor: '#F9FAFB',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    resizeMode: 'cover',
  },
  iconInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111111',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 80,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;