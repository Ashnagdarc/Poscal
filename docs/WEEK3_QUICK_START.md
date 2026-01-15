# Quick Start: Testing Week 3 Payment System

## 1. Deploy Backend Functions (5 minutes)

```powershell
# Navigate to project
cd C:\Users\user\Documents\Poscal

# Deploy both Edge Functions
supabase functions deploy verify-payment
supabase functions deploy paystack-webhook

# Set Paystack secrets
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_133a9c403f32d8c55b89bb13d2a642c858a26969
supabase secrets set PAYSTACK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 2. Configure Paystack Webhook (3 minutes)

1. Go to https://dashboard.paystack.com
2. Navigate to **Settings → API Keys & Webhooks**
3. Click **Add Webhook URL**
4. Enter: `https://ywnmxrpasfikvwdgexdo.supabase.co/functions/v1/paystack-webhook`
5. Save and copy the webhook secret
6. Update Supabase secret: `supabase secrets set PAYSTACK_WEBHOOK_SECRET=whsec_xxxxx`

## 3. Reset Test User to Free (1 minute)

```sql
-- Run in Supabase SQL Editor
UPDATE profiles 
SET payment_status = 'free',
    subscription_tier = 'free',
    subscription_expires_at = NULL,
    trial_ends_at = NULL
WHERE email = 'daniel.nonso48@gmail.com';
```

## 4. Test Payment Flow (2 minutes)

1. Start dev server: `npm run dev`
2. Go to http://localhost:8081/pricing
3. Click **"Upgrade to Premium"**
4. Use test card:
   - Card: `4084 0840 8408 4081`
   - CVV: `408`
   - Expiry: `12/26`
   - PIN: `0000`
   - OTP: `123456`
5. Complete payment
6. Should see: "🎉 Payment successful! Welcome to Premium!"

## 5. Verify Database Updated (1 minute)

```sql
-- Check user subscription
SELECT email, payment_status, subscription_tier, subscription_expires_at
FROM profiles
WHERE email = 'daniel.nonso48@gmail.com';

-- Should show: payment_status='paid', subscription_tier='premium'

-- Check payment record
SELECT * FROM payments 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'daniel.nonso48@gmail.com')
ORDER BY created_at DESC LIMIT 1;

-- Check webhook log
SELECT * FROM paystack_webhook_logs 
ORDER BY created_at DESC LIMIT 1;
```

## 6. Test Feature Gates (3 minutes)

### As Free User (Reset first with Step 3 SQL)

**Journal:**
- Go to /journal
- Add 5 trades
- Try adding 6th → Should be blocked
- See upgrade prompt

**Signals:**
- Go to /signals
- See only 3 signals max
- "Take" button shows "Premium" and is disabled
- See upgrade prompt

**History:**
- Go to /calculator, make 15 calculations
- Go to /history
- See "Showing 10 of 15"
- See upgrade prompt

### As Premium User (After payment)

**Journal:**
- Add unlimited trades ✅
- No upgrade prompt

**Signals:**
- See all signals ✅
- "Take" button enabled ✅
- No upgrade prompt

**History:**
- See all 15 calculations ✅
- No upgrade prompt

## 7. Test Webhook (2 minutes)

```powershell
# Watch webhook logs in real-time
supabase functions logs paystack-webhook --follow
```

Then in Paystack Dashboard:
1. Go to **Settings → API Keys & Webhooks**
2. Click your webhook
3. Click **Test Webhook**
4. Select event: **charge.success**
5. Click **Send Test**
6. Check logs should show: `[webhook] Received event: charge.success`

## 8. Monitor Logs

```powershell
# Terminal 1: Watch verify-payment
supabase functions logs verify-payment --follow

# Terminal 2: Watch webhook
supabase functions logs paystack-webhook --follow

# Terminal 3: Run dev server
npm run dev
```

## Common Test Cards

**Success:**
- `4084 0840 8408 4081` (requires PIN & OTP)
- PIN: `0000`, OTP: `123456`

**Failure:**
- `5060 6666 6666 6666`

**Timeout:**
- `408 4081 5` (to test webhook redundancy)

## Quick Troubleshooting

**Payment modal doesn't open:**
- Check VITE_PAYSTACK_PUBLIC_KEY in `.env`
- Restart dev server

**Payment succeeds but database not updated:**
- Check Supabase function logs: `supabase functions logs verify-payment`
- Verify secrets are set: `supabase secrets list`

**Webhook not receiving events:**
- Check webhook URL is correct
- Test webhook in Paystack Dashboard
- Verify webhook secret matches

**Feature gates not working:**
- Verify user is actually free: `SELECT payment_status FROM profiles WHERE email = '...'`
- Check SubscriptionContext is refreshing
- Hard refresh browser (Ctrl+Shift+R)

## Done! 🎉

Total time: ~15 minutes for full testing

**Next:** Proceed to Week 4 (Admin Dashboard) or deploy to production following [WEEK3_DEPLOYMENT_GUIDE.md](WEEK3_DEPLOYMENT_GUIDE.md)
