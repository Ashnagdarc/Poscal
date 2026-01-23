# API Endpoints Documentation

**Project**: Poscal NestJS Backend  
**Version**: 1.0.0  
**Base URL**: `https://api.poscal.com` (Production) | `http://localhost:3001` (Development)

---

## Authentication

All endpoints (except public routes) require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Auth Module

### Health Check
```http
GET /health
```
**Description**: Check API health status  
**Auth Required**: No  
**Response**:
```json
{
  "status": "ok",
  "timestamp": "2026-01-23T10:30:00.000Z"
}
```

### Validate Token
```http
POST /auth/validate
```
**Description**: Validate JWT token  
**Auth Required**: Yes  
**Request Body**:
```json
{
  "token": "eyJhbGc..."
}
```
**Response**:
```json
{
  "valid": true,
  "userId": "uuid",
  "email": "user@example.com"
}
```

### Get Current User
```http
POST /auth/me
```
**Description**: Get current authenticated user details  
**Auth Required**: Yes  
**Response**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "subscription_tier": "free",
  "subscription_expiry": "2026-02-23T00:00:00.000Z"
}
```

---

## Trading Module

### Get Trades (Trading Journal)
```http
GET /trades?account_id=uuid&status=open&limit=50
```
**Description**: Get user's trading journal entries  
**Auth Required**: Yes  
**Query Parameters**:
- `account_id` (optional): Filter by trading account
- `status` (optional): Filter by status (`open`, `closed`)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "account_id": "uuid",
      "symbol": "EUR/USD",
      "direction": "buy",
      "entry_price": 1.0850,
      "stop_loss": 1.0800,
      "take_profit": 1.0950,
      "position_size": 0.1,
      "status": "open",
      "created_at": "2026-01-23T10:00:00.000Z"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Create Trade
```http
POST /trades
```
**Description**: Create a new trade entry  
**Auth Required**: Yes  
**Request Body**:
```json
{
  "account_id": "uuid",
  "symbol": "EUR/USD",
  "direction": "buy",
  "entry_price": 1.0850,
  "stop_loss": 1.0800,
  "take_profit": 1.0950,
  "position_size": 0.1,
  "notes": "Trading setup based on signal #123"
}
```

### Update Trade
```http
PUT /trades/:id
```
**Description**: Update an existing trade  
**Auth Required**: Yes (owner only)  
**Request Body**: Same as Create Trade

### Delete Trade
```http
DELETE /trades/:id
```
**Description**: Delete a trade entry  
**Auth Required**: Yes (owner only)

### Get Single Trade
```http
GET /trades/:id
```
**Description**: Get detailed information about a single trade  
**Auth Required**: Yes (owner only)

---

## Signals Module

### Get Active Signals
```http
GET /signals?status=active&limit=20
```
**Description**: Get trading signals  
**Auth Required**: Yes  
**Query Parameters**:
- `status` (optional): Filter by status (`active`, `closed`, `cancelled`)
- `symbol` (optional): Filter by symbol
- `limit` (optional): Number of results

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "symbol": "GBP/USD",
      "direction": "buy",
      "entry_price": 1.2650,
      "stop_loss": 1.2600,
      "take_profit": 1.2750,
      "status": "active",
      "created_at": "2026-01-23T08:00:00.000Z",
      "expires_at": "2026-01-24T08:00:00.000Z"
    }
  ]
}
```

### Create Signal (Admin Only)
```http
POST /signals
```
**Description**: Create a new trading signal  
**Auth Required**: Yes (admin only)  
**Request Body**:
```json
{
  "symbol": "GBP/USD",
  "direction": "buy",
  "entry_price": 1.2650,
  "stop_loss": 1.2600,
  "take_profit": 1.2750,
  "analysis": "Strong support at 1.2600",
  "expires_at": "2026-01-24T08:00:00.000Z"
}
```

### Update Signal (Admin Only)
```http
PUT /signals/:id
```
**Description**: Update a signal  
**Auth Required**: Yes (admin only)

### Close Signal (Admin Only)
```http
DELETE /signals/:id
```
**Description**: Close/cancel a signal  
**Auth Required**: Yes (admin only)

---

## Accounts Module

