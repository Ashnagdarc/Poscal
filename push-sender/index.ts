import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import WebSocket from 'ws';
import 'dotenv/config';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:info@poscalfx.com';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY!;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000'); // 30 seconds default

// Validate required env vars
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY');
  process.exit(1);
}

// Warn if FINNHUB_API_KEY is missing (prices won't work, but service continues)
if (!FINNHUB_API_KEY) {
  console.warn('⚠️  FINNHUB_API_KEY not set - price fetching will be disabled');
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

// WebSocket connection for live price updates
let priceWebSocket: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000; // 5 seconds

// Finnhub symbol mappings (OANDA broker format)
const SYMBOL_MAPPINGS: Record<string, string> = {
  'EUR/USD': 'OANDA:EUR_USD',
  'GBP/USD': 'OANDA:GBP_USD',
  'USD/JPY': 'OANDA:USD_JPY',
  'USD/CHF': 'OANDA:USD_CHF',
  'AUD/USD': 'OANDA:AUD_USD',
  'USD/CAD': 'OANDA:USD_CAD',
  'NZD/USD': 'OANDA:NZD_USD',
  'EUR/GBP': 'OANDA:EUR_GBP',
  'EUR/JPY': 'OANDA:EUR_JPY',
  'GBP/JPY': 'OANDA:GBP_JPY',
  'AUD/JPY': 'OANDA:AUD_JPY',
  'XAU/USD': 'OANDA:XAU_USD', // Gold
  'XAG/USD': 'OANDA:XAG_USD', // Silver
  // Crypto uses different format
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT'
};

/**
 * Connect to Finnhub WebSocket for real-time forex prices
 */
function connectPriceWebSocket() {
  if (!FINNHUB_API_KEY) {
    console.warn('⚠️  FINNHUB_API_KEY not set - skipping WebSocket connection');
    return;
  }

  try {
    console.log('🔌 Connecting to Finnhub WebSocket...');
    priceWebSocket = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_API_KEY}`);

    priceWebSocket.on('open', () => {
      console.log('✅ Connected to Finnhub WebSocket');
      reconnectAttempts = 0;

      // Subscribe to all currency pairs
      Object.values(SYMBOL_MAPPINGS).forEach(symbol => {
        priceWebSocket?.send(JSON.stringify({ type: 'subscribe', symbol }));
        console.log(`📡 Subscribed to ${symbol}`);
      });
    });

    priceWebSocket.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Finnhub sends trade updates with this structure:
        // { type: 'trade', data: [{ s: 'OANDA:EUR_USD', p: 1.0855, t: timestamp, v: volume }] }
        if (message.type === 'trade' && message.data) {
          for (const trade of message.data) {
            // Find the original symbol (EUR/USD format)
            const originalSymbol = Object.entries(SYMBOL_MAPPINGS).find(
              ([_, finnhubSymbol]) => finnhubSymbol === trade.s
            )?.[0];

            if (originalSymbol) {
              const price = trade.p;
              const spread = price * 0.0001; // Approximate 1 pip spread for forex
              
              await supabase
                .from('price_cache')
                .upsert({
                  symbol: originalSymbol,
                  mid_price: price,
                  ask_price: price + spread / 2,
                  bid_price: price - spread / 2,
                  timestamp: trade.t,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'symbol' });

              console.log(`💹 Updated ${originalSymbol}: ${price}`);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error);
      }
    });

    priceWebSocket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    priceWebSocket.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      
      // Attempt to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔄 Reconnecting in ${RECONNECT_DELAY / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectPriceWebSocket, RECONNECT_DELAY);
      } else {
        console.error('❌ Max reconnection attempts reached. Please restart the service.');
      }
    });

  } catch (error) {
    console.error('❌ Error setting up WebSocket:', error);
  }
}

/**
 * Main loop
 */
async function main() {
  console.log('🚀 Push Notification Sender started');
  console.log(`📊 Polling for notifications every ${POLL_INTERVAL / 1000} seconds`);
  console.log(`🔗 Connected to: ${SUPABASE_URL}`);
  console.log('');

  // Start WebSocket connection for real-time prices
  connectPriceWebSocket();

  // Initial notification queue processing
  await processPushQueue();

  // Run notification queue on interval
  setInterval(async () => {
    await processPushQueue();
  }, POLL_INTERVAL);

  // Keep process alive
  process.on('SIGTERM', () => {
    console.log('👋 Shutting down gracefully...');
    if (priceWebSocket) {
      priceWebSocket.close();
    }
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('👋 Shutting down gracefully...');
    if (priceWebSocket) {
      priceWebSocket.close();
    }
    process.exit(0);
  });
}

// Start the service
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
