// Simple notification worker for sending Expo push notifications
// Run this with Node (separate from the React Native app)
// Requires: npm install @supabase/supabase-js expo-server-sdk

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Expo } from 'expo-server-sdk';

// Load from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role for server-side

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const expo = new Expo();

// Poll for unread notifications that have not been pushed yet
// You should add a boolean column like `push_sent` to the notifications table.
async function processNotificationsBatch() {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, is_read')
      .eq('push_sent', false)
      .limit(100);

    if (error) {
      console.error('[Worker] Error loading notifications:', error);
      return;
    }

    if (!notifications || notifications.length === 0) {
      return;
    }

    const messages = [];
    const notificationIds = [];

    for (const n of notifications) {
      if (!n.user_id) continue;

      // Fetch the user's push token from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('notification_token')
        .eq('id', n.user_id)
        .maybeSingle();

      if (profileError) {
        console.error('[Worker] Error loading profile for user', n.user_id, profileError);
        continue;
      }

      const token = profile?.notification_token;
      if (!token || !Expo.isExpoPushToken(token)) continue;

      messages.push({
        to: token,
        sound: 'default',
        title: n.title || 'Notification',
        body: n.message || '',
        data: { notification_id: n.id },
      });
      notificationIds.push(n.id);
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        console.log('[Worker] Sent push tickets:', tickets);
      } catch (err) {
        console.error('[Worker] Error sending push chunk:', err);
      }
    }

    if (notificationIds.length > 0) {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ push_sent: true })
        .in('id', notificationIds);

      if (updateError) {
        console.error('[Worker] Error marking notifications as pushed:', updateError);
      }
    }
  } catch (err) {
    console.error('[Worker] Unexpected error in processNotificationsBatch:', err);
  }
}

async function main() {
  console.log('[Worker] Starting notification worker...');

  // Poll every X seconds
  const intervalMs = Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 5000);

  setInterval(processNotificationsBatch, intervalMs);
}

main().catch((err) => {
  console.error('[Worker] Fatal error in main:', err);
  process.exit(1);
});
