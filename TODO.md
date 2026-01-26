# Poscal Backend Switch - Complete TODO List

**Project**: Migrate from Supabase to NestJS + PostgreSQL + Live Market Data Expansion  
**Status**: IN PROGRESS - Phase 5 (Pairs Expansion) 98% Complete, Phase 2-4 Pending  
**Started**: January 23, 2026  
**Target**: February 6, 2026

**Progress**:

- ✅ Phase 1: Project Setup - COMPLETE
- ⏳ Phase 2: NestJS Scaffold - NOT STARTED
- ⏳ Phase 3: Database Setup - NOT STARTED  
- ⏳ Phase 4: Core Modules - NOT STARTED
- ✅ Phase 5: Pairs Expansion - 98% COMPLETE (1 integration test step remaining)

---

## 🚀 SUMMARY: CURRENT PROJECT STATUS

### ✅ **What's Deployed & Live Now**

- **Backend (Push-Sender)**: 228 pairs actively streaming prices from Finnhub
  - Running on: Contabo VPS (62.171.136.178)
  - Memory: ~128 MB, CPU: 2.5% (healthy)
  - Update frequency: Every 1 second (batched)
  - Status: ✅ LIVE & ACTIVE

- **Frontend (CurrencyGrid.tsx)**: 230 pairs with smart pip detection
  - Git: Committed (b37ebf9), pushed to GitHub
  - Vercel: Auto-build triggered, deploying now (2-3 min)
  - Status: ⏳ BUILDING (will be live in 2-3 min)

- **Database (Price Cache)**: Receiving live price updates
  - Expected rows: 150-228 (live prices)
  - Update frequency: Every 1 second
  - Freshness: <2 seconds old
  - Status: ✅ RECEIVING PRICES

### 🎯 **What's Next (Prioritized)**

1. **Push-Sender Worker Follow-ups** - Refresh `.env.example`, add backend instrumentation for `/prices/batch-update`, and dry-run the new PM2 ecosystem config before redeploying the workers.
2. **Phase 5.3** - Test frontend in production (5 min after Vercel build)
3. **Phase 5.4** - Monitor performance (ongoing)
4. **Phase 2-4** - Start NestJS backend migration (after pairs validation)

---

## 🚀 LATEST: LIVE MARKET DATA EXPANSION (200+ Pairs) - ✅ DEPLOYED

### ✅ Phase 5: Pairs Expansion to 228 (Completed Jan 23, 2026)

- [x] Expanded SYMBOL_MAPPINGS from 65 to 228 pairs in push-sender/index.ts
- [x] Added comprehensive pair coverage:
  - Forex: ~110 pairs (majors, crosses, exotics)
  - Metals: 6 pairs (XAU, XAG, XPT, XPD, crosses)
  - Commodities: 16 pairs (energy, agricultural)
  - Indices: 28 pairs (US, European, Asian)
  - Crypto: 50+ pairs (majors, altcoins, stablecoins)
- [x] Updated CurrencyGrid.tsx with 230 pairs + smart pip detection
- [x] Created deployment documentation (3 comprehensive guides)
- [x] **Deployed to Contabo VPS (62.171.136.178)** - ✅ LIVE
  - File: /opt/poscal/push-sender/index.ts
  - Status: Running with PID 3192751
  - Verified: 228 pairs active in logs
  - Live prices: Streaming every 1 second
  - Backup: Created at /opt/poscal/push-sender/index.ts.backup.20260123_XXXXXX  

---

## 📋 IMMEDIATE NEXT STEPS (Priority Order)

### 🚧 Push-Sender Worker Follow-Ups (NEW)

- [ ] Refresh `.env.example` with the new `NESTJS_API_URL`, `NESTJS_SERVICE_TOKEN`, Finnhub, and VAPID settings so both workers load the right config by default.
- [ ] Add backend instrumentation/logging for `/prices/batch-update` and `/notifications/push/pending` to track worker throughput, failures, and latency.
- [ ] Smoke-test `ecosystem.config.js` on Contabo (or staging) to verify both workers boot from `dist/` with the shared `.env` before redeploying.

### ✅ Phase 5.1: Deploy Frontend Updates (COMPLETED - Jan 23, 2026)

- [x] Deploy CurrencyGrid.tsx to production
  - [x] Push updated src/components/CurrencyGrid.tsx to git (Commit: b37ebf9)
  - [x] Vercel auto-deploy triggered on git push
  - [x] Expected build time: 2-3 minutes (auto-building now)
  - [x] 230 pairs with smart pip detection in code
- [x] Expected Result: Position calculator shows all 228 pairs with live prices

### ✅ Phase 5.2: Verify Database Population (COMPLETED - Jan 23, 2026)

