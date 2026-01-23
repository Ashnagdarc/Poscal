# 🔧 Push-Sender Migration Implementation Guide
## Step-by-Step Guide to Migrate push-sender from Supabase to NestJS

---

## 📋 Prerequisites

- [x] NestJS backend running on `http://localhost:3000`
- [x] PostgreSQL database deployed on Contabo VPS
- [x] NotificationsModule with basic endpoints
- [ ] Missing endpoints implemented (see below)
- [ ] Service authentication configured

---

## Phase 1: NestJS Backend Extensions

### Step 1.1: Create Update Notification Status DTO

Create `backend/src/notifications/dto/update-notification-status.dto.ts`:

```typescript
import { IsEnum, IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed'
}

export class UpdateNotificationStatusDto {
  @IsEnum(NotificationStatus)
  status: NotificationStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  sent_at?: Date;

  @IsOptional()
  @IsString()
  error_message?: string;
}
```

### Step 1.2: Add Service Methods to NotificationsService

Update `backend/src/notifications/notifications.service.ts`:

```typescript
// Add to NotificationsService class

/**
 * Update notification status (used by push-sender)
 */
async updateNotificationStatus(
  id: string,
  status: string,
  sentAt?: Date,
  errorMessage?: string
): Promise<PushNotificationQueue> {
  const updateData: any = {
    status,
    updated_at: new Date(),
  };

  if (sentAt) {
    updateData.sent_at = sentAt;
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  // Increment attempts counter
  await this.pushQueueRepository
    .createQueryBuilder()
    .update(PushNotificationQueue)
    .set({
      ...updateData,
      attempts: () => 'attempts + 1',
    })
    .where('id = :id', { id })
    .execute();

  return await this.pushQueueRepository.findOne({ where: { id } });
}

/**
 * Get all active push subscriptions (used by push-sender)
 */
async getAllActiveSubscriptions(): Promise<PushSubscription[]> {
  return await this.pushSubscriptionRepository.find({
    where: { is_active: true },
  });
}

/**
 * Batch update notification statuses (for performance)
 */
async batchUpdateNotificationStatus(
  ids: string[],
  status: string
): Promise<void> {
  await this.pushQueueRepository
    .createQueryBuilder()
    .update(PushNotificationQueue)
    .set({
      status,
      sent_at: new Date(),
      updated_at: new Date(),
    })
    .whereInIds(ids)
    .execute();
}
```

### Step 1.3: Add Controller Endpoints

Update `backend/src/notifications/notifications.controller.ts`:

```typescript
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';

// Add to NotificationsController class

/**
 * Update notification status
 * Used by push-sender to mark notifications as sent/failed
 */
@Patch('push/:id/status')
@UseGuards(ServiceTokenGuard) // Use service auth, not user JWT
async updateNotificationStatus(
  @Param('id') id: string,
  @Body() dto: UpdateNotificationStatusDto
) {
  return this.notificationsService.updateNotificationStatus(
    id,
    dto.status,
    dto.sent_at,
    dto.error_message
  );
}

/**
 * Get all active subscriptions
 * Used by push-sender to get all subscriptions for broadcast
 */
@Get('push/subscriptions/active')
@UseGuards(ServiceTokenGuard)
async getAllActiveSubscriptions() {
  return this.notificationsService.getAllActiveSubscriptions();
}

/**
 * Batch update notification statuses
 * Optimization for push-sender to mark multiple as sent
 */
@Post('push/batch-status')
@UseGuards(ServiceTokenGuard)
async batchUpdateStatus(
  @Body() body: { ids: string[]; status: string }
) {
  await this.notificationsService.batchUpdateNotificationStatus(
    body.ids,
    body.status
  );
  return { success: true, updated: body.ids.length };
}
```

### Step 1.4: Create Service Token Guard

Create `backend/src/auth/guards/service-token.guard.ts`:

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];

    const validToken = this.configService.get<string>('SERVICE_TOKEN');

    if (!token || !validToken) {
      throw new UnauthorizedException('Service token is required');
    }

    if (token !== validToken) {
      throw new UnauthorizedException('Invalid service token');
    }

    return true;
  }
}
```

### Step 1.5: Update Auth Module

Update `backend/src/auth/auth.module.ts`:

```typescript
import { ServiceTokenGuard } from './guards/service-token.guard';

