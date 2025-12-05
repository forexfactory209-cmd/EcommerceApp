import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register for push notifications
export const registerForPushNotificationsAsync = async () => {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
};

// Save the push token to the user's profile
export const savePushToken = async (tokenFromParam) => {
  try {
    const token = tokenFromParam || (await registerForPushNotificationsAsync());
    if (!token) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Save token to user's profile
    const { error } = await supabase
      .from('profiles')
      .update({ notification_token: token })
      .eq('id', user.id);

    if (error) throw error;
    
    return token;
  } catch (error) {
    console.error('Error saving push token:', error);
    return null;
  }
};

// Follow a brand
export const followBrand = async (brandId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    console.log('[Notifications] followBrand called with brandId:', brandId, 'for user:', user.id);
    const { data, error } = await supabase
      .from('brand_follows')
      .insert([{ user_id: user.id, brand_id: brandId }])
      .select()
      .single();

    if (error) throw error;
    console.log('[Notifications] followBrand insert result:', data);
    return data;
  } catch (error) {
    console.error('Error following brand:', error);
    throw error;
  }
};

// Unfollow a brand
export const unfollowBrand = async (brandId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('brand_follows')
      .delete()
      .eq('user_id', user.id)
      .eq('brand_id', brandId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error unfollowing brand:', error);
    throw error;
  }
};

// Check if user is following a brand
export const isFollowingBrand = async (brandId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('brand_follows')
      .select('*')
      .eq('user_id', user.id)
      .eq('brand_id', brandId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return !!data;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
};

// Get user's followed brands
export const getFollowedBrands = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('brand_follows')
      .select('brands(*)')
      .eq('user_id', user.id);

    if (error) throw error;
    return data.map(item => item.brands);
  } catch (error) {
    console.error('Error getting followed brands:', error);
    return [];
  }
};

