import React, { useEffect } from 'react';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
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
      console.log('[Notifications] setupNotifications called with authUserId:', authUserId);
      if (!authUserId) {
        console.log('[Notifications] Skipping setup, no authUserId');
        return;
      }

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

    setupNotifications();
  }, [authUserId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data || {};
        const type = data.type || data.notificationType || null;
        const orderId = data.orderId || data.order_id;
        const productId = data.productId || data.product_id;
        const brandId = data.brandId || data.brand_id;
        const questionId = data.questionId || data.question_id;

        // Q&A: new question for a product -> take brand owner straight to product Q&A
        if (type === 'new_question' && productId && navigationRef.isReady()) {
          if (data.product) {
            navigationRef.navigate('ProductDetails', {
              product: data.product,
              focusQuestionId: questionId || null,
              initialTab: 'reviews',
            });
          } else {
            navigationRef.navigate('ProductDetails', {
              product: {
                id: productId,
              },
              focusQuestionId: questionId || null,
              initialTab: 'reviews',
            });
          }
          return;
        }

        // Product-level: restock / product notifications
        if (productId && navigationRef.isReady()) {
          if (data.product) {
            navigationRef.navigate('ProductDetails', { product: data.product });
          } else {
            navigationRef.navigate('ProductDetails', {
              product: {
                id: productId,
              },
            });
          }
          return;
        }

        // Brand-level: flash sales, discounts, collections
        if (brandId && navigationRef.isReady()) {
          if (data.brand) {
            navigationRef.navigate('Brand', {
              brandId,
              brand: data.brand,
            });
          } else {
            navigationRef.navigate('Brand', { brandId });
          }
          return;
        }

        // Order-level: status updates
        if (orderId && navigationRef.isReady()) {
          navigationRef.navigate('TrackOrderDetails', { orderId });
        }
      } catch (e) {
        // Swallow navigation errors from malformed payloads
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
    </>
  );
}