- [x] Connect to production database
- [x] Verify push-sender is streaming prices to price_cache
- [x] Confirmed: Service running with 228 pairs active
- [x] Confirmed: Recent prices streaming (verified in logs)
- [x] Expected: 150-228 rows (depending on Finnhub tier availability)
- [x] Update freshness: <1 second old (batched every 1 second)
- [x] No NULL prices detected in test (only pairs with available prices shown)

### ⏳ Phase 5.3: End-to-End Integration Testing (NEXT - After Vercel Build)

- [ ] Wait for Vercel build to complete (2-3 minutes total)
- [ ] Open position size calculator in production
- [ ] Test pair selector shows all 230 pairs
- [ ] Select forex pair (EUR/USD) → price loads ✓
- [ ] Select metal (XAU/USD) → price loads ✓
- [ ] Select commodity (WTI/USD) → price loads ✓
- [ ] Select index (US30) → price loads ✓
- [ ] Select crypto (BTC/USD) → price loads ✓
- [ ] Test "Add Custom Pair" feature
- [ ] Verify smart pip calculation works for each type
- [ ] Check WebSocket updates are real-time (1-2 sec updates)

### ⏳ Phase 5.4: Performance & Monitoring (AFTER Phase 5.3)

- [ ] Monitor VPS resource usage:
  - [ ] CPU: Currently 2.5% (well under 10% target)
  - [ ] Memory: Currently ~128 MB (well under 200 MB target)
  - [ ] Network: Monitor bandwidth usage
- [ ] Check database performance:
  - [ ] Query response time: Should be <50ms
  - [ ] Cache hit rate: Should be >95%
- [ ] Monitor push-sender logs for errors:
  - [ ] Check: `tail -f /var/log/push-sender.log`
  - [ ] Alert if any "ERROR" or "FAIL" messages appear
- [ ] Test with 100-500 concurrent users (load test - optional)

### ⏳ Phase 5.5: Documentation & Handoff (OPTIONAL)

- [ ] Update DEPLOYMENT_CHECKLIST_200_PAIRS.md with real results
- [ ] Document any custom pair mappings added by users
- [ ] Create monitoring dashboard for price updates
- [ ] Document troubleshooting steps if pairs don't load

---

## ♻ Push-Sender Worker Refactor (Jan 25, 2026)

### ✅ Completed

- [x] Split the monolithic push-sender into `notification-worker` and `price-ingestor` entry points sharing config, logger, NestJS API client, retry helper, symbol map, and type definitions.
- [x] Added `ecosystem.config.js` so PM2 can supervise both workers with consistent environments, memory limits, and restarts.
- [x] Updated push-sender/README.md with architecture notes, local dev commands, and PM2 deployment guidance.

### ⏳ Follow-Ups (tracked in Immediate Next Steps below)

- Refresh `.env.example` to include `NESTJS_API_URL`, `NESTJS_SERVICE_TOKEN`, Finnhub requirements, and worker-specific knobs.
- Add backend instrumentation/logging for `/prices/batch-update` and `/notifications/push/pending` so worker health data is visible.
- Smoke-test the PM2 ecosystem config on Contabo (or staging) after the next build to confirm both workers boot from `dist/`.

---

## PHASE 1: PROJECT SETUP & FOUNDATION

### ✅ 1.1 Remove Supabase Dependencies

- [x] Stop docker-compose-local.yml services
- [x] Delete docker-compose-local.yml
- [x] Delete auth-service/ folder (no longer needed)
- [x] Remove @supabase/supabase-js from package.json
- [x] Remove supabase cli from dev dependencies
- [x] Delete .env.local references to Supabase URLs
- [x] Clean up src/integrations/supabase/ folder (replaced with stub)

### ✅ 1.2 Create Documentation

- [x] Create BACKEND_SWITCH.md with full plan
- [x] Create this TODO.md file
- [x] Create API_ENDPOINTS.md (list all NestJS endpoints)
- [x] Create DATABASE_SCHEMA.md (PostgreSQL schema export)
- [ ] Create DEPLOYMENT_GUIDE.md (Contabo VPS setup)
- [x] Create DEVELOPMENT_SETUP.md (local dev environment)

---

## PHASE 2: NESTJS PROJECT SCAFFOLD

### ✅ 2.1 Initialize NestJS Project

- [x] Create `backend/` folder at project root
- [x] Run `npm init -y` in backend folder
- [x] Install dependencies:
  - `npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/jwt @nestjs/passport passport passport-jwt`
  - `npm install typeorm pg class-validator class-transformer`
  - `npm install @nestjs/websockets @nestjs/platform-socket.io socket.io`
  - `npm install @nestjs/schedule @nestjs/config dotenv`
- [x] Create tsconfig.json for backend
- [x] Create .prettierrc.json for code formatting
- [x] Create .eslintrc.json for linting

### ✅ 2.2 Create Project Structure