### Get User Accounts
```http
GET /accounts
```
**Description**: Get user's trading accounts  
**Auth Required**: Yes

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "account_name": "Live Account",
      "broker": "FXTM",
      "account_number": "123456",
      "balance": 5000.00,
      "currency": "USD",
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### Create Account
```http
POST /accounts
```
**Description**: Create a new trading account  
**Auth Required**: Yes  
**Request Body**:
```json
{
  "account_name": "Live Account",
  "broker": "FXTM",
  "account_number": "123456",
  "balance": 5000.00,
  "currency": "USD"
}
```

### Update Account
```http
PUT /accounts/:id
```
**Description**: Update trading account details  
**Auth Required**: Yes (owner only)

### Delete Account
```http
DELETE /accounts/:id
```
**Description**: Delete a trading account  
**Auth Required**: Yes (owner only)

---

## Payments Module

### Paystack Webhook
```http
POST /webhooks/paystack
```
**Description**: Receive Paystack payment webhooks  
**Auth Required**: No (HMAC verification)  
**Headers**:
- `x-paystack-signature`: HMAC signature

### Verify Payment
```http
POST /payments/verify
```
**Description**: Verify a payment reference  
**Auth Required**: Yes  
**Request Body**:
```json
{
  "reference": "REF_123456789"
}
```

**Response**:
```json
{
  "status": "success",
  "amount": 5000,
  "tier": "pro",
  "subscription_expiry": "2026-02-23T00:00:00.000Z"
}
```

### Get Payment Status
```http
GET /payments/status/:userId
```
**Description**: Get user's payment and subscription status  
**Auth Required**: Yes (admin or self)

---

## Prices Module

### Get Cached Prices
```http
GET /prices?symbols=EURUSD,GBPUSD
```
**Description**: Get cached forex prices  
**Auth Required**: Yes  
**Query Parameters**:
- `symbols` (optional): Comma-separated list of symbols

**Response**:
```json
{
  "data": [
    {
      "symbol": "EURUSD",
      "bid_price": 1.0850,
      "ask_price": 1.0852,
      "mid_price": 1.0851,
      "timestamp": "2026-01-23T10:30:00.000Z"
    }
  ]
}
```

### Get Single Symbol Price
```http
GET /prices/:symbol
```
**Description**: Get price for a specific symbol  
**Auth Required**: Yes

---

## WebSocket (Prices Gateway)

### Connect to WebSocket
```
ws://localhost:3001/prices (Development)
wss://api.poscal.com/prices (Production)
```

**Auth**: Include JWT token in connection query:
```
ws://localhost:3001/prices?token=<jwt_token>
```

### Subscribe to Price Updates
```json
{
  "event": "subscribe",
  "data": {
    "symbols": ["EURUSD", "GBPUSD", "USDJPY"]
  }
}
```

### Unsubscribe from Price Updates
```json
{
  "event": "unsubscribe",
  "data": {
    "symbols": ["EURUSD"]
  }
}
```

### Receive Price Updates
```json
{
  "event": "price_update",
  "data": {
    "symbol": "EURUSD",
    "bid_price": 1.0850,
    "ask_price": 1.0852,
    "mid_price": 1.0851,
    "timestamp": "2026-01-23T10:30:00.000Z"
  }
}
```

---

## Notifications Module

### Register Push Subscription
```http
POST /notifications/subscribe
```
**Description**: Register device for push notifications  
**Auth Required**: Yes  
**Request Body**:
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

### Send Notification (Admin Only)
```http
POST /notifications/send
```
**Description**: Send a push notification  
**Auth Required**: Yes (admin only)  
**Request Body**:
```json
{
  "user_id": "uuid",
  "title": "New Trading Signal",
  "body": "Buy EUR/USD at 1.0850",
  "data": {
    "signal_id": "uuid"
  }
}
```

### Get Queue Status (Admin Only)
```http
GET /notifications/queue-status
```
**Description**: Get notification queue status  
**Auth Required**: Yes (admin only)

---

## Error Responses

All endpoints return standardized error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "entry_price",
      "message": "must be a positive number"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Error details (in development only)"
}
```

---

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Authenticated**: 200 requests per minute per user
- **WebSocket**: 10 messages per second per connection

When rate limit is exceeded:
```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "retryAfter": 60
}
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All prices are decimal numbers with up to 5 decimal places
- All amounts are in the smallest currency unit (e.g., kobo for NGN)
- UUIDs are version 4 UUIDs
- Pagination uses `limit` and `offset` query parameters
- Filtering supports exact match and basic operators
