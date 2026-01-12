import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:info@poscalfx.com';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000'); // 30 seconds default

// Validate required env vars
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Configure web-push
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string | null;
}

interface QueuedNotification {
  id: string;
  title: string;
  body: string;
  tag: string | null;
  data: any;
  created_at: string;
  user_id?: string | null;
}

/**
 * Get all active push subscriptions from database
 */
async function getActiveSubscriptions(): Promise<PushSubscription[]> {
  try {
    const { data, error } = await supabase.rpc('get_active_push_subscriptions');
    
    if (error) {
      console.error('❌ Error fetching subscriptions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Exception fetching subscriptions:', error);
    return [];
  }
}

/**
 * Get push subscriptions for a specific user
 */
async function getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_push_subscriptions', {
      p_user_id: userId
    });
    
    if (error) {
      console.error(`❌ Error fetching subscriptions for user ${userId}:`, error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error(`❌ Exception fetching user subscriptions:`, error);
    return [];
  }
}

/**
 * Send push notification to a single subscription
 */
async function sendToSubscription(
  subscription: PushSubscription,
  notification: QueuedNotification
): Promise<boolean> {
  try {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      tag: notification.tag || 'general',
      icon: '/pwa-192x192.png',
      badge: '/favicon.png',
      data: notification.data || {},
    });

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload
    );

    return true;
  } catch (error: any) {
    // Handle expired subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`🗑️  Subscription expired, removing: ${subscription.endpoint.substring(0, 50)}...`);
      
      // Delete expired subscription
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscription.id);
      
      return false;
    }

    console.error(`❌ Failed to send to subscription ${subscription.id}:`, error.message);
    return false;
  }
}

/**
 * Process pending notifications from the queue
 */
async function processPushQueue(): Promise<void> {
  try {
    // Get pending notifications
    const { data: notifications, error } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 at a time

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      return;
    }

    if (!notifications || notifications.length === 0) {
      return; // No notifications to process
    }

    console.log(`📬 Processing ${notifications.length} notification(s)...`);

    // Process each notification
    for (const notification of notifications) {
      let successCount = 0;
      let failCount = 0;

      // Get subscriptions - either user-specific or all subscribers
      let subscriptions: PushSubscription[] = [];
      
      if (notification.user_id) {
        // User-specific notification
        subscriptions = await getUserSubscriptions(notification.user_id);
        console.log(`👤 User-specific notification: ${subscriptions.length} subscription(s) for user ${notification.user_id}`);
      } else {
        // Broadcast to all subscribers
        subscriptions = await getActiveSubscriptions();
        console.log(`📢 Broadcast notification: ${subscriptions.length} subscriber(s)`);
      }
      
      if (subscriptions.length === 0) {
        console.log(`⚠️  No subscriptions found for notification ${notification.id}`);
        // Mark as sent anyway
        await supabase
          .from('push_notification_queue')
          .update({ 
            status: 'sent', 
            processed_at: new Date().toISOString() 
          })
          .eq('id', notification.id);
        continue;
      }

      // Send to all subscriptions
      for (const subscription of subscriptions) {
        const success = await sendToSubscription(subscription, notification);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log(`✅ Notification "${notification.title}": ${successCount} sent, ${failCount} failed`);

      // Mark notification as sent
      await supabase
        .from('push_notification_queue')
        .update({ 
          status: 'sent', 
          processed_at: new Date().toISOString() 
        })
        .eq('id', notification.id);
    }
  } catch (error) {
    console.error('❌ Error processing queue:', error);
  }
}

/**
 * Main loop
 */
async function main() {
  console.log('🚀 Push Notification Sender started');
  console.log(`📊 Polling every ${POLL_INTERVAL / 1000} seconds`);
  console.log(`🔗 Connected to: ${SUPABASE_URL}`);
  console.log('');

  // Initial run
  await processPushQueue();

  // Run on interval
  setInterval(async () => {
    await processPushQueue();
  }, POLL_INTERVAL);

  // Keep process alive
  process.on('SIGTERM', () => {
    console.log('👋 Shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('👋 Shutting down gracefully...');
    process.exit(0);
  });
}

// Start the service
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