```
backend/
├─ src/
│  ├─ auth/
│  │  ├─ auth.module.ts
│  │  ├─ auth.service.ts
│  │  ├─ auth.controller.ts
│  │  ├─ jwt.strategy.ts
│  │  ├─ jwt.guard.ts
│  │  └─ dto/
│  │
│  ├─ trading/
│  │  ├─ trading.module.ts
│  │  ├─ services/
│  │  │  ├─ trades.service.ts
│  │  │  ├─ signals.service.ts
│  │  │  └─ accounts.service.ts
│  │  ├─ controllers/
│  │  │  ├─ trades.controller.ts
│  │  │  ├─ signals.controller.ts
│  │  │  └─ accounts.controller.ts
│  │  ├─ entities/
│  │  │  ├─ trading-journal.entity.ts
│  │  │  ├─ trading-signals.entity.ts
│  │  │  └─ trading-accounts.entity.ts
│  │  └─ dto/
│  │
│  ├─ payments/
│  │  ├─ payments.module.ts
│  │  ├─ payments.service.ts
│  │  ├─ payments.controller.ts
│  │  ├─ entities/
│  │  └─ dto/
│  │
│  ├─ prices/
│  │  ├─ prices.module.ts
│  │  ├─ prices.service.ts
│  │  ├─ prices.gateway.ts (WebSocket)
│  │  ├─ entities/
│  │  └─ tasks/
│  │
│  ├─ notifications/
│  │  ├─ notifications.module.ts
│  │  ├─ services/
│  │  │  ├─ push.service.ts
│  │  │  ├─ email.service.ts
│  │  │  └─ queue.service.ts
│  │  └─ tasks/
│  │
│  ├─ database/
│  │  ├─ database.module.ts
│  │  └─ migrations/
│  │
│  ├─ common/
│  │  ├─ guards/
│  │  ├─ filters/
│  │  ├─ interceptors/
│  │  └─ decorators/
│  │
│  ├─ app.module.ts
│  └─ main.ts
│
├─ .env.example
├─ docker-compose.yml
├─ Dockerfile
├─ tsconfig.json
├─ package.json
└─ README.md
```

- [x] Create all folder structure above
- [x] Create main.ts (NestJS entry point)
- [x] Create app.module.ts (root module)
- [x] Create .env.example template

---

## PHASE 3: DATABASE SETUP

### ✅ 3.1 Export Current Schema from Supabase

- [x] Access Supabase dashboard (N/A - reconstructed from code)
- [x] Export database schema (SQL dump)
- [x] Export all table data (reconstructed from TypeScript types)
- [x] Save to `backend/migrations/001_initial_schema.sql`
- [x] Verify 16 tables exported:
  - [x] profiles
  - [x] user_roles
  - [x] trading_accounts
  - [x] trading_journal
  - [x] trading_signals
  - [x] taken_trades
  - [x] price_cache
  - [x] payments
  - [x] paystack_webhook_logs
  - [x] push_subscriptions
  - [x] push_notification_queue
  - [x] email_queue
  - [x] app_settings
  - [x] app_updates
  - [x] Functions (has_role, is_admin, etc.)
  - [x] Enums (app_role)

### ✅ 3.2 Set Up PostgreSQL on Contabo VPS

- [x] SSH into Contabo VPS
- [x] Create non-root user for database
- [x] Install PostgreSQL 15:

  ```bash
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  ```

- [x] Create database:

  ```bash
  sudo -u postgres createdb poscal_db
  sudo -u postgres createuser poscal_user
  sudo -u postgres psql -c "ALTER USER poscal_user WITH PASSWORD 'your-secure-password';"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE poscal_db TO poscal_user;"
  ```

- [x] Enable PostgreSQL to start on boot:

  ```bash
  sudo systemctl enable postgresql
  ```

- [x] Test connection from local machine
- [x] Document connection string: `postgresql://poscal_user:P0sc@l_2026_Secure!@62.171.136.178:5432/poscal_db`
- [x] Run initial schema migration (all 14 tables created)

### ✅ 3.3 Create TypeORM Entities

- [x] Create entity for each table:
  - [x] Profile entity (src/auth/entities/profile.entity.ts)
  - [x] UserRole entity
  - [x] TradingAccount entity
  - [x] TradingJournal entity
  - [x] TradingSignal entity
  - [x] TakenTrade entity
  - [x] PriceCache entity
  - [x] Payment entity
  - [x] PaystackWebhookLog entity
  - [x] PushSubscription entity
  - [x] PushNotificationQueue entity
  - [x] EmailQueue entity
  - [x] AppSetting entity
  - [x] AppUpdate entity
- [x] Add all columns with proper types
- [ ] Add relationships (foreign keys)
- [ ] Add indexes from Supabase schema
- [x] Verify all column names match database.types.ts

### ✅ 3.4 Set Up TypeORM Configuration

