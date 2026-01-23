# 🔔 Push Notification Integration Analysis
## NestJS Backend ↔️ Push-Sender Microservice Compatibility

---

## 🎯 Executive Summary

**CRITICAL FINDING:** The existing `push-sender` microservice **WILL NOT WORK** with the new NestJS backend without modifications. It uses Supabase-specific features (RPC functions, Supabase client) that don't exist in the PostgreSQL/NestJS setup.

**STATUS:** ⚠️ **REQUIRES MIGRATION** - The push-sender needs to be refactored to use NestJS REST API endpoints instead of direct Supabase queries.

---

## 📊 Current Architecture

### Push-Sender Service (Existing)
```
┌─────────────────────────────────────────┐
│      push-sender (Node.js Service)      │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Supabase Client                  │ │
│  │  - RPC Functions                  │ │
│  │  - Direct DB Queries              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Web Push Library                 │ │
│  │  - VAPID Authentication           │ │
│  │  - Push API                       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Finnhub WebSocket                │ │
│  │  - Live Forex Prices              │ │
│  │  - Price Cache Updates            │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
           ↓
    ┌──────────────┐
    │  Supabase DB │
    └──────────────┘
```

### NestJS Backend (New)
```
┌─────────────────────────────────────────┐
│       NestJS Backend (New)              │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  NotificationsModule              │ │
│  │  - NotificationsService           │ │
│  │  - NotificationsController        │ │
│  │  - TypeORM Entities               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  REST API Endpoints:                    │
│  - POST /notifications/push             │
│  - GET  /notifications/push/pending     │
│  - POST /notifications/push/subscribe   │
│  - GET  /notifications/push/subscriptions│
└─────────────────────────────────────────┘
           ↓
    ┌──────────────────┐
    │  PostgreSQL DB   │
    │  (Contabo VPS)   │
    └──────────────────┘
```

---

## 🔍 Detailed Compatibility Analysis

### 1. Database Connection Layer

#### Push-Sender (Current)
```typescript
// Uses @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

**Issues:**
- ❌ No Supabase in new architecture
- ❌ Service role key won't exist
- ❌ Can't use Supabase client methods

#### Required Change
```typescript
// Replace with HTTP client for NestJS API
import axios from 'axios';

const nestApi = axios.create({
  baseURL: process.env.NESTJS_API_URL || 'http://localhost:3000',
  headers: {
    'Authorization': `Bearer ${process.env.NESTJS_SERVICE_TOKEN}`
  }
});
```

---

### 2. RPC Functions (CRITICAL INCOMPATIBILITY)

#### Push-Sender Uses 2 Supabase RPC Functions

**Function 1: `get_active_push_subscriptions`**
```typescript
// push-sender/index.ts:57
const { data, error } = await supabase.rpc('get_active_push_subscriptions');
```

**Function 2: `get_user_push_subscriptions`**
```typescript
// push-sender/index.ts:76
const { data, error } = await supabase.rpc('get_user_push_subscriptions', {
  p_user_id: userId
});
```

**Impact:** ❌ **CRITICAL** - These RPC functions DO NOT exist in PostgreSQL database. They were Supabase edge functions.

**Solution:** Replace with NestJS REST API calls:

```typescript
// Replace get_active_push_subscriptions
async function getActiveSubscriptions() {
  const response = await nestApi.get('/notifications/push/subscriptions');
  return response.data;
}

// Replace get_user_push_subscriptions
async function getUserSubscriptions(userId: string) {
  const response = await nestApi.get('/notifications/push/subscriptions', {
    params: { userId }
  });
  return response.data;
}
```

---

### 3. Push Notification Queue Polling

#### Push-Sender (Current)
```typescript
// Direct Supabase query
const { data: notifications } = await supabase
  .from('push_notification_queue')
  .select('*')
  .eq('status', 'pending')
  .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
  .order('created_at', { ascending: true })
  .limit(100);
```

**Issues:**
- ❌ Direct database access via Supabase client
- ❌ Uses Supabase query builder syntax

#### Required Change
```typescript
// Use NestJS endpoint
async function getPendingNotifications() {
  const response = await nestApi.get('/notifications/push/pending');
  return response.data;
}
```

**NestJS Endpoint Already Implemented:** ✅
```typescript
// backend/src/notifications/notifications.controller.ts
@Get('push/pending')
@UseGuards(JwtAuthGuard)
async getPendingNotifications() {
  return this.notificationsService.getPendingPushNotifications(100);
}
```

---

### 4. Notification Status Updates

#### Push-Sender (Current)
```typescript
// Mark notification as sent
await supabase
  .from('push_notification_queue')
  .update({ 
    status: 'sent', 
    processed_at: new Date().toISOString() 
  })
  .eq('id', notification.id);
