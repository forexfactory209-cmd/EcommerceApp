import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export async function registerForPushNotificationsAsync(userId) {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync();
  const expoPushToken = token.data;
  const platform = Platform.OS; // 'ios' | 'android' | 'web'

  // one row per (user, token)
  await supabase
    .from('user_push_tokens')
    .upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        platform,
      },
      {
        onConflict: 'user_id,expo_push_token', // adjust if you have a composite unique index
      }
    );
}