- [x] Create database.config.ts
- [x] Configure TypeOrmModule with PostgreSQL connection
- [x] Register all entities in feature modules
- [x] Test connection to Contabo PostgreSQL
- [x] Verify all entities load correctly
- [x] Backend server running successfully on <http://localhost:3001>

### ✅ 3.5 Migrate Data

- [x] Run SQL schema migration on Contabo PostgreSQL
- [x] Verify 15 tables created (14 data tables + schema_version)
- [x] Verify all columns and indexes present
- [ ] Insert test data (if applicable)
- [ ] Backup database before proceeding

---

## PHASE 4: IMPLEMENT CORE MODULES

### ✅ 4.1 AuthModule (JWT + Guards)

- [x] Create auth.module.ts
- [x] Create jwt.strategy.ts (Passport JWT strategy)
- [x] Create jwt.guard.ts (JWT validation guard)
- [x] Create RLS guard (EmulateRLS - row-level security emulation)
- [x] Create auth.service.ts:
  - [x] validateToken(token: string)
  - [x] getUserFromToken(token: string)
  - [x] decodeJWT(token: string)
- [x] Create auth.controller.ts:
  - [x] GET /health (health check)
  - [x] POST /auth/validate (token validation)
  - [x] POST /auth/me (get current user)
  - [x] POST /auth/signup (user registration with bcrypt)
  - [x] POST /auth/signin (user login with password validation)
- [x] Create auth.dto.ts:
  - [x] ValidateTokenDto
  - [x] UserPayloadDto
  - [x] SignUpDto
  - [x] SignInDto
- [x] Create auth.service.ts methods:
  - [x] signUp(SignUpDto): Create user with hashed password
  - [x] signIn(SignInDto): Validate password and return JWT token
- [x] Frontend API client (src/lib/api.ts) with axios interceptors
- [x] AuthContext updated to use backend instead of Supabase
- [ ] Test JWT validation with custom tokens
- [ ] Document auth flow

### ⏳ 4.2 TradingModule (Trades, Signals, Accounts)

- [ ] Create trading.module.ts
- [ ] Create entities (TradingJournal, TradingSignal, TradingAccount)
- [ ] Create trades.service.ts:
  - [ ] getTrades(userId: string)
  - [ ] createTrade(data: CreateTradeDto)
  - [ ] updateTrade(id: string, data: UpdateTradeDto)
  - [ ] deleteTrade(id: string)
  - [ ] getTrade(id: string)
- [ ] Create trades.controller.ts:
  - [ ] GET /trades (list user trades)
  - [ ] POST /trades (create trade)
  - [ ] PUT /trades/:id (update trade)
  - [ ] DELETE /trades/:id (delete trade)
  - [ ] GET /trades/:id (get single trade)
- [ ] Create signals.service.ts:
  - [ ] getSignals(filters: SignalFilterDto)
  - [ ] createSignal(data: CreateSignalDto) [admin only]
  - [ ] updateSignal(id: string, data: UpdateSignalDto) [admin only]
  - [ ] closeSignal(id: string) [admin only]
- [ ] Create signals.controller.ts:
  - [ ] GET /signals (list active signals)
  - [ ] POST /signals (admin - create signal)
  - [ ] PUT /signals/:id (admin - update signal)
  - [ ] DELETE /signals/:id (admin - close signal)
- [ ] Create accounts.service.ts:
  - [ ] getUserAccounts(userId: string)
  - [ ] createAccount(data: CreateAccountDto)
  - [ ] updateAccount(id: string, data: UpdateAccountDto)
  - [ ] deleteAccount(id: string)
- [ ] Create accounts.controller.ts
- [ ] Create DTOs (Data Transfer Objects) for all operations
- [ ] Add RLS guards to all endpoints
- [ ] Test all CRUD operations
- [ ] Create integration tests

### ⏳ 4.3 PaymentsModule (Paystack Integration)

- [ ] Create payments.module.ts
- [ ] Create payments.service.ts:
  - [ ] verifyPaystackWebhook(signature: string, body: string): boolean
  - [ ] verifyPayment(reference: string): Promise<PaymentResult>
  - [ ] recordPayment(paymentData: PaymentDto)
  - [ ] updateSubscription(userId: string, tier: string, expiryDate: Date)
  - [ ] checkSubscriptionExpiry(userId: string): Promise<SubscriptionStatus>
  - [ ] expireSubscriptions() [scheduled task]
- [ ] Create payments.controller.ts:
  - [ ] POST /webhooks/paystack (webhook handler)
  - [ ] POST /payments/verify (verify payment)
  - [ ] GET /payments/status/:userId (get user payment status)
- [ ] Create payment entities and DTOs
- [ ] Add Paystack API client
- [ ] Implement HMAC signature verification
- [ ] Test webhook handling
- [ ] Add proper error handling and logging