```

**Issues:**
- ❌ Direct database update via Supabase

#### Required Change
```typescript
// Use NestJS endpoint (needs to be added)
async function markNotificationSent(id: string) {
  await nestApi.patch(`/notifications/push/${id}/status`, {
    status: 'sent',
    sent_at: new Date().toISOString()
  });
}
```

**Action Required:** ⚠️ Need to add this endpoint to NestJS backend:
```typescript
@Patch('push/:id/status')
@UseGuards(JwtAuthGuard)
async updateNotificationStatus(
  @Param('id') id: string,
  @Body() dto: UpdateNotificationStatusDto
) {
  return this.notificationsService.updateNotificationStatus(id, dto);
}
```

---

### 5. Web Push Sending (COMPATIBLE ✅)

#### Push-Sender Web Push Logic
```typescript
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:hello@poscal.trade',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

async function sendToSubscription(subscription, payload) {
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
```

**Good News:** ✅ **NO CHANGES NEEDED** - This part is database-agnostic and works with any backend.

---

### 6. Price Cache Updates (COMPATIBLE ✅)

#### Push-Sender Finnhub WebSocket Integration
```typescript
// Batch price updates to Supabase
await supabase
  .from('price_cache')
  .upsert(batch, { onConflict: 'symbol' });
```

**Issues:**
- ⚠️ Minor - Uses Supabase client for price cache updates

#### Options:
1. **Keep in push-sender** - Add NestJS endpoint for price cache upsert
2. **Move to NestJS** - Create scheduled task in NestJS to poll Finnhub
3. **Separate service** - Keep price updates isolated

**Recommendation:** Keep in push-sender, add endpoint:
```typescript
@Post('prices/batch-update')
async batchUpdatePrices(@Body() prices: UpdatePricesDto[]) {
  return this.pricesService.batchUpsert(prices);
}
```

---

## 🛠️ Required Changes Summary

### Phase 1: NestJS Backend Updates (Add Missing Endpoints)

1. **Add Update Notification Status Endpoint**
   ```typescript
   // notifications.controller.ts
   @Patch('push/:id/status')
   async updateNotificationStatus(
     @Param('id') id: string,
     @Body() dto: UpdateNotificationStatusDto
   ) { ... }
   ```

2. **Add Filter by User ID to Subscriptions Endpoint**
   ```typescript
   // notifications.controller.ts
   @Get('push/subscriptions')
   async getUserSubscriptions(@Query('userId') userId?: string) {
     return userId 
       ? this.notificationsService.getUserSubscriptions(userId)
       : this.notificationsService.getAllActiveSubscriptions();
   }
   ```

3. **Add Batch Price Update Endpoint**
   ```typescript
   // prices.controller.ts
   @Post('batch-update')
   async batchUpdatePrices(@Body() prices: UpdatePricesDto[]) { ... }
   ```

4. **Add Service Token Authentication**
   ```typescript
   // Create ServiceTokenGuard for internal service-to-service auth
   // push-sender will use this to authenticate with NestJS
   ```

### Phase 2: Push-Sender Migration

1. **Replace Supabase Client with HTTP Client**
   ```bash
   npm install axios
   npm uninstall @supabase/supabase-js
   ```

2. **Update All Database Queries**
   - Replace RPC calls with REST API calls
   - Replace direct queries with endpoint calls
   - Update error handling for HTTP responses

3. **Update Environment Variables**
   ```env
   # Remove
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   
   # Add
   NESTJS_API_URL=http://localhost:3000
   NESTJS_SERVICE_TOKEN=<generate-secure-token>
   ```

4. **Update Docker Compose**
   - Add link to NestJS container
   - Update environment variables
   - Add health check for NestJS API

---

## 📋 Migration Checklist

### Backend (NestJS)
- [ ] Add `UpdateNotificationStatusDto`
- [ ] Add `PATCH /notifications/push/:id/status` endpoint
- [ ] Add `getAllActiveSubscriptions()` method to NotificationsService
- [ ] Add `POST /prices/batch-update` endpoint
- [ ] Implement ServiceTokenGuard for internal auth
- [ ] Generate service token for push-sender
- [ ] Test all endpoints with Postman/curl

### Push-Sender
- [ ] Install axios, remove @supabase/supabase-js
- [ ] Create NestJS API client wrapper
- [ ] Replace `get_active_push_subscriptions` RPC call
- [ ] Replace `get_user_push_subscriptions` RPC call
- [ ] Replace push queue polling query
- [ ] Replace notification status update query
- [ ] Replace price cache batch update
- [ ] Update environment variables
- [ ] Update Docker Compose configuration
- [ ] Test end-to-end notification flow

### Testing
- [ ] Unit tests for new NestJS endpoints
- [ ] Integration test: Queue notification → Send notification
- [ ] Integration test: Create subscription → Receive notification
- [ ] Load test: 1000 pending notifications
- [ ] Verify VAPID keys work correctly
- [ ] Test WebSocket price updates
- [ ] Test graceful shutdown

---

## 🚀 Recommended Migration Strategy

### Option A: Minimal Changes (Recommended for Quick Migration)
**Keep push-sender as separate microservice, update to use NestJS API**

**Pros:**
- ✅ Minimal code changes
- ✅ Maintains separation of concerns
- ✅ Easier to debug
- ✅ Can run independently

**Cons:**
- ⚠️ Extra network hop (API call overhead)
- ⚠️ Requires service-to-service authentication

**Timeline:** 2-3 hours

### Option B: Full Integration (Long-term Solution)
**Move push notification logic into NestJS as a scheduled task**

**Pros:**
- ✅ Single codebase
- ✅ Direct database access (faster)
- ✅ Better error handling
- ✅ Easier deployment

**Cons:**
- ⚠️ More refactoring work
- ⚠️ Couples notification sending to main API
- ⚠️ Requires @nestjs/schedule

**Timeline:** 6-8 hours

---

## 🔐 Security Considerations

### Service-to-Service Authentication

**Option 1: Shared Secret Token (Simplest)**
```typescript
// NestJS ServiceTokenGuard
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-service-token'];
    return token === process.env.SERVICE_TOKEN;
  }
}
```

**Option 2: JWT Service Tokens (More Secure)**
```typescript
// Generate long-lived JWT for push-sender
const serviceToken = jwt.sign(
  { service: 'push-sender', scope: 'notifications:write' },
  process.env.JWT_SECRET,
  { expiresIn: '365d' }
);
```

---

## 📊 Performance Comparison

### Current (Supabase)
```
push-sender → Supabase RPC → Database
Latency: ~50-100ms (single network hop)
```

### New (NestJS API)
```
push-sender → NestJS API → PostgreSQL
Latency: ~80-150ms (two network hops)
```

**Impact:** +30-50ms latency per query
**Mitigation:** Batch operations, use HTTP/2, keep-alive connections

---

## 🎯 Next Steps

### Immediate Actions (Before Production)
1. **Choose Migration Strategy** (Option A or B)
2. **Implement Missing NestJS Endpoints** (3-4 endpoints)
3. **Create Service Token Authentication**
4. **Update push-sender Code** (2-3 files)
5. **Test End-to-End Flow**
6. **Update Documentation**

### Testing Priorities
1. ✅ Verify notification queue processing
2. ✅ Test push subscription management
3. ✅ Validate VAPID authentication
4. ✅ Check price cache updates
5. ✅ Load test with 1000+ notifications

---

## 📝 Code Examples

### Example 1: Migrated `processPushQueue` Function

**Before (Supabase):**
```typescript
async function processPushQueue() {
  const { data: notifications } = await supabase
    .from('push_notification_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(100);
    
  for (const notification of notifications) {
    // Send notification...
    
    await supabase
      .from('push_notification_queue')
      .update({ status: 'sent' })
      .eq('id', notification.id);
  }
}
```

**After (NestJS API):**
```typescript
async function processPushQueue() {
  // Get pending notifications from NestJS
  const response = await nestApi.get('/notifications/push/pending');
  const notifications = response.data;
  
  for (const notification of notifications) {
    // Send notification...
    
    // Update status via NestJS
    await nestApi.patch(`/notifications/push/${notification.id}/status`, {
      status: 'sent',
      sent_at: new Date().toISOString()
    });
  }
}
```

### Example 2: New NestJS Service Method

```typescript
// notifications.service.ts
async updateNotificationStatus(
  id: string, 
  dto: UpdateNotificationStatusDto
): Promise<PushNotificationQueue> {
  await this.pushQueueRepository.update(id, {
    status: dto.status,
    sent_at: dto.sent_at || new Date(),
    error_message: dto.error_message,
    attempts: () => 'attempts + 1'
  });
  
  return this.pushQueueRepository.findOne({ where: { id } });
}
```

---

## ✅ Conclusion

**Current State:** ❌ Push-sender is **NOT COMPATIBLE** with NestJS backend

**Required Work:**
- 4 new NestJS endpoints
- Service authentication implementation  
- Push-sender migration (replace Supabase client)
- Environment variable updates
- End-to-end testing

**Estimated Time:**
- Option A (API migration): **2-3 hours**
- Option B (Full integration): **6-8 hours**

**Recommendation:** Start with **Option A** to maintain existing architecture, then consider Option B for long-term optimization.

---

## 📚 Related Documentation

- [NestJS Notifications Module](./src/notifications/README.md)
- [Push Notification Deployment](../docs/PUSH_NOTIFICATION_DEPLOYMENT.md)
- [WebSocket Migration](../docs/WEBSOCKET_MIGRATION.md)
- [Database Schema](../COMPLETE_SCHEMA.md)

---

**Last Updated:** January 23, 2026  
**Status:** ⚠️ Migration Required  
**Priority:** 🔴 High - Blocking Production Deployment
