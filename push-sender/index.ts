import axios from 'axios';
import webpush from 'web-push';
import WebSocket from 'ws';
import 'dotenv/config';

// Environment variables
const NESTJS_API_URL = process.env.NESTJS_API_URL || 'http://localhost:3000';
const NESTJS_SERVICE_TOKEN = process.env.NESTJS_SERVICE_TOKEN;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:info@poscalfx.com';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000', 10);
const BATCH_INTERVAL = parseInt(process.env.BATCH_INTERVAL || '1000', 10);

// Validate required env vars
if (!NESTJS_SERVICE_TOKEN) {
  console.error('❌ Missing required environment variable: NESTJS_SERVICE_TOKEN');
  process.exit(1);
}

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('❌ Missing VAPID keys. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
  process.exit(1);
}

// Warn if FINNHUB_API_KEY is missing (prices won't work, but service continues)
if (!FINNHUB_API_KEY) {
  console.warn('⚠️  FINNHUB_API_KEY not set - price fetching will be disabled');
}

// Configure web-push
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Axios client for NestJS backend
const nestApi = axios.create({
  baseURL: NESTJS_API_URL,
  timeout: 30000,
  headers: {
    'X-Service-Token': NESTJS_SERVICE_TOKEN,
    'Content-Type': 'application/json',
  },
});

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_id: string | null;
}

interface QueuedNotification {
  id: string;
  title: string;
  body: string;
  tag?: string | null;
  icon?: string | null;
  url?: string | null;
  data: any;
  created_at: string;
  user_id?: string | null;
}

async function getActiveSubscriptions(): Promise<PushSubscription[]> {
  try {
    const res = await nestApi.get('/notifications/push/subscriptions/active');
    return res.data || [];
  } catch (error) {
    console.error('❌ Error fetching active subscriptions:', error);
    return [];
  }
}

async function getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
  try {
    const res = await nestApi.get(`/notifications/push/subscriptions/user/${userId}`);
    return res.data || [];
  } catch (error) {
    console.error(`❌ Error fetching subscriptions for user ${userId}:`, error);
    return [];
  }
}

async function getPendingNotifications(limit: number = 100): Promise<QueuedNotification[]> {
  try {
    const res = await nestApi.get('/notifications/push/pending', { params: { limit } });
    return res.data || [];
  } catch (error) {
    console.error('❌ Error fetching pending notifications:', error);
    return [];
  }
}

async function updateNotificationStatus(
  id: string,
  status: 'sent' | 'failed',
  errorMessage?: string,
): Promise<void> {
  try {
    await nestApi.patch(`/notifications/push/${id}/status`, {
      status,
      sent_at: new Date().toISOString(),
      error_message: errorMessage,
    });
  } catch (error) {
    console.error(`❌ Error updating notification ${id} status:`, error);
  }
}

async function batchUpdatePrices(
  prices: Array<{ symbol: string; bid_price?: number; mid_price?: number; ask_price?: number; price?: number }>,
): Promise<void> {
  try {
    await nestApi.post('/prices/batch-update', prices);
  } catch (error) {
    console.error('❌ Error batch updating prices:', error);
  }
}

async function sendToSubscription(
  subscription: PushSubscription,
  notification: QueuedNotification,
): Promise<boolean> {
  try {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      tag: notification.tag || 'general',
      icon: notification.icon || '/pwa-192x192.png',
      badge: '/favicon.png',
      url: notification.url,
      data: notification.data || {},
    });

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh_key,
          auth: subscription.auth_key,
        },
      },
      payload,
    );

    return true;
  } catch (error: any) {
    if (error?.statusCode === 410 || error?.statusCode === 404) {
      console.log(`🗑️  Subscription expired: ${subscription.endpoint.slice(0, 60)}...`);
      // No delete endpoint exposed; log and continue
      return false;
    }

    console.error(`❌ Failed to send to subscription ${subscription.id}:`, error?.message || error);
    return false;
  }
}