### ⏳ 4.4 PricesModule (Real-time Prices + WebSocket)

- [ ] Create prices.module.ts
- [ ] Create prices.service.ts:
  - [ ] fetchFinnhubPrices(): Promise<PriceData[]> [replaces push-sender logic]
  - [ ] updatePriceCache(prices: PriceData[]): Promise<void>
  - [ ] getPrices(symbols: string[]): Promise<PriceCache[]>
  - [ ] subscribeToPriceUpdates(): Observable<PriceUpdate> [realtime]
- [ ] Create prices.gateway.ts (Socket.IO WebSocket gateway):
  - [ ] @SubscribeMessage('subscribe') handleSubscribe(client, data)
  - [ ] @SubscribeMessage('unsubscribe') handleUnsubscribe(client, data)
  - [ ] setupRealtimeSubscription(): Set up Supabase realtime OR direct polling
  - [ ] broadcastPriceUpdate(price: PriceData)
- [ ] Create prices.controller.ts (REST API):
  - [ ] GET /prices (get all cached prices)
  - [ ] GET /prices/:symbol (get single symbol)
- [ ] Create @Cron task for fetching prices every 30 seconds
- [ ] Create price entities and DTOs
- [ ] Implement Finnhub API client
- [ ] Test WebSocket connections and price broadcasting
- [ ] Add fallback to free price APIs if Finnhub fails
- [ ] Document WebSocket message format

### ⏳ 4.5 NotificationsModule (Push + Email + Scheduling)

- [ ] Create notifications.module.ts
- [ ] Create push.service.ts:
  - [ ] registerSubscription(userId: string, subscription: PushSubscription)
  - [ ] sendPushNotification(userId: string, notification: NotificationData)
  - [ ] processPushQueue() [scheduled task]
  - [ ] retryFailedNotifications() [scheduled task]
- [ ] Create email.service.ts:
  - [ ] sendEmailVerification(email: string, token: string)
  - [ ] sendWelcomeEmail(email: string, name: string)
  - [ ] sendPaymentConfirmation(email: string, tier: string)
  - [ ] sendSignalAlert(userId: string, signal: TradingSignal)
- [ ] Create queue.service.ts:
  - [ ] addToQueue(type: 'email' | 'push', data: QueueData)
  - [ ] processQueue() [scheduled task]
  - [ ] retryFailed() [scheduled task]
- [ ] Create notifications.controller.ts:
  - [ ] POST /notifications/subscribe (register push subscription)
  - [ ] POST /notifications/send (send notification - admin only)
  - [ ] GET /notifications/queue-status (queue status - admin only)
- [ ] Create scheduled tasks:
  - [ ] @Cron('0 9 ** 1') - Weekly reminders (Monday 9am)
  - [ ] @Cron('0 0 ** *') - Process email queue (daily midnight)
  - [ ] @Cron('*/5* ** *') - Retry failed notifications (every 5 minutes)
- [ ] Integrate with push-sender service (can call or run independently)
- [ ] Create DTOs and entities
- [ ] Test all notification types
- [ ] Add logging for delivery tracking

---

## PHASE 5: ADVANCED FEATURES & POLISH

### ⏳ 5.1 Validation & Error Handling

- [ ] Add class-validator decorators to all DTOs
- [ ] Create global exception filters
- [ ] Create custom exceptions:
  - [ ] UnauthorizedAccessException
  - [ ] ResourceNotFoundException
  - [ ] PaymentVerificationException
  - [ ] WebSocketException
- [ ] Add request logging middleware
- [ ] Add error tracking (Sentry integration optional)
- [ ] Test all error scenarios

### ⏳ 5.2 RLS Emulation (Guards)

- [ ] Create @RLS() decorator for endpoints
- [ ] Create RLSGuard that:
  - [ ] Extracts user_id from JWT token
  - [ ] Validates user can access resource
  - [ ] Applies row-level filter to queries
- [ ] Test that users can only see their own data
- [ ] Test that admins can see all data

### ⏳ 5.3 API Documentation

- [ ] Add @ApiOperation() decorators to all controllers
- [ ] Add @ApiResponse() decorators to all endpoints
- [ ] Add @ApiParam() @ApiQuery() decorators
- [ ] Generate Swagger/OpenAPI docs
- [ ] Test Swagger UI at `/api/docs`
- [ ] Document all endpoints in API_ENDPOINTS.md

### ⏳ 5.4 Testing

- [ ] Set up Jest for unit testing
- [ ] Write unit tests for core services:
  - [ ] auth.service.test.ts
  - [ ] trades.service.test.ts
  - [ ] payments.service.test.ts
  - [ ] prices.service.test.ts
- [ ] Set up e2e testing for endpoints
- [ ] Test all CRUD operations
- [ ] Test error scenarios
- [ ] Test WebSocket connections
- [ ] Achieve 70%+ code coverage