// Get user's notifications
export const getNotifications = async (limit = 20) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        brands (id, name, logo_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

// Mark notification as read
export const markAsRead = async (notificationId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

// Send an announcement to all followers of a brand
export const sendAnnouncementToFollowers = async (brandId, title, message, data = {}) => {
  try {
    console.log('[Notifications] sendAnnouncementToFollowers called with brandId:', brandId, typeof brandId);
    
    // Convert brandId to integer
    let brandIdInt;
    if (typeof brandId === 'string') {
      brandIdInt = parseInt(brandId, 10);
    } else if (typeof brandId === 'number') {
      brandIdInt = Math.floor(brandId);
    } else {
      throw new Error(`Invalid brandId type: ${typeof brandId}`);
    }
    
    if (isNaN(brandIdInt)) {
      throw new Error(`Invalid brandId: ${brandId}`);
    }
    
    console.log('[Notifications] Using brandId as integer:', brandIdInt);
    
    const { data: result, error } = await supabase.rpc('notify_brand_followers', {
      p_brand_id: brandIdInt,
      p_title: title,
      p_message: message,
      p_data: JSON.stringify({ type: 'announcement', timestamp: new Date().toISOString(), ...data })
    });

    if (error) {
      console.error('[Notifications] RPC error:', error);
      throw error;
    }
    console.log('[Notifications] sendAnnouncementToFollowers result:', result);
    return result;
  } catch (error) {
    console.error('Error sending announcement to followers:', error);
    throw error;
  }
};

// Send a flash sale notification to all followers of a brand
// discountPercent is optional and, if provided, will be shown in the message
export const sendFlashSaleToFollowers = async (brandId, brandName, discountPercent = null) => {
  try {
    console.log('[Notifications] sendFlashSaleToFollowers called with brandId:', brandId, typeof brandId, 'brandName:', brandName);

    let brandIdInt;
    if (typeof brandId === 'string') {
      brandIdInt = parseInt(brandId, 10);
    } else if (typeof brandId === 'number') {
      brandIdInt = Math.floor(brandId);
    } else {
      throw new Error(`Invalid brandId type for flash sale: ${typeof brandId}`);
    }

    if (isNaN(brandIdInt)) {
      throw new Error(`Invalid brandId for flash sale: ${brandId}`);
    }

    const title = `${brandName || 'A brand'} flash sale`;
    const discountText =
      typeof discountPercent === 'number' && !Number.isNaN(discountPercent) && discountPercent > 0
        ? ` with ${discountPercent}% off`
        : '';
    const message = `${brandName || 'This brand'} has started a flash sale${discountText}. Take a look!`;

    const { data: result, error } = await supabase.rpc('notify_brand_followers', {
      p_brand_id: brandIdInt,
      p_title: title,
      p_message: message,
      p_data: JSON.stringify({
        type: 'flash_sale',
        brand_id: brandIdInt,
        brand_name: brandName || null,
        discount_percent: discountPercent,
        timestamp: new Date().toISOString(),
      }),
    });

    if (error) {
      console.error('[Notifications] RPC error (flash sale):', error);
      throw error;
    }

    console.log('[Notifications] sendFlashSaleToFollowers result:', result);
    return result;
  } catch (error) {
    console.error('Error sending flash sale to followers:', error);
    throw error;
  }
};

// Send a general discount notification (independent from flash sale)
// Example: brand sets 10% or 15% discount across its products
export const sendDiscountToFollowers = async (brandId, brandName, discountPercent) => {
  try {
    console.log('[Notifications] sendDiscountToFollowers called with brandId:', brandId, 'discount:', discountPercent);

    let brandIdInt;
    if (typeof brandId === 'string') {
      brandIdInt = parseInt(brandId, 10);
    } else if (typeof brandId === 'number') {
      brandIdInt = Math.floor(brandId);
    } else {
      throw new Error(`Invalid brandId type for discount: ${typeof brandId}`);
    }

    if (isNaN(brandIdInt)) {
      throw new Error(`Invalid brandId for discount: ${brandId}`);
    }

    const safeDiscount = typeof discountPercent === 'number' && !Number.isNaN(discountPercent)
      ? Math.max(0, Math.round(discountPercent))
      : null;

    const title = `${brandName || 'A brand'} discount update`;
    const discountText = safeDiscount != null && safeDiscount > 0
      ? `${safeDiscount}% off`
      : 'a new discount';
    const message = `${brandName || 'This brand'} now offers ${discountText} on its products. Check it out!`;

    const { data: result, error } = await supabase.rpc('notify_brand_followers', {
      p_brand_id: brandIdInt,
      p_title: title,
      p_message: message,
      p_data: JSON.stringify({
        type: 'discount',
        brand_id: brandIdInt,
        brand_name: brandName || null,
        discount_percent: safeDiscount,
        timestamp: new Date().toISOString(),
      }),
    });

    if (error) {
      console.error('[Notifications] RPC error (discount):', error);
      throw error;
    }

    // Also create a notification for the brand owner themselves
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { error: ownerError } = await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            brand_id: brandIdInt,
            title,
            message,
            data: {
              type: 'discount',
              brand_id: brandIdInt,
              brand_name: brandName || null,
              discount_percent: safeDiscount,
              timestamp: new Date().toISOString(),
            },
            is_read: false,
          });

        if (ownerError) {
          console.warn('[Notifications] Failed to insert owner discount notification', ownerError.message || ownerError);
        }
      }
    } catch (ownerEx) {
      console.warn('[Notifications] Exception while inserting owner discount notification', ownerEx.message || ownerEx);
    }

    console.log('[Notifications] sendDiscountToFollowers result:', result);
    return result;
  } catch (error) {
    console.error('Error sending discount notification to followers:', error);
    throw error;
  }
};

export default {
  savePushToken,
  followBrand,
  unfollowBrand,
  isFollowingBrand,
  getFollowedBrands,
  getNotifications,
  markAsRead,
  registerForPushNotificationsAsync,
  sendAnnouncementToFollowers,
  sendFlashSaleToFollowers,
  sendDiscountToFollowers,
};