async function processPushQueue(): Promise<void> {
  try {
    const notifications = await getPendingNotifications(100);

    if (!notifications || notifications.length === 0) {
      return;
    }

    console.log(`📬 Processing ${notifications.length} notification(s)...`);

    for (const notification of notifications) {
      let successCount = 0;
      let failCount = 0;

      let subscriptions: PushSubscription[] = [];

      if (notification.user_id) {
        subscriptions = await getUserSubscriptions(notification.user_id);
        console.log(`👤 User-specific notification: ${subscriptions.length} subscription(s) for user ${notification.user_id}`);
      } else {
        subscriptions = await getActiveSubscriptions();
        console.log(`📢 Broadcast notification: ${subscriptions.length} subscriber(s)`);
      }

      if (subscriptions.length === 0) {
        console.log(`⚠️  No subscriptions for notification ${notification.id}`);
        await updateNotificationStatus(notification.id, 'failed', 'No active subscriptions');
        continue;
      }

      for (const subscription of subscriptions) {
        const success = await sendToSubscription(subscription, notification);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log(`✅ Notification "${notification.title}": ${successCount} sent, ${failCount} failed`);

      if (successCount > 0) {
        await updateNotificationStatus(notification.id, 'sent');
      } else {
        await updateNotificationStatus(notification.id, 'failed', 'All sends failed');
      }
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
  // Major Pairs
  'EUR/USD': 'OANDA:EUR_USD',
  'GBP/USD': 'OANDA:GBP_USD',
  'USD/JPY': 'OANDA:USD_JPY',
  'USD/CHF': 'OANDA:USD_CHF',
  'AUD/USD': 'OANDA:AUD_USD',
  'USD/CAD': 'OANDA:USD_CAD',
  'NZD/USD': 'OANDA:NZD_USD',
  
  // EUR Cross Pairs
  'EUR/GBP': 'OANDA:EUR_GBP',
  'EUR/JPY': 'OANDA:EUR_JPY',
  'EUR/CHF': 'OANDA:EUR_CHF',
  'EUR/AUD': 'OANDA:EUR_AUD',
  'EUR/CAD': 'OANDA:EUR_CAD',
  'EUR/NZD': 'OANDA:EUR_NZD',
  
  // GBP Cross Pairs
  'GBP/JPY': 'OANDA:GBP_JPY',
  'GBP/CHF': 'OANDA:GBP_CHF',
  'GBP/AUD': 'OANDA:GBP_AUD',
  'GBP/CAD': 'OANDA:GBP_CAD',
  'GBP/NZD': 'OANDA:GBP_NZD',
  
  // AUD Cross Pairs
  'AUD/JPY': 'OANDA:AUD_JPY',
  'AUD/CHF': 'OANDA:AUD_CHF',
  'AUD/CAD': 'OANDA:AUD_CAD',
  'AUD/NZD': 'OANDA:AUD_NZD',
  
  // CAD Cross Pairs
  'CAD/JPY': 'OANDA:CAD_JPY',
  'CAD/CHF': 'OANDA:CAD_CHF',
  
  // NZD Cross Pairs
  'NZD/JPY': 'OANDA:NZD_JPY',
  'NZD/CHF': 'OANDA:NZD_CHF',
  'NZD/CAD': 'OANDA:NZD_CAD',
  
  // CHF Cross Pairs
  'CHF/JPY': 'OANDA:CHF_JPY',
  
  // Exotic Pairs
  'USD/MXN': 'OANDA:USD_MXN', // US Dollar / Mexican Peso
  'USD/ZAR': 'OANDA:USD_ZAR', // US Dollar / South African Rand
  'USD/TRY': 'OANDA:USD_TRY', // US Dollar / Turkish Lira
  'USD/CNH': 'OANDA:USD_CNH', // US Dollar / Chinese Yuan
  'USD/HKD': 'OANDA:USD_HKD', // US Dollar / Hong Kong Dollar
  'USD/SGD': 'OANDA:USD_SGD', // US Dollar / Singapore Dollar
  'EUR/TRY': 'OANDA:EUR_TRY', // Euro / Turkish Lira
  'GBP/ZAR': 'OANDA:GBP_ZAR', // British Pound / South African Rand
  
  // Precious Metals
  'XAU/USD': 'OANDA:XAU_USD', // Gold
  'XAG/USD': 'OANDA:XAG_USD', // Silver
  'XPT/USD': 'OANDA:XPT_USD', // Platinum
  'XPD/USD': 'OANDA:XPD_USD', // Palladium
  
  // Commodities
  'BCO/USD': 'OANDA:BCO_USD', // Brent Crude Oil
  'WTI/USD': 'OANDA:WTICO_USD', // WTI Crude Oil
  
  // Indices
  'NAS/USD': 'OANDA:NAS100_USD', // Nasdaq 100
  'US100': 'OANDA:NAS100_USD', // Nasdaq 100 (alternative symbol)
  'US100/USD': 'OANDA:NAS100_USD', // Nasdaq 100 (alternative symbol)
  'SPX/USD': 'OANDA:SPX500_USD', // S&P 500
  'US500': 'OANDA:SPX500_USD', // S&P 500 (alternative symbol)
  'US500/USD': 'OANDA:SPX500_USD', // S&P 500 (alternative symbol)
  'US30': 'OANDA:US30_USD', // Dow Jones 30
  'US30/USD': 'OANDA:US30_USD', // Dow Jones 30
  'GER30': 'OANDA:DE30_EUR', // DAX 30
  'GER30/EUR': 'OANDA:DE30_EUR', // DAX 30
  'UK100': 'OANDA:UK100_GBP', // FTSE 100
  'UK100/GBP': 'OANDA:UK100_GBP', // FTSE 100
  'JPN225': 'OANDA:JP225_USD', // Nikkei 225
  'JPN225/USD': 'OANDA:JP225_USD', // Nikkei 225
  
  // Cryptocurrencies (BINANCE format)
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT',
  'BNB/USD': 'BINANCE:BNBUSDT',
  'XRP/USD': 'BINANCE:XRPUSDT',
  'ADA/USD': 'BINANCE:ADAUSDT',
  'SOL/USD': 'BINANCE:SOLUSDT',
  'DOGE/USD': 'BINANCE:DOGEUSDT',
  'DOT/USD': 'BINANCE:DOTUSDT',
  'MATIC/USD': 'BINANCE:MATICUSDT',
  'LTC/USD': 'BINANCE:LTCUSDT'
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

    // --- Batched price upsert logic ---
    const priceBatch: Record<string, {
      symbol: string;
      mid_price: number;
      ask_price: number;
      bid_price: number;
      timestamp: number;
      updated_at: string;
    }> = {};

    // Flush batch at configurable interval
    setInterval(async () => {
      const batch = Object.values(priceBatch);
      if (batch.length === 0) return;

      try {
        await batchUpdatePrices(batch.map((item) => ({
          symbol: item.symbol,
          bid_price: item.bid_price,
          mid_price: item.mid_price,
          ask_price: item.ask_price,
        })));

        batch.forEach(item => console.log(`💹 Batched update ${item.symbol}: ${item.mid_price}`));
      } catch (err) {
        console.error('❌ Error in batched upsert:', err);
      }

      // clear batch
      for (const k of Object.keys(priceBatch)) delete priceBatch[k];
    }, BATCH_INTERVAL);

    priceWebSocket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        // Finnhub sends trade updates with this structure:
        // { type: 'trade', data: [{ s: 'OANDA:EUR_USD', p: 1.0855, t: timestamp, v: volume }] }
        if (message.type === 'trade' && message.data) {
          for (const trade of message.data) {
            const matchingSymbols = Object.entries(SYMBOL_MAPPINGS)
              .filter(([_, finnhubSymbol]) => finnhubSymbol === trade.s)
              .map(([symbol]) => symbol);

            if (matchingSymbols.length === 0) continue;

            const price = trade.p;
            const spread = price * 0.0001;
            const ts = trade.t;

            for (const symbol of matchingSymbols) {
              // Keep only the latest tick per symbol in the batch
              priceBatch[symbol] = {
                symbol,
                mid_price: price,
                ask_price: price + spread / 2,
                bid_price: price - spread / 2,
                timestamp: ts,
                updated_at: new Date().toISOString()
              };
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
  console.log(`🔗 Backend: ${NESTJS_API_URL}`);
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