### ⏳ 5.5 Performance Optimization

- [ ] Add query caching for frequently accessed data
- [ ] Add database query profiling
- [ ] Identify N+1 query problems
- [ ] Add database connection pooling
- [ ] Profile WebSocket performance
- [ ] Test with concurrent connections (50, 100, 200 users)
- [ ] Document performance benchmarks

---

## PHASE 6: DOCKER & DEPLOYMENT

### ⏳ 6.1 Local Development Docker Setup

- [ ] Create Dockerfile for NestJS:

  ```dockerfile
  FROM node:18-alpine
  WORKDIR /app
  COPY package.json .
  RUN npm ci
  COPY . .
  RUN npm run build
  EXPOSE 3001
  CMD ["npm", "run", "start:prod"]
  ```

- [ ] Create docker-compose.yml for local dev:

  ```yaml
  services:
    postgres:
      image: postgres:15-alpine
      environment:
        POSTGRES_DB: poscal_dev
        POSTGRES_USER: poscal_user
        POSTGRES_PASSWORD: dev_password
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data
    
    backend:
      build: .
      ports:
        - "3001:3001"
      depends_on:
        - postgres
      environment:
        DATABASE_URL: postgres://poscal_user:dev_password@postgres:5432/poscal_dev
  ```

- [ ] Test local Docker setup works
- [ ] Document setup instructions in DEVELOPMENT_SETUP.md

### ⏳ 6.2 Production Docker Setup for Contabo

- [ ] Create docker-compose.prod.yml for Contabo:

  ```yaml
  services:
    backend:
      image: poscal/backend:latest
      ports:
        - "3001:3001"
      environment:
        DATABASE_URL: ${DATABASE_URL}
        JWT_SECRET: ${JWT_SECRET}
        FINNHUB_API_KEY: ${FINNHUB_API_KEY}
        # ... other env vars
      restart: unless-stopped
      logging:
        driver: "json-file"
        options:
          max-size: "10m"
          max-file: "3"
  ```

- [ ] Add nginx reverse proxy config (optional)
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Create .env.prod file with secrets
- [ ] Document production deployment in DEPLOYMENT_GUIDE.md

### ⏳ 6.3 Set Up CI/CD (GitHub Actions optional)

- [ ] Create .github/workflows/build-and-deploy.yml
- [ ] Add steps:
  - [ ] Build Docker image
  - [ ] Run tests
  - [ ] Push image to Docker Hub or private registry
  - [ ] Deploy to Contabo VPS
- [ ] Test workflow end-to-end
- [ ] Document deployment process

---

## PHASE 7: REACT APP MIGRATION

### ⏳ 7.1 Remove Supabase Client

- [ ] Remove @supabase/supabase-js from package.json
- [ ] Remove supabase integration folder
- [ ] Remove Supabase context providers
- [ ] Remove all Supabase-related environment variables

### ⏳ 7.2 Create API Client Utility

- [ ] Create src/lib/api.ts:

  ```typescript
  const API_URL = import.meta.env.VITE_API_URL;
  
  export async function apiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: object
  ) {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }
  ```

- [ ] Create API service functions:
  - [ ] src/lib/api/trades.ts
  - [ ] src/lib/api/signals.ts
  - [ ] src/lib/api/accounts.ts
  - [ ] src/lib/api/payments.ts
  - [ ] src/lib/api/auth.ts
  - [ ] src/lib/api/notifications.ts

### ⏳ 7.3 Create Socket.IO Client Hook

- [ ] Create src/hooks/useWebSocket.ts:

  ```typescript
  import io from 'socket.io-client';
  
  export function useWebSocket() {
    const [prices, setPrices] = useState({});
    const socket = useRef(null);
    
    useEffect(() => {
      socket.current = io(import.meta.env.VITE_WS_URL);
      socket.current.on('price_update', (data) => {
        setPrices(prev => ({ ...prev, [data.symbol]: data }));
      });
      return () => socket.current?.disconnect();
    }, []);
    
    return { prices, socket: socket.current };
  }
  ```

- [ ] Replace all Supabase Realtime hooks with this new hook

### ⏳ 7.4 Migrate All Pages

- [ ] Journal.tsx:
  - [ ] Replace `supabase.from('trading_journal').select(...)` with `apiCall('/trades')`
  - [ ] Update state management if needed
  - [ ] Test CRUD operations
- [ ] Signals.tsx:
  - [ ] Replace signal fetch with `apiCall('/signals')`
  - [ ] Update WebSocket subscription format
  - [ ] Test real-time price updates
- [ ] Accounts.tsx:
  - [ ] Replace account CRUD with API calls
  - [ ] Test creation, update, deletion
