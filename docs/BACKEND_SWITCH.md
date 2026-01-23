# Backend & Database Switch: Supabase → NestJS + PostgreSQL

**Date Started**: January 23, 2026  
**Target Completion**: February 6, 2026 (2 weeks)  
**Deployment Target**: Contabo VPS  

---

## Executive Summary

**What's changing:**
- ❌ **Removing**: Supabase (cloud PostgreSQL, Auth, Realtime, Edge Functions, Storage)
- ✅ **Adding**: Self-hosted NestJS backend + PostgreSQL on Contabo VPS
- ✅ **Keeping**: React frontend, push-sender service, realtime-proxy service
- ✅ **Keeping**: Paystack payments, Finnhub prices, Web Push notifications

**Why:**
- Full control over infrastructure
- Reduce Docker complexity (Docker compose issues were blocker)
- Single backend deployment unit (easier to manage)
- Same team expertise (TypeScript + Node.js)
- Cost control (self-hosted on Contabo vs Supabase pricing)

**What stays the same:**
- React frontend (zero changes to UI logic)
- PostgreSQL database (same schema, 16 tables)
- Authentication flow (can use Supabase Auth or migrate to custom JWT)
- Real-time price updates (WebSocket via NestJS instead of Supabase Realtime)
- Push notifications (existing push-sender service continues)
- Payment system (Paystack webhooks handled by NestJS)

---

## Architecture Comparison

### BEFORE: Supabase-Based

```
React App (localhost:8080)
    ├─ Supabase Auth (signup, login, JWT)
    ├─ Supabase REST API (PostgreSQL queries)
    ├─ Supabase Realtime (WebSocket subscriptions)
    ├─ Supabase Storage (avatars, screenshots)
    └─ Supabase Edge Functions (payment verification, webhooks)

push-sender service (independent)
    └─ Fetches prices, updates price_cache, sends notifications

realtime-proxy service (independent)
    └─ Relays Supabase Realtime to WebSocket clients
```

**Problems:**
- Docker Compose complexity (multiple interconnected services)
- Port conflicts and service dependencies
- Auth service integration issues
- Complex local development setup

### AFTER: NestJS-Based

```
React App (localhost:3000 / production)
    ├─ REST API calls → NestJS (http://backend:3001)
    ├─ WebSocket → NestJS PricesGateway
    ├─ JWT validation with NestJS Guards
    └─ No direct Supabase dependency

NestJS Backend (port 3001)
    ├─ AuthModule (JWT, RLS guards)
    ├─ TradingModule (trades, signals, accounts)
    ├─ PaymentsModule (Paystack webhooks)
    ├─ PricesModule (Finnhub fetcher, WebSocket)
    ├─ NotificationsModule (push queue, cron jobs)
    └─ ScheduleModule (payment expiry, reminders)

PostgreSQL (Contabo VPS, port 5432)
    └─ 16 tables + RLS policies (migrated from Supabase)

push-sender service (Contabo VPS, independent)
    ├─ Fetches Finnhub prices every 30s
    ├─ Updates price_cache table
    └─ Sends push notifications

realtime-proxy service (Contabo VPS, optional)
    └─ Relays WebSocket (can be replaced by NestJS gateway)
```

**Benefits:**
- ✅ Simpler Docker (single backend container + PostgreSQL)
- ✅ No service interdependencies
- ✅ Full control over business logic
- ✅ TypeScript end-to-end (React → NestJS → PostgreSQL)
- ✅ Schema validation with decorators
- ✅ WebSocket native support
- ✅ Easier monitoring and error tracking
- ✅ Scheduled tasks built-in

---

## Technology Stack

### Frontend (No Changes)
- **Framework**: React 18 + TypeScript
- **Build**: Vite 5 + SWC
- **UI**: Radix UI (shadcn/ui)
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **State**: React Context API
- **API Communication**: Fetch API + Socket.IO

