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

// ===== IN-MEMORY CACHE FOR 5K+ USERS =====
// Cache structure for performance optimization
class CacheManager {
  private subscriptionCache: Map<string, { subscriptions: any[]; timestamp: number }> = new Map();
  private priceCache: Map<string, any> = new Map();
  private vapidCache: { details: any; timestamp: number } | null = null;
  private readonly SUBSCRIPTION_CACHE_TTL = 5000; // 5 seconds
  private readonly PRICE_CACHE_TTL = 2000; // 2 seconds - prices update every batch interval
  private readonly VAPID_CACHE_TTL = 3600000; // 1 hour

  // Cache subscription requests to avoid repeated API calls for same user
  async getCachedSubscriptions(userId: string | null, fetcher: () => Promise<any[]>): Promise<any[]> {
    const now = Date.now();
    const cacheKey = userId || 'active-all';
    
    const cached = this.subscriptionCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.SUBSCRIPTION_CACHE_TTL) {
      return cached.subscriptions;
    }

    const subscriptions = await fetcher();
    this.subscriptionCache.set(cacheKey, { subscriptions, timestamp: now });
    return subscriptions;
  }

  // Cache price data from batch updates
  setPriceCache(symbol: string, priceData: any): void {
    this.priceCache.set(symbol, { ...priceData, timestamp: Date.now() });
  }

  getPriceCache(symbol: string): any | null {
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached;
    }
    return null;
  }

  // Cache VAPID details (set once, use forever)
  setCachedVapidDetails(details: any): void {
    this.vapidCache = { details, timestamp: Date.now() };
  }

  getCachedVapidDetails(): any | null {
    if (this.vapidCache && Date.now() - this.vapidCache.timestamp < this.VAPID_CACHE_TTL) {
      return this.vapidCache.details;
    }
    return null;
  }

  // Clear expired cache entries
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.subscriptionCache.entries()) {
      if (now - value.timestamp > this.SUBSCRIPTION_CACHE_TTL) {
        this.subscriptionCache.delete(key);
      }
    }
  }

  // Get cache stats for monitoring
  getStats(): { subscriptions: number; prices: number } {
    return {
      subscriptions: this.subscriptionCache.size,
      prices: this.priceCache.size,
    };
  }
}

const cache = new CacheManager();

// Configure web-push (CACHED - set once, reuse)
const configureWebPush = (): void => {
  const cached = cache.getCachedVapidDetails();
  if (!cached) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    cache.setCachedVapidDetails({ subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY });
    console.log('🔐 VAPID details cached for session');
  }
};

configureWebPush();

// Axios client for NestJS backend (with connection pooling for 5K+ users)
const nestApi = axios.create({
  baseURL: NESTJS_API_URL,
  timeout: 30000,
  headers: {
    'X-Service-Token': NESTJS_SERVICE_TOKEN,
    'Content-Type': 'application/json',
  },
  httpAgent: new (require('http').Agent)({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 50 }),
  httpsAgent: new (require('https').Agent)({ keepAlive: true, keepAliveMsecs: 1000, maxSockets: 50 }),
});

// Metrics for monitoring large-scale deployments
const metrics = {
  notificationsProcessed: 0,
  notificationsSent: 0,
  notificationsFailed: 0,
  priceUpdatesReceived: 0,
  priceUpdatesBatched: 0,
  cacheHits: 0,
  cacheMisses: 0,
  startTime: Date.now(),
  
  log(): void {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const successRate = this.notificationsSent + this.notificationsFailed > 0 
      ? ((this.notificationsSent / (this.notificationsSent + this.notificationsFailed)) * 100).toFixed(2)
      : '0';
    console.log(`
📊 METRICS (${uptime}s uptime):
  📬 Notifications: ${this.notificationsProcessed} processed, ${this.notificationsSent} sent, ${this.notificationsFailed} failed (${successRate}% success)
  💹 Prices: ${this.priceUpdatesReceived} received, ${this.priceUpdatesBatched} batched
  💾 Cache: ${this.cacheHits} hits, ${this.cacheMisses} misses (${this.cacheHits + this.cacheMisses > 0 ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2) : '0'}% hit rate)
    `);
  },
};

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
    // Use cache to avoid repeated API calls
    return await cache.getCachedSubscriptions(null, async () => {
      const res = await nestApi.get('/notifications/push/subscriptions/active');
      metrics.cacheMisses++;
      return res.data || [];
    });
  } catch (error) {
    console.error('❌ Error fetching active subscriptions:', error);
    metrics.cacheMisses++;
    return [];
  }
}