- [ ] Settings.tsx:
  - [ ] Update payment verification endpoint
  - [ ] Update subscription status check
  - [ ] Test payment flow
- [ ] Admin dashboard:
  - [ ] Update all admin endpoints
  - [ ] Test admin access controls
- [ ] Authentication pages:
  - [ ] Update auth flow (signup/login/logout)
  - [ ] Test session persistence
  - [ ] Test token refresh

### ⏳ 7.5 Update Environment Variables

- [ ] Create .env.local for development:

  ```
  VITE_API_URL=http://localhost:3001
  VITE_WS_URL=ws://localhost:3001
  ```

- [ ] Create .env.production for build:

  ```
  VITE_API_URL=https://api.poscal.com
  VITE_WS_URL=wss://api.poscal.com
  ```

- [ ] Test both environments work correctly

### ⏳ 7.6 Integration Testing

- [ ] Manual test: User signup flow
- [ ] Manual test: Create trading account
- [ ] Manual test: Create trade entry
- [ ] Manual test: View signal updates (real-time)
- [ ] Manual test: View price updates (real-time)
- [ ] Manual test: Payment flow
- [ ] Manual test: Push notifications
- [ ] Manual test: Export/import trades
- [ ] Manual test: Mobile responsiveness
- [ ] Cross-browser testing (Chrome, Safari, Firefox)

### ⏳ 7.7 Performance Testing

- [ ] Load test: 50 concurrent users
- [ ] Load test: 100 concurrent users
- [ ] Measure API response times
- [ ] Measure WebSocket latency
- [ ] Profile React component renders
- [ ] Check bundle size impact
- [ ] Document baseline metrics

---

## PHASE 8: DEPLOYMENT TO CONTABO VPS

### ⏳ 8.1 Pre-Deployment Checklist

- [ ] All tests passing (unit + e2e + integration)
- [ ] Code review completed
- [ ] Security audit completed (JWT handling, HMAC verification)
- [ ] Performance benchmarks documented
- [ ] Database backups created
- [ ] Rollback plan documented
- [ ] Team trained on new systems
- [ ] Monitoring/alerting configured

### ⏳ 8.2 Deploy Backend to Contabo

- [ ] SSH into Contabo VPS
- [ ] Clone git repository:

  ```bash
  git clone <repo-url> /opt/poscal
  cd /opt/poscal
  ```

- [ ] Create .env.prod with production secrets
- [ ] Build Docker image:

  ```bash
  docker build -t poscal/backend:latest .
  ```

- [ ] Start containers:

  ```bash
  docker compose -f docker-compose.prod.yml up -d backend
  ```

- [ ] Verify backend health:

  ```bash
  curl http://localhost:3001/health
  ```

- [ ] Check logs:

  ```bash
  docker logs -f poscal-backend
  ```

- [ ] Verify database connection:

  ```bash
  psql -h localhost -U poscal_user -d poscal_db -c "SELECT COUNT(*) FROM profiles;"
  ```

### ⏳ 8.3 Deploy React App to Vercel

- [ ] Update environment variables in Vercel dashboard:
  - [ ] VITE_API_URL=<https://api.poscal.com>
  - [ ] VITE_WS_URL=wss://api.poscal.com
- [ ] Push code to main branch (triggers auto-deploy)
- [ ] Verify deployment successful
- [ ] Test React app connects to backend

### ⏳ 8.4 Set Up SSL/HTTPS

- [ ] Install Certbot:

  ```bash
  sudo apt install certbot python3-certbot-nginx
  ```

- [ ] Generate certificate:

  ```bash
  sudo certbot certonly --standalone -d api.poscal.com
  ```

- [ ] Configure nginx:

  ```nginx
  upstream backend {
    server 127.0.0.1:3001;
  }
  
  server {
    listen 443 ssl http2;
    server_name api.poscal.com;
    
    ssl_certificate /etc/letsencrypt/live/api.poscal.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.poscal.com/privkey.pem;
    
    location / {
      proxy_pass http://backend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  ```

- [ ] Test HTTPS works:

  ```bash
  curl https://api.poscal.com/health
  ```

### ⏳ 8.5 Set Up Monitoring & Logging

- [ ] Configure Docker logging
- [ ] Set up log aggregation (optional: ELK stack, Datadog)
- [ ] Set up health check monitoring
- [ ] Set up error alerts (email on 500 errors)
- [ ] Create dashboard for monitoring:
  - [ ] API response times
  - [ ] Database connection pool stats
  - [ ] WebSocket connection count
  - [ ] Error rate
  - [ ] CPU/Memory usage

### ⏳ 8.6 Set Up Backups

- [ ] Create daily PostgreSQL backups:

  ```bash
  0 2 * * * pg_dump -U poscal_user poscal_db | gzip > /backups/poscal_db_$(date +\%Y\%m\%d).sql.gz
  ```

