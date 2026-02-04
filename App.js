import React, { useEffect } from 'react';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { useStore } from './src/store/store';
import { registerForPushNotificationsAsync, saveDeviceTokenToSupabase } from './src/services/notificationsSetup';

// Import NativeWind styles
import './global.css';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const authUserId = useStore((state) => state.authUserId);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        console.log('[Notifications] registerForPushNotificationsAsync returned token:', token);

        if (token) {
          await saveDeviceTokenToSupabase(authUserId, token);
        }
      } catch (e) {
        console.warn('[Notifications] Error during setupNotifications', e?.message || e);
      }
    };

    if (authUserId) {
      console.log('[Notifications] setupNotifications called with authUserId:', authUserId);
      setupNotifications();
    } else {
      console.log('[Notifications] Skipping setup, no authUserId');
    }
  }, [authUserId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        // For any push tap (from lockscreen, banner, or notification center),
        // always take the user into the in-app Notifications screen. More
        // specific routing is handled inside NotificationsScreen when the user
        // taps on a list item there.
        if (navigationRef.isReady()) {
          navigationRef.navigate('Notifications');
        } else {
          // If navigation is not yet ready (cold start), retry shortly.
          setTimeout(() => {
            if (navigationRef.isReady()) {
              navigationRef.navigate('Notifications');
            }
          }, 500);
        }
      } catch (e) {
        // Swallow navigation errors from malformed payloads or startup timing.
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