### Backend (NEW)
- **Framework**: NestJS 10+ (TypeScript-first, Express-based)
- **Database ORM**: TypeORM
- **Database**: PostgreSQL 15
- **Real-time**: Socket.IO for WebSocket
- **Validation**: class-validator + class-transformer
- **Authentication**: JWT + Guards
- **Scheduling**: @nestjs/schedule (cron jobs)
- **Deployment**: Docker

### Infrastructure
- **VPS**: Contabo (Ubuntu 22.04 LTS, 2GB RAM)
- **Container Runtime**: Docker + Docker Compose
- **Database**: PostgreSQL 15 (self-hosted)
- **Reverse Proxy**: nginx (optional, for SSL)

---

## Data Migration Plan

### Source Data
- **Current**: Supabase (PostgreSQL 15.8.1)
- **Tables**: 16 total
  - User tables: `profiles`, `user_roles`
  - Trading tables: `trading_accounts`, `trading_journal`, `trading_signals`, `taken_trades`
  - Notification tables: `push_subscriptions`, `push_notification_queue`, `email_queue`
  - Payment tables: `payments`, `paystack_webhook_logs`
  - Configuration tables: `app_settings`, `app_updates`, `price_cache`

### Migration Steps
1. Export schema + data from current Supabase
2. Create new PostgreSQL database on Contabo VPS
3. Run schema migration scripts (Flyway/Liquibase)
4. Verify data integrity
5. Test RLS policies in new environment

### Downtime
- **Estimated**: 30 minutes (during off-peak)
- **Process**: Export Supabase → Load Contabo → Verify → Switch DNS

---

## Service Integration Strategy

### push-sender Service
**Status**: KEEP (no changes needed)
- Continues fetching Finnhub prices every 30 seconds
- Updates `price_cache` table in PostgreSQL
- Processes `push_notification_queue` table
- Can be migrated to NestJS later (Phase 2)

### realtime-proxy Service
**Status**: KEEP or REPLACE
- **Option A (Phase 1)**: Keep running independently
  - NestJS coexists with realtime-proxy
  - React clients can use both
  
- **Option B (Phase 2)**: Replace with NestJS PricesGateway
  - Move WebSocket logic into NestJS
  - Reduces service count
  - Better monitoring and error handling

### Authentication
**Status**: CHOOSE
- **Option A (Faster)**: Keep Supabase Auth service
  - NestJS validates JWT tokens from Supabase
  - Uses existing auth flows
  - Migration time: 1 week
  
- **Option B (Full Control)**: Migrate to custom NestJS JWT auth
  - Complete ownership of auth logic
  - No external service dependency
  - Migration time: 2 weeks

---

## Deployment Architecture

### Local Development (Windows)
```
Windows Machine
├─ Node.js + npm
├─ Docker Desktop
│  ├─ PostgreSQL container (port 5432)
│  └─ NestJS dev server (port 3001)
├─ React dev server (Vite, port 5173)
└─ push-sender service (Node.js, port 3002)
```

### Production (Contabo VPS)
```
Contabo VPS (Ubuntu 22.04, 2GB RAM)
├─ Docker Compose
│  ├─ NestJS backend (port 3001, 300-400MB RAM)
│  └─ PostgreSQL database (port 5432, 200-300MB RAM)
├─ push-sender service (Node.js, 50MB RAM)
├─ nginx reverse proxy (optional, 50MB RAM)
└─ System reserves (≈500MB RAM)

Total: ~1.5GB usage (fits comfortably on 2GB VPS)
```