async function getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
  try {
    // Cache user-specific subscriptions
    return await cache.getCachedSubscriptions(userId, async () => {
      const res = await nestApi.get(`/notifications/push/subscriptions/user/${userId}`);
      metrics.cacheMisses++;
      return res.data || [];
    });
  } catch (error) {
    console.error(`❌ Error fetching subscriptions for user ${userId}:`, error);
    metrics.cacheMisses++;
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

    metrics.notificationsProcessed += notifications.length;
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
        metrics.notificationsFailed++;
        continue;
      }

      // Process in parallel batches for 5K+ users (max 50 concurrent sends)
      const batchSize = 50;
      for (let i = 0; i < subscriptions.length; i += batchSize) {
        const batch = subscriptions.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(sub => sendToSubscription(sub, notification))
        );
        successCount += results.filter(r => r).length;
        failCount += results.filter(r => !r).length;
      }

      console.log(`✅ Notification "${notification.title}": ${successCount} sent, ${failCount} failed`);
      metrics.notificationsSent += successCount;
      metrics.notificationsFailed += failCount;

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

// Finnhub symbol mappings (OANDA broker format) - 200+ TRADING PAIRS
// IMPORTANT: Only pairs available on Finnhub will return prices
// Pairs without price data will automatically be excluded from push-sender
const SYMBOL_MAPPINGS: Record<string, string> = {
  // ============== FOREX MAJOR PAIRS (7) ==============
  'EUR/USD': 'OANDA:EUR_USD',
  'GBP/USD': 'OANDA:GBP_USD',
  'USD/JPY': 'OANDA:USD_JPY',
  'USD/CHF': 'OANDA:USD_CHF',
  'AUD/USD': 'OANDA:AUD_USD',
  'USD/CAD': 'OANDA:USD_CAD',
  'NZD/USD': 'OANDA:NZD_USD',
  
  // ============== EUR CROSS PAIRS (20) ==============
  'EUR/GBP': 'OANDA:EUR_GBP',
  'EUR/JPY': 'OANDA:EUR_JPY',
  'EUR/CHF': 'OANDA:EUR_CHF',
  'EUR/AUD': 'OANDA:EUR_AUD',
  'EUR/CAD': 'OANDA:EUR_CAD',
  'EUR/NZD': 'OANDA:EUR_NZD',
  'EUR/SEK': 'OANDA:EUR_SEK',
  'EUR/NOK': 'OANDA:EUR_NOK',
  'EUR/DKK': 'OANDA:EUR_DKK',
  'EUR/CZK': 'OANDA:EUR_CZK',
  'EUR/HUF': 'OANDA:EUR_HUF',
  'EUR/PLN': 'OANDA:EUR_PLN',
  'EUR/RON': 'OANDA:EUR_RON',
  'EUR/RUB': 'OANDA:EUR_RUB',
  'EUR/INR': 'OANDA:EUR_INR',
  'EUR/TRY': 'OANDA:EUR_TRY',
  'EUR/MXN': 'OANDA:EUR_MXN',
  'EUR/ZAR': 'OANDA:EUR_ZAR',
  'EUR/BRL': 'OANDA:EUR_BRL',
  'EUR/SGD': 'OANDA:EUR_SGD',
  
  // ============== GBP CROSS PAIRS (15) ==============
  'GBP/JPY': 'OANDA:GBP_JPY',
  'GBP/CHF': 'OANDA:GBP_CHF',
  'GBP/AUD': 'OANDA:GBP_AUD',
  'GBP/CAD': 'OANDA:GBP_CAD',
  'GBP/NZD': 'OANDA:GBP_NZD',
  'GBP/SEK': 'OANDA:GBP_SEK',
  'GBP/NOK': 'OANDA:GBP_NOK',
  'GBP/DKK': 'OANDA:GBP_DKK',
  'GBP/SGD': 'OANDA:GBP_SGD',
  'GBP/HKD': 'OANDA:GBP_HKD',
  'GBP/ZAR': 'OANDA:GBP_ZAR',
  'GBP/INR': 'OANDA:GBP_INR',
  'GBP/TRY': 'OANDA:GBP_TRY',
  'GBP/MXN': 'OANDA:GBP_MXN',
  'GBP/BRL': 'OANDA:GBP_BRL',
  
  // ============== AUD CROSS PAIRS (12) ==============
  'AUD/JPY': 'OANDA:AUD_JPY',
  'AUD/CHF': 'OANDA:AUD_CHF',
  'AUD/CAD': 'OANDA:AUD_CAD',
  'AUD/NZD': 'OANDA:AUD_NZD',
  'AUD/SGD': 'OANDA:AUD_SGD',
  'AUD/HKD': 'OANDA:AUD_HKD',
  'AUD/CNY': 'OANDA:AUD_CNY',
  'AUD/INR': 'OANDA:AUD_INR',
  'AUD/THB': 'OANDA:AUD_THB',
  'AUD/MXN': 'OANDA:AUD_MXN',
  'AUD/SEK': 'OANDA:AUD_SEK',
  'AUD/NOK': 'OANDA:AUD_NOK',
  
  // ============== CAD CROSS PAIRS (8) ==============
  'CAD/JPY': 'OANDA:CAD_JPY',
  'CAD/CHF': 'OANDA:CAD_CHF',
  'CAD/SEK': 'OANDA:CAD_SEK',
  'CAD/NOK': 'OANDA:CAD_NOK',
  'CAD/SGD': 'OANDA:CAD_SGD',
  'CAD/HKD': 'OANDA:CAD_HKD',
  'CAD/CNY': 'OANDA:CAD_CNY',
  'CAD/MXN': 'OANDA:CAD_MXN',
  
  // ============== JPY CROSS PAIRS (10) ==============
  'NZD/JPY': 'OANDA:NZD_JPY',
  'CHF/JPY': 'OANDA:CHF_JPY',
  'SGD/JPY': 'OANDA:SGD_JPY',
  'HKD/JPY': 'OANDA:HKD_JPY',
  'CNY/JPY': 'OANDA:CNY_JPY',
  'INR/JPY': 'OANDA:INR_JPY',
  'THB/JPY': 'OANDA:THB_JPY',
  'SEK/JPY': 'OANDA:SEK_JPY',
  'NOK/JPY': 'OANDA:NOK_JPY',
  'ZAR/JPY': 'OANDA:ZAR_JPY',
  
  // ============== CHF CROSS PAIRS (6) ==============
  'NZD/CHF': 'OANDA:NZD_CHF',
  'SGD/CHF': 'OANDA:SGD_CHF',
  'HKD/CHF': 'OANDA:HKD_CHF',
  'CNY/CHF': 'OANDA:CNY_CHF',
  'INR/CHF': 'OANDA:INR_CHF',
  'ZAR/CHF': 'OANDA:ZAR_CHF',
  
  // ============== OTHER CROSS PAIRS (10) ==============
  'NZD/CAD': 'OANDA:NZD_CAD',
  'NZD/SGD': 'OANDA:NZD_SGD',
  'NZD/HKD': 'OANDA:NZD_HKD',
  'SGD/HKD': 'OANDA:SGD_HKD',
  'SGD/CNY': 'OANDA:SGD_CNY',
  'HKD/CNY': 'OANDA:HKD_CNY',
  'CNY/INR': 'OANDA:CNY_INR',
  'SEK/NOK': 'OANDA:SEK_NOK',
  'SEK/CHF': 'OANDA:SEK_CHF',
  'NOK/CHF': 'OANDA:NOK_CHF',
  
  // ============== USD EXOTIC PAIRS (20) ==============
  'USD/MXN': 'OANDA:USD_MXN',
  'USD/ZAR': 'OANDA:USD_ZAR',
  'USD/TRY': 'OANDA:USD_TRY',
  'USD/CNH': 'OANDA:USD_CNH',
  'USD/CNY': 'OANDA:USD_CNY',
  'USD/HKD': 'OANDA:USD_HKD',
  'USD/SGD': 'OANDA:USD_SGD',
  'USD/INR': 'OANDA:USD_INR',
  'USD/THB': 'OANDA:USD_THB',
  'USD/MYR': 'OANDA:USD_MYR',
  'USD/IDR': 'OANDA:USD_IDR',
  'USD/PHP': 'OANDA:USD_PHP',
  'USD/SEK': 'OANDA:USD_SEK',
  'USD/NOK': 'OANDA:USD_NOK',
  'USD/DKK': 'OANDA:USD_DKK',
  'USD/CZK': 'OANDA:USD_CZK',
  'USD/HUF': 'OANDA:USD_HUF',
  'USD/PLN': 'OANDA:USD_PLN',
  'USD/RUB': 'OANDA:USD_RUB',
  'USD/BRL': 'OANDA:USD_BRL',
  
  // ============== PRECIOUS METALS (6) ==============
  'XAU/USD': 'OANDA:XAU_USD', // Gold
  'XAG/USD': 'OANDA:XAG_USD', // Silver
  'XPT/USD': 'OANDA:XPT_USD', // Platinum
  'XPD/USD': 'OANDA:XPD_USD', // Palladium
  'XAU/EUR': 'OANDA:XAU_EUR', // Gold vs Euro
  'XAU/GBP': 'OANDA:XAU_GBP', // Gold vs Pound
  
  // ============== ENERGY COMMODITIES (8) ==============
  'BCO/USD': 'OANDA:BCO_USD', // Brent Crude Oil
  'WTI/USD': 'OANDA:WTICO_USD', // WTI Crude Oil
  'NG/USD': 'OANDA:NGAS_USD', // Natural Gas
  'CO/USD': 'OANDA:COIL_USD', // Crude Oil
  'RB/USD': 'OANDA:RBOB_USD', // RBOB Gasoline
  'HO/USD': 'OANDA:HO_USD', // Heating Oil
  'CL/USD': 'OANDA:CL_USD', // Crude Oil Futures
  'GC/USD': 'OANDA:GC_USD', // Gold Futures
  
  // ============== AGRICULTURAL COMMODITIES (8) ==============
  'ZW/USD': 'OANDA:ZW_USD', // Wheat
  'ZC/USD': 'OANDA:ZC_USD', // Corn
  'ZS/USD': 'OANDA:ZS_USD', // Soybeans
  'CC/USD': 'OANDA:CC_USD', // Cocoa
  'SB/USD': 'OANDA:SB_USD', // Sugar
  'CT/USD': 'OANDA:CT_USD', // Cotton
  'KC/USD': 'OANDA:KC_USD', // Coffee
  'OJ/USD': 'OANDA:OJ_USD', // Orange Juice
  
  // ============== US INDICES (10) ==============
  'NAS/USD': 'OANDA:NAS100_USD', // Nasdaq 100
  'US100': 'OANDA:NAS100_USD', // Nasdaq 100 (alt)
  'US100/USD': 'OANDA:NAS100_USD', // Nasdaq 100 (alt)
  'SPX/USD': 'OANDA:SPX500_USD', // S&P 500
  'US500': 'OANDA:SPX500_USD', // S&P 500 (alt)
  'US500/USD': 'OANDA:SPX500_USD', // S&P 500 (alt)
  'US30': 'OANDA:US30_USD', // Dow Jones 30
  'US30/USD': 'OANDA:US30_USD', // Dow Jones 30 (alt)
  'RUT/USD': 'OANDA:RUT_USD', // Russell 2000
  'NYA/USD': 'OANDA:NYA_USD', // NYSE Composite
  
  // ============== EUROPEAN INDICES (8) ==============
  'GER30': 'OANDA:DE30_EUR', // DAX 30
  'GER30/EUR': 'OANDA:DE30_EUR', // DAX 30 (alt)
  'UK100': 'OANDA:UK100_GBP', // FTSE 100
  'UK100/GBP': 'OANDA:UK100_GBP', // FTSE 100 (alt)
  'FRA40': 'OANDA:FR40_EUR', // CAC 40
  'FRA40/EUR': 'OANDA:FR40_EUR', // CAC 40 (alt)
  'STOXX50': 'OANDA:STOXX50E_EUR', // STOXX 50
  'AUS200': 'OANDA:AU200_AUD', // ASX 200
  
  // ============== ASIAN INDICES (10) ==============
  'JPN225': 'OANDA:JP225_USD', // Nikkei 225
  'JPN225/USD': 'OANDA:JP225_USD', // Nikkei 225 (alt)
  'HK50': 'OANDA:HK50_HKD', // Hang Seng
  'CHINA50': 'OANDA:CHINA50_CNY', // China A50
  'SXIE': 'OANDA:SXIE_CNY', // Shanghai Composite
  'SGX30': 'OANDA:SGX30_SGD', // STI (Singapore)
  'SETINDEX': 'OANDA:SET_THB', // SET (Thailand)
  'MERIT50': 'OANDA:MERIT50_MYR', // KLCI (Malaysia)
  'PSE': 'OANDA:PSE_PHP', // PSE (Philippines)
  'JKSE': 'OANDA:JKSE_IDR', // JSX (Indonesia)
  
  // ============== CRYPTOCURRENCIES - MAJOR (15) ==============
  'BTC/USD': 'BINANCE:BTCUSDT',
  'ETH/USD': 'BINANCE:ETHUSDT',
  'BNB/USD': 'BINANCE:BNBUSDT',
  'XRP/USD': 'BINANCE:XRPUSDT',
  'ADA/USD': 'BINANCE:ADAUSDT',
  'SOL/USD': 'BINANCE:SOLUSDT',
  'DOGE/USD': 'BINANCE:DOGEUSDT',
  'DOT/USD': 'BINANCE:DOTUSDT',
  'MATIC/USD': 'BINANCE:MATICUSDT',
  'LTC/USD': 'BINANCE:LTCUSDT',
  'AVAX/USD': 'BINANCE:AVAXUSDT',
  'ATOM/USD': 'BINANCE:ATOMUSDT',
  'FIL/USD': 'BINANCE:FILUSDT',
  'LINK/USD': 'BINANCE:LINKUSDT',
  'NEAR/USD': 'BINANCE:NEARUSDT',
  
  // ============== CRYPTOCURRENCIES - ALTCOINS (25) ==============
  'SHIB/USD': 'BINANCE:SHIBUUSDT',
  'ARB/USD': 'BINANCE:ARBUSDT',
  'BLUR/USD': 'BINANCE:BLURUSDT',
  'APE/USD': 'BINANCE:APEUSDT',
  'GALA/USD': 'BINANCE:GALAUSDT',
  'SAND/USD': 'BINANCE:SANDUSDT',
  'MANA/USD': 'BINANCE:MANAUSDT',
  'ENJ/USD': 'BINANCE:ENJUSDT',
  'FLOW/USD': 'BINANCE:FLOWUSDT',
  'ICP/USD': 'BINANCE:ICPUSDT',
  'THETA/USD': 'BINANCE:THETAUSDT',
  'VET/USD': 'BINANCE:VETUSDT',
  'TRX/USD': 'BINANCE:TRXUSDT',
  'ETC/USD': 'BINANCE:ETCUSDT',
  'ZEC/USD': 'BINANCE:ZECUSDT',
  'XMR/USD': 'BINANCE:XMRUSDT',
  'DASH/USD': 'BINANCE:DASHUSDT',
  'BCH/USD': 'BINANCE:BCHUSDT',
  'BSV/USD': 'BINANCE:BSVUSDT',
  'DYDX/USD': 'BINANCE:DYDXUSDT',
  'AAVE/USD': 'BINANCE:AAVEUSDT',
  'UNI/USD': 'BINANCE:UNIUSDT',
  'SUSHI/USD': 'BINANCE:SUSHIUSDT',
  'SNX/USD': 'BINANCE:SNXUSDT',
  'CRV/USD': 'BINANCE:CRVUSDT',
  
  // ============== CRYPTOCURRENCIES - STABLECOINS & LAYER 2 (10) ==============
  'USDT/USD': 'BINANCE:USDTUSDT',
  'USDC/USD': 'BINANCE:USDCUSDT',
  'BUSD/USD': 'BINANCE:BUSDUSDT',
  'DAI/USD': 'BINANCE:DAIUSDT',
  'FRAX/USD': 'BINANCE:FRAXUSDT',
  'OP/USD': 'BINANCE:OPUSDT',
  'LIDO/USD': 'BINANCE:LDOUSDT',
  'ARBITRUM/USD': 'BINANCE:ARBITRUSUSDT',
  'OPTIMISM/USD': 'BINANCE:OPTIMISMUSDT',
  'ZKSPACES/USD': 'BINANCE:ZKSPACESUSDT',
  
  // ============== MULTI-PAIR CROSS CRYPTOS (8) ==============
  'BTC/EUR': 'BINANCE:BTCEUR',
  'BTC/GBP': 'BINANCE:BTCGBP',
  'ETH/EUR': 'BINANCE:ETHEUR',
  'ETH/GBP': 'BINANCE:ETHGBP',
  'ETH/BTC': 'BINANCE:ETHBTC',
  'BNB/BTC': 'BINANCE:BNBBTC',
  'DOGE/BTC': 'BINANCE:DOGEBTC',
  'LTC/BTC': 'BINANCE:LTCBTC',
  
  // ============== ADDITIONAL FOREX EXOTICS (12) ==============
  'USD/QAR': 'OANDA:USD_QAR',
  'USD/AED': 'OANDA:USD_AED',
  'USD/SAR': 'OANDA:USD_SAR',
  'USD/KWD': 'OANDA:USD_KWD',
  'USD/OMR': 'OANDA:USD_OMR',
  'USD/JOD': 'OANDA:USD_JOD',
  'USD/LBP': 'OANDA:USD_LBP',
  'USD/IQD': 'OANDA:USD_IQD',
  'EUR/QAR': 'OANDA:EUR_QAR',
  'GBP/AED': 'OANDA:GBP_AED',
  'AUD/ZAR': 'OANDA:AUD_ZAR',
  'NZD/ZAR': 'OANDA:NZD_ZAR',
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

        metrics.priceUpdatesBatched += batch.length;
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
          metrics.priceUpdatesReceived += message.data.length;
          
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
              // Update cache as well for client queries
              const priceData = {
                symbol,
                mid_price: price,
                ask_price: price + spread / 2,
                bid_price: price - spread / 2,
                timestamp: ts,
                updated_at: new Date().toISOString()
              };
              priceBatch[symbol] = priceData;
              cache.setPriceCache(symbol, priceData);
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
  console.log(`� Live market data: ${Object.keys(SYMBOL_MAPPINGS).length} pairs`);
  console.log(`💾 Cache system: enabled (subscriptions, prices, VAPID keys)`);
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

  // Periodic cache cleanup and metrics logging (every 60 seconds)
  setInterval(() => {
    cache.clearExpiredCache();
    metrics.log();
    console.log(`💾 Cache stats: ${JSON.stringify(cache.getStats())}`);
  }, 60000);

  // Keep process alive
  process.on('SIGTERM', () => {
    console.log('👋 Shutting down gracefully...');
    metrics.log();
    if (priceWebSocket) {
      priceWebSocket.close();
    }
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('👋 Shutting down gracefully...');
    metrics.log();
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