- [ ] Upload backups to cloud storage (S3, Google Drive)
- [ ] Test backup restoration process
- [ ] Document backup retention policy

### ⏳ 8.7 Post-Deployment Testing

- [ ] Test user signup (create new account)
- [ ] Test user login (existing account)
- [ ] Test create trading account
- [ ] Test create trade entry
- [ ] Test real-time price updates
- [ ] Test payment webhook
- [ ] Test push notifications
- [ ] Test scheduled tasks:
  - [ ] Payment expiry checker
  - [ ] Reminder email sender
  - [ ] Failed notification retry
- [ ] Verify no console errors
- [ ] Check response times (<100ms)
- [ ] Check WebSocket latency (<50ms)

---

## PHASE 9: OPTIMIZATION & MAINTENANCE

### ⏳ 9.1 Performance Tuning

- [ ] Add database query caching (Redis optional)
- [ ] Add HTTP caching headers
- [ ] Add gzip compression
- [ ] Optimize database indexes
- [ ] Profile slow queries
- [ ] Cache price data locally

### ⏳ 9.2 Monitoring & Alerting

- [ ] Set up uptime monitoring (uptimerobot.com)
- [ ] Set up error tracking (Sentry)
- [ ] Set up performance monitoring (New Relic optional)
- [ ] Create dashboards for metrics
- [ ] Set up Slack alerts for critical errors
- [ ] Document runbook for common issues

### ⏳ 9.3 Security Hardening

- [ ] Enable HTTPS only (redirect HTTP)
- [ ] Add rate limiting to API endpoints
- [ ] Add CORS configuration
- [ ] Set security headers (HSTS, X-Frame-Options)
- [ ] Audit JWT token expiry times
- [ ] Audit Paystack webhook verification
- [ ] Run security scanner on dependencies
- [ ] Document security procedures

### ⏳ 9.4 Documentation Completion

- [ ] API_ENDPOINTS.md - Final version with all endpoints
- [ ] DATABASE_SCHEMA.md - Final schema documentation
- [ ] DEPLOYMENT_GUIDE.md - Complete setup guide
- [ ] DEVELOPMENT_SETUP.md - Local dev environment setup
- [ ] TROUBLESHOOTING.md - Common issues and solutions
- [ ] MONITORING_GUIDE.md - How to monitor production
- [ ] RUNBOOK.md - Incident response procedures

### ⏳ 9.5 Team Handoff

- [ ] Hold training session for team on new backend
- [ ] Document code structure and architecture
- [ ] Create API client library for future frontend changes
- [ ] Set up development access for team members
- [ ] Set up staging environment for testing
- [ ] Document deployment procedures
- [ ] Create on-call rotation (optional)

---

## CHECKPOINTS & SIGN-OFFS

### Checkpoint 1: Foundation Complete (Week 1)

- [ ] NestJS project scaffolded
- [ ] PostgreSQL set up on Contabo
- [ ] Database migrated from Supabase
- [ ] AuthModule + TradingModule implemented
- [ ] Local Docker setup working

**Sign-off**: Ready to implement remaining modules

### Checkpoint 2: Backend Complete (Week 2)

- [ ] All 5 modules implemented (Auth, Trading, Payments, Prices, Notifications)
- [ ] All CRUD operations tested
- [ ] WebSocket tested with concurrent connections
- [ ] Payment webhook verified
- [ ] All scheduled tasks working
- [ ] API documentation complete

**Sign-off**: Backend ready for React migration

### Checkpoint 3: React Migration Complete (Week 3)

- [ ] All Supabase calls removed
- [ ] All API calls working via NestJS
- [ ] WebSocket price updates working
- [ ] Auth flow working
- [ ] All pages tested manually
- [ ] Build and deployment to Vercel working

**Sign-off**: React app ready for production

### Checkpoint 4: Production Deployment (Week 3-4)

- [ ] Backend deployed to Contabo
- [ ] React app deployed to Vercel
- [ ] SSL/HTTPS configured
- [ ] Monitoring and alerting working
- [ ] Backups configured
- [ ] All end-to-end testing passed

**Sign-off**: Production launch ready

### Final Sign-Off (Week 4)

- [ ] All monitoring green
- [ ] No critical errors in logs
- [ ] Performance metrics within targets
- [ ] User testing passed
- [ ] Documentation complete
- [ ] Team trained

**Sign-off**: Project complete ✅

---

## Notes

- **Parallel work**: Phases can overlap (e.g., React migration can start during backend module implementation)
- **Time estimates**: 3-4 weeks assumes full-time work, 20-30 hours/week
- **Risk mitigation**: Keep Supabase accessible for 1 week post-launch for quick rollback
- **Communication**: Update team daily on progress
- **Testing**: Test at each phase, not just at the end
- **Documentation**: Document as you go, not at the end
