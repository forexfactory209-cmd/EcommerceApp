import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

async function configureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices');
    return null;
  }

  await configureAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permissions not granted');
    return null;
  }

  const { data } = await Notifications.getExpoPushTokenAsync();
  const token = data?.expoPushToken ?? data?.token ?? null;

  if (!token) {
    console.warn('Failed to get Expo push token');
    return null;
  }

  return token;
}

export async function saveDeviceTokenToSupabase(userId, expoPushToken) {
  if (!userId || !expoPushToken) return;

  const { error } = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' },
    );

  if (error) {
    console.warn('Failed to save device token', error.message || error);
  }
}