@Module({
  // ... existing code
  providers: [
    AuthService,
    JwtStrategy,
    ServiceTokenGuard, // Add this
  ],
  exports: [AuthService, ServiceTokenGuard], // Export guard
})
export class AuthModule {}
```

### Step 1.6: Update Environment Variables

Add to `backend/.env`:

```env
# Service-to-Service Authentication
SERVICE_TOKEN=poscal_service_2026_secure_token_change_in_production
```

### Step 1.7: Add Prices Batch Update (Optional)

Update `backend/src/prices/prices.controller.ts`:

```typescript
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';

@Post('batch-update')
@UseGuards(ServiceTokenGuard)
async batchUpdatePrices(@Body() prices: Array<{
  symbol: string;
  bid_price: number;
  mid_price: number;
  ask_price: number;
  timestamp: number;
}>) {
  return this.pricesService.batchUpsert(prices);
}
```

Update `backend/src/prices/prices.service.ts`:

```typescript
async batchUpsert(prices: Array<{
  symbol: string;
  bid_price: number;
  mid_price: number;
  ask_price: number;
  timestamp: number;
}>): Promise<void> {
  for (const price of prices) {
    await this.priceCacheRepository.upsert(
      {
        ...price,
        updated_at: new Date(),
      },
      ['symbol']
    );
  }
}
```

---

## Phase 2: Push-Sender Migration

### Step 2.1: Update Package Dependencies

Update `push-sender/package.json`:

```json
{
  "dependencies": {
    "@types/ws": "^8.18.1",
    "axios": "^1.7.9",
    "dotenv": "^17.2.3",
    "web-push": "^3.6.7",
    "ws": "^8.19.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "@types/web-push": "^3.6.3",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

Run:
```bash
cd push-sender
npm uninstall @supabase/supabase-js
npm install axios
```

### Step 2.2: Create NestJS API Client

Create `push-sender/nestjs-client.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';

const NESTJS_API_URL = process.env.NESTJS_API_URL || 'http://localhost:3000';
const SERVICE_TOKEN = process.env.NESTJS_SERVICE_TOKEN;

if (!SERVICE_TOKEN) {
  throw new Error('NESTJS_SERVICE_TOKEN environment variable is required');
}

export const nestApi: AxiosInstance = axios.create({
  baseURL: NESTJS_API_URL,
  headers: {
    'X-Service-Token': SERVICE_TOKEN,
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
});

// Add response interceptor for error handling
nestApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('NestJS API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw error;
  }
);

/**
 * Get pending push notifications
 */
export async function getPendingNotifications(limit: number = 100) {
  const response = await nestApi.get('/notifications/push/pending', {
    params: { limit },
  });
  return response.data;
}

/**
 * Get all active push subscriptions
 */
export async function getActiveSubscriptions() {
  const response = await nestApi.get('/notifications/push/subscriptions/active');
  return response.data;
}

/**
 * Get user-specific push subscriptions
 */
export async function getUserSubscriptions(userId: string) {
  const response = await nestApi.get('/notifications/push/subscriptions', {
    params: { userId },
  });
  return response.data;
}

/**
 * Update notification status
 */
export async function updateNotificationStatus(
  id: string,
  status: 'sent' | 'failed',
  errorMessage?: string
) {
  await nestApi.patch(`/notifications/push/${id}/status`, {
    status,
    sent_at: new Date().toISOString(),
    error_message: errorMessage,
  });
}

/**
 * Batch update notification statuses (performance optimization)
 */
export async function batchUpdateNotificationStatus(
  ids: string[],
  status: 'sent' | 'failed'
) {
  await nestApi.post('/notifications/push/batch-status', {
    ids,
    status,
  });
}

/**
 * Batch update price cache
 */
export async function batchUpdatePrices(prices: Array<{
  symbol: string;
  bid_price: number;
  mid_price: number;
  ask_price: number;
  timestamp: number;
}>) {
  await nestApi.post('/prices/batch-update', prices);
}
```

### Step 2.3: Refactor Main Service

Update `push-sender/index.ts`:

```typescript
import dotenv from 'dotenv';
import webpush from 'web-push';
import WebSocket from 'ws';
import {
  getPendingNotifications,
  getActiveSubscriptions,
  getUserSubscriptions,
  updateNotificationStatus,
  batchUpdatePrices,
} from './nestjs-client';

dotenv.config();

// Environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '30000');
const BATCH_INTERVAL = parseInt(process.env.BATCH_INTERVAL || '5000');

// Configure web-push
webpush.setVapidDetails(
  'mailto:hello@poscal.trade',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Send notification to a single subscription
 */
async function sendToSubscription(
  subscription: {
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
  },
  payload: any
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh_key,
          auth: subscription.auth_key,
        },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error: any) {
    // Handle expired subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log(`🗑️  Subscription expired: ${subscription.endpoint}`);
      // TODO: Mark subscription as inactive via API
    }
    console.error('❌ Failed to send notification:', error.message);
    return false;
  }
}

/**
 * Process push notification queue
 */
async function processPushQueue() {
  try {
    // Get pending notifications from NestJS API
    const notifications = await getPendingNotifications(100);

    if (!notifications || notifications.length === 0) {
      return;
    }

    console.log(`📬 Processing ${notifications.length} pending notifications`);

    for (const notification of notifications) {
      let successCount = 0;
      let failCount = 0;

      // Get subscriptions for this user
      const subscriptions = await getUserSubscriptions(notification.user_id);

      if (!subscriptions || subscriptions.length === 0) {
        console.log(`⚠️  No subscriptions for user ${notification.user_id}`);
        await updateNotificationStatus(notification.id, 'failed', 'No active subscriptions');
        continue;
      }

      // Send to all user's subscriptions
      const payload = {
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        url: notification.url,
        data: notification.data,
      };

      for (const subscription of subscriptions) {
        const success = await sendToSubscription(subscription, payload);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log(`✅ Notification "${notification.title}": ${successCount} sent, ${failCount} failed`);

      // Mark notification as sent
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
const RECONNECT_DELAY = 5000;

// Symbol mappings (same as before)
const SYMBOL_MAPPINGS: Record<string, string> = {
  'EUR/USD': 'OANDA:EUR_USD',
  'GBP/USD': 'OANDA:GBP_USD',
  'USD/JPY': 'OANDA:USD_JPY',
  // ... rest of mappings
};

/**
 * Connect to Finnhub WebSocket
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

      Object.values(SYMBOL_MAPPINGS).forEach(symbol => {
        priceWebSocket?.send(JSON.stringify({ type: 'subscribe', symbol }));
      });
    });

    const priceBatch: Record<string, any> = {};

    // Batch updates every 5 seconds
    setInterval(async () => {
      const batch = Object.values(priceBatch);
      if (batch.length === 0) return;

      try {
        // Use NestJS API instead of Supabase
        await batchUpdatePrices(batch);
        batch.forEach(item => console.log(`💹 Batched update ${item.symbol}: ${item.mid_price}`));
      } catch (err) {
        console.error('❌ Error in batched upsert:', err);
      }

      // Clear batch
      for (const k of Object.keys(priceBatch)) delete priceBatch[k];
    }, BATCH_INTERVAL);

    priceWebSocket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
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
              priceBatch[symbol] = {
                symbol,
                mid_price: price,
                ask_price: price + spread / 2,
                bid_price: price - spread / 2,
                timestamp: ts,
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
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔄 Reconnecting in ${RECONNECT_DELAY / 1000}s...`);
        setTimeout(connectPriceWebSocket, RECONNECT_DELAY);
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
  console.log(`🔗 Connected to NestJS API`);

  // Start WebSocket
  connectPriceWebSocket();

  // Initial processing
  await processPushQueue();

  // Run on interval
  setInterval(async () => {
    await processPushQueue();
  }, POLL_INTERVAL);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('👋 Shutting down gracefully...');
    if (priceWebSocket) priceWebSocket.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('👋 Shutting down gracefully...');
    if (priceWebSocket) priceWebSocket.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
```

### Step 2.4: Update Environment Variables

Update `push-sender/.env`:

```env
# NestJS API Configuration
NESTJS_API_URL=http://localhost:3000
NESTJS_SERVICE_TOKEN=poscal_service_2026_secure_token_change_in_production

# VAPID Keys (same as before)
VAPID_PUBLIC_KEY=BE7EfMew8pPJTxly2cBT7PxInN62M2HWPB0yB-bNGwUniu0b2ouoLbEmfiQjHu5vowBcW0caNzaWpwP9mBZ0CM0
VAPID_PRIVATE_KEY=your-private-key-here

# Finnhub (same as before)
FINNHUB_API_KEY=your_finnhub_api_key_here

# Polling intervals
POLL_INTERVAL=30000
BATCH_INTERVAL=5000
```

### Step 2.5: Update Docker Compose

Update `push-sender/docker-compose.yml`:

```yaml
version: '3.8'

services:
  push-sender:
    build: .
    container_name: poscal-push-sender
    restart: unless-stopped
    environment:
      NESTJS_API_URL: ${NESTJS_API_URL:-http://backend:3000}
      NESTJS_SERVICE_TOKEN: ${NESTJS_SERVICE_TOKEN}
      VAPID_PUBLIC_KEY: ${VAPID_PUBLIC_KEY}
      VAPID_PRIVATE_KEY: ${VAPID_PRIVATE_KEY}
      FINNHUB_API_KEY: ${FINNHUB_API_KEY}
      POLL_INTERVAL: ${POLL_INTERVAL:-30000}
      BATCH_INTERVAL: ${BATCH_INTERVAL:-5000}
    networks:
      - poscal-network
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "pgrep", "-f", "node"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    image: your-nestjs-backend:latest
    container_name: poscal-backend
    networks:
      - poscal-network
    # ... backend configuration

networks:
  poscal-network:
    driver: bridge
```

---

## Phase 3: Testing

### Step 3.1: Test Backend Endpoints

```bash
cd backend

# 1. Start backend
npm run start:dev

# 2. Test health
curl http://localhost:3000/health

# 3. Test service token guard (should fail without token)
curl http://localhost:3000/notifications/push/subscriptions/active

# 4. Test with service token
curl -H "X-Service-Token: poscal_service_2026_secure_token_change_in_production" \
  http://localhost:3000/notifications/push/subscriptions/active

# 5. Test update notification status
curl -X PATCH \
  -H "X-Service-Token: poscal_service_2026_secure_token_change_in_production" \
  -H "Content-Type: application/json" \
  -d '{"status":"sent","sent_at":"2026-01-23T15:00:00Z"}' \
  http://localhost:3000/notifications/push/some-notification-id/status
```

### Step 3.2: Test Push-Sender

```bash
cd push-sender

# 1. Install dependencies
npm install

# 2. Run in dev mode
npm run dev

# Expected output:
# 🚀 Push Notification Sender started
# 📊 Polling for notifications every 30 seconds
# 🔗 Connected to NestJS API
# 🔌 Connecting to Finnhub WebSocket...
```

### Step 3.3: End-to-End Test

```bash
# 1. Queue a test notification via NestJS API
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user-id",
    "title": "Test Notification",
    "body": "This is a test",
    "icon": "/icon.png"
  }' \
  http://localhost:3000/notifications/push

# 2. Check push-sender logs
# Should see within 30 seconds:
# 📬 Processing 1 pending notifications
# ✅ Notification "Test Notification": 1 sent, 0 failed
```

---

## Phase 4: Deployment

### Step 4.1: Update Production Environment Variables

On your VPS:

```bash
# Backend .env
SERVICE_TOKEN=<generate-strong-random-token>

# Push-sender .env
NESTJS_API_URL=http://localhost:3000
NESTJS_SERVICE_TOKEN=<same-token-as-backend>
```

### Step 4.2: Deploy Backend

```bash
cd backend
npm run build
pm2 restart poscal-backend
```

### Step 4.3: Deploy Push-Sender

```bash
cd push-sender
npm run build
pm2 restart poscal-push-sender
```

---

## 🎯 Success Criteria

- [ ] Backend compiles with 0 errors
- [ ] All new endpoints respond with 200 status
- [ ] Service token authentication works
- [ ] Push-sender connects to NestJS API
- [ ] Notifications are queued and sent successfully
- [ ] Price updates are received and stored
- [ ] No Supabase dependencies remain in push-sender
- [ ] Docker Compose works with both services

---

## 📊 Rollback Plan

If migration fails:

1. Revert `push-sender/index.ts` to use Supabase
2. Reinstall `@supabase/supabase-js`
3. Use old environment variables
4. Keep Supabase project running temporarily

---

**Estimated Total Time:** 3-4 hours  
**Difficulty:** Medium  
**Risk Level:** Low (can rollback easily)
