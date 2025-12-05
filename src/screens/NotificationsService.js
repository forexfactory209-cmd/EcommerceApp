// src/services/notifications.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

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
  return token;
};

export const savePushToken = async (token) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ notification_token: token })
      .eq('id', user.id);

    if (error) throw error;
  } catch (error) {
    console.error('Error saving push token:', error);
  }
};

export const followBrand = async (brandId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('brand_follows')
      .insert([{ user_id: user.id, brand_id: brandId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error following brand:', error);
    throw error;
  }
};

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
  } catch (error) {
    console.error('Error unfollowing brand:', error);
    throw error;
  }
};

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

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
};

export const getNotifications = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
};

export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};