# RevenueCat Integration - Setup Guide

## ✅ Phase 1-4: Implementation Complete

### Backend (NestJS)
- ✅ `src/revenuecat/revenuecat.service.ts` - Service to fetch user entitlements from RevenueCat REST API
- ✅ `src/revenuecat/revenuecat-webhook.controller.ts` - Webhook endpoint at `/webhooks/revenuecat`
- ✅ `src/revenuecat/revenuecat.module.ts` - Module with service and controller
- ✅ `src/payments/payments.controller.ts` - Added `GET /payments/entitlements` endpoint
- ✅ `src/auth/entities/user.entity.ts` - Added RevenueCat fields:
  - `revenue_cat_user_id` (nullable string)
  - `subscription_tier` (string, default 'free')
  - `subscription_expires_at` (nullable timestamp)
- ✅ `src/database/migrations/1776160440000-AddRevenuecatFieldsToUsers.ts` - Migration ready to run
- ✅ `src/app.module.ts` - RevenuecatModule imported

### Frontend (React)
- ✅ `src/lib/api.ts` - Added `subscriptionApi.getEntitlements()` method
- ✅ `src/contexts/SubscriptionContext.tsx` - Updated to fetch from RevenueCat entitlements API with fallback to old API (shadow mode)

## 🚀 Phase 5: Next Steps to Activate

### 1. RevenueCat Account Setup (Non-Technical)
1. Create RevenueCat account at https://revenuecat.com
2. Create organization and app
3. Set up products and entitlements:
   - Create products (one-time or subscription)
   - Create entitlements: `premium_access`, `pro_access`
   - Assign entitlements to products
4. Get API key from RevenueCat dashboard
5. Get Webhook Secret from Settings → Integrations → Webhooks

### 2. Environment Variables
Add to your `.env` file (backend root):
```
REVENUECAT_API_KEY=your_api_key_here
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Database Migration
Run the migration to add RevenueCat fields to users table:
```bash
cd backend
npm run migration:run
```

### 4. Test the Backend Integration
```bash
# Start backend
npm run start:dev

# Test entitlements endpoint (requires JWT token)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/payments/entitlements
```

Expected response:
```json
{
  "subscriptionTier": "free",
  "entitlements": [],
  "expiresAt": null,
  "isActive": false
}
```

### 5. Configure RevenueCat Webhook
In RevenueCat dashboard:
1. Settings → Integrations → Webhooks
2. Add webhook URL: `https://yourdomain.com/webhooks/revenuecat`
3. Select events: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
4. Add signature header secret (from environment)

### 6. Frontend Configuration (Optional for Now)
For web checkout, you'll need RevenueCat Web SDK in `src/hooks/useRevenueCat.ts`:
```tsx
import { Purchases } from '@revenuecat/purchases-js';

export const useRevenueCat = () => {
  useEffect(() => {
    Purchases.configure({
      apiKey: import.meta.env.VITE_REVENUECAT_PUBLIC_API_KEY,
      appUserID: user.id, // Set after authentication
    });
  }, [user]);
  
  // ... implement checkout logic
};
```

## 📊 Current Architecture

```
Frontend (React)
  ↓
GET /payments/entitlements (JWT required)
  ↓
Backend (NestJS)
  ↓
RevenuecatService.getUserEntitlements(userId)
  ↓
RevenueCat REST API
  ↓
Cache in subscriptions object (no DB cache yet)
  ↓
Map entitlements → SubscriptionContext
  ↓
ProtectedRoute enforces feature access
```

## 🔄 Entitlements Mapping

Current mapping in `RevenuecatService.mapEntitlementsToTier()`:
- `pro_access` → tier: 'pro'
- `premium_access` → tier: 'premium'
- No active entitlements → tier: 'free'

Customize in RevenuecatService to match your product/entitlement setup.

## ⚠️ Currently Not Implemented

1. **Web Checkout**: RevenueCat Web SDK integration in Pricing.tsx
   - Requires `VITE_REVENUECAT_PUBLIC_API_KEY` environment variable
   - Use `src/hooks/useRevenueCat.ts` to initialize checkout button

2. **Cache Layer**: Entitlements are fetched fresh each time
   - Can add Redis cache in backend for performance

3. **Webhook Signature Verification**: Commented out in controller
   - Requires middleware to capture raw body
   - Can be enabled once middleware is in place

4. **iOS/Android Integration**: React Native SDK not added yet
   - Install `react-native-purchases` when needed
   - Configure for StoreKit (iOS) and Google Play (Android)

## 🧪 Testing Checklist

- [ ] Backend migration runs successfully
- [ ] GET /payments/entitlements returns correct structure
- [ ] RevenueCat webhook receives purchase event
- [ ] Frontend SubscriptionContext updates after purchase
- [ ] Paid lock and premium routes respect entitlements

## 📝 Notes

- The RevenueCat SDK uses a REST API, so no NPM package needed
- Frontend currently uses shadow mode: tries entitlements first, falls back to old API
- Once verified, can remove old subscription API calls
- Revenue Cat handles all billing logic, we just read entitlements