### SSL/HTTPS
- Option 1: nginx reverse proxy on VPS (free Let's Encrypt)
- Option 2: Cloudflare proxy (free SSL + caching)
- Option 3: AWS API Gateway (not recommended for cost)

---

## React App Changes Required

### 1. Remove Supabase Dependency
```typescript
// BEFORE
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(URL, KEY);

// AFTER
// Use fetch API directly
const response = await fetch('http://backend:3001/api/trades');
```

### 2. Update API Calls
```typescript
// BEFORE: Supabase query
const { data } = await supabase
  .from('trading_journal')
  .select('*')
  .eq('user_id', userId);

// AFTER: NestJS REST API
const response = await fetch(`/api/trades?user_id=${userId}`);
const data = await response.json();
```

### 3. Update WebSocket
```typescript
// BEFORE: Supabase Realtime
const channel = supabase.channel('price_cache_updates')
  .on('postgres_changes', ...)
  .subscribe();

// AFTER: Socket.IO
import io from 'socket.io-client';
const socket = io('http://backend:3001');
socket.emit('subscribe', { symbols: ['EUR/USD'] });
socket.on('price_update', (data) => { /* update state */ });
```

### 4. Environment Variables
```bash
# .env.local (development)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# .env.production
VITE_API_URL=https://api.poscal.com
VITE_WS_URL=wss://api.poscal.com
```

### Timeline
- **Estimation**: 3-5 days (10-15% of React codebase changes)
- **Risk**: Low (API contract is clear, just different endpoints)
- **Testing**: Manual testing of all features + integration tests

---

## Database Schema (No Changes to Structure)

All 16 tables remain unchanged:
- ✅ Same column names, types, and constraints
- ✅ Same RLS policies (converted to NestJS Guards)
- ✅ Same indexes for performance
- ✅ Same foreign key relationships

### New indexes added (optional)
```sql
-- User queries optimization
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_trading_journal_user_created ON trading_journal(user_id, created_at);
CREATE INDEX idx_trading_signals_status_created ON trading_signals(status, created_at);
```

---

## Timeline & Milestones

| Week | Milestone | Status |
|------|-----------|--------|
| **Week 1** | NestJS scaffold + PostgreSQL setup | TBD |
| **Week 1** | AuthModule + TradingModule | TBD |
| **Week 2** | PaymentsModule + PricesModule + NotificationsModule | TBD |
| **Week 2** | Docker setup + local testing | TBD |
| **Week 3** | React app migration | TBD |
| **Week 3** | Deploy to Contabo VPS | TBD |
| **Week 3** | Performance testing + monitoring setup | TBD |
| **Week 4** | Final testing + launch | TBD |

---

## Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Data loss during migration | Critical | Full backup of Supabase, test migration on dev first |
| WebSocket connection issues | High | Graceful fallback to polling, health checks, auto-reconnect |
| Performance degradation | Medium | Load testing, database query optimization, caching |
| Auth token expiry handling | Medium | Automatic refresh token rotation, clear error messages |
| Payment webhook verification fails | High | HMAC signature validation, Paystack API testing |
| Downtime during cutover | High | Dry run on staging, blue-green deployment, rollback plan |

---

## Rollback Plan

If issues occur post-deployment:

1. **Keep Supabase active for 1 week** (dual write during transition)
2. **DNS switch back** (5 minutes)
3. **React app revert** to old API endpoint
4. **Data sync** (catch up any missed writes)
5. **Post-mortem** and fix issues

---

## Success Criteria

✅ Backend deployed and responding to health checks  
✅ All 16 tables accessible via NestJS APIs  
✅ User authentication working (signup/login/logout)  
✅ Trading journal CRUD operations working  
✅ Real-time price updates working via WebSocket  
✅ Paystack webhooks verified and processed  
✅ Push notifications queued and sent  
✅ Scheduled tasks running (payment expiry, reminders)  
✅ React app fully migrated and tested  
✅ Performance metrics: <100ms average response time, <50ms WebSocket latency  
✅ Error tracking working (logs visible on VPS)  
✅ Monitoring alerts configured  

---

## Next Steps

1. ✅ Remove Supabase from docker-compose
2. Create NestJS project scaffold
3. Set up PostgreSQL on Contabo
4. Implement modules (Auth, Trading, Payments, Prices, Notifications)
5. Containerize and test locally
6. Migrate React app
7. Deploy to Contabo VPS
8. Monitor and optimize

---

## Contacts & References

- **NestJS Docs**: https://docs.nestjs.com
- **TypeORM Docs**: https://typeorm.io
- **Socket.IO Docs**: https://socket.io/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs
- **Contabo Support**: https://contabo.com/support
- **Paystack API**: https://paystack.com/developers/api

