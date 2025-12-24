import React, { useEffect } from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
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
      if (!authUserId) return;
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await saveDeviceTokenToSupabase(authUserId, token);
      }
    };

    setupNotifications();
  }, [authUserId]);

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
