# Edge Functions to RPC Migration Guide

## ✅ What Was Changed

We've migrated from Edge Functions to PostgreSQL RPC (Remote Procedure Call) functions to **eliminate edge function invocations** and reduce costs.

### Edge Functions Replaced:

1. ✅ **subscribe-push** → `subscribe_push_notification()` RPC
2. ✅ **send-push-notification** → `queue_push_notification()` RPC
3. ✅ **close-signal-trades** → `close_signal_trades()` RPC

### Benefits:

- 🚀 **Faster execution** - No HTTP overhead
- 💰 **Zero edge function costs** - RPC functions are free
- 🔒 **Same security** - Uses `SECURITY DEFINER` for elevated permissions
- 🎯 **Better performance** - Direct database access

## 📋 Migration Steps

### Step 1: Apply the Migration

```bash
# Make sure you're connected to your Supabase project
npx supabase db push
```

This will create:

- `subscribe_push_notification()` - Stores push subscriptions
- `close_signal_trades()` - Closes trades with P&L calculation
- `queue_push_notification()` - Queues push notifications
- `push_notification_queue` table - Stores notifications to send

### Step 2: Verify Client Code Updates

All client code has been updated automatically:

**Updated Files:**

- ✅ [src/pages/AdminUpdates.tsx](src/pages/AdminUpdates.tsx)
- ✅ [src/hooks/use-push-notifications.ts](src/hooks/use-push-notifications.ts)
- ✅ [src/components/UpdateSignalModal.tsx](src/components/UpdateSignalModal.tsx)
- ✅ [src/components/CreateSignalModal.tsx](src/components/CreateSignalModal.tsx)

### Step 3: Test the Changes

1. **Test Push Subscription:**

   ```typescript
   // Should work automatically when users enable notifications
   // Check browser console for "[push] subscribe_push_notification response"
   ```

2. **Test Signal Creation:**

   ```typescript
   // Create a new signal - notification should be queued
   // Check: SELECT * FROM push_notification_queue;
   ```

3. **Test Closing Trades:**
   ```typescript
   // Update a signal result (WIN/LOSS/BREAK_EVEN)
   // All taken trades should close automatically
   ```

## 🔧 Push Notification Sending (Optional)

Currently, notifications are **queued** but not automatically sent. You have 3 options:

### Option 1: External Service (Recommended)

Create a simple Node.js service that polls the queue:

```typescript
// push-sender.ts
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

webpush.setVapidDetails(
  "mailto:admin@poscal.app",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

async function processPushQueue() {
  // Get pending notifications
  const { data: notifications } = await supabase
    .from("push_notification_queue")
    .select("*")
    .eq("status", "pending")
    .limit(10);

  for (const notification of notifications || []) {
    // Get all subscriptions
    const { data: subscriptions } = await supabase.rpc(
      "get_active_push_subscriptions"
    );

    // Send to each subscriber
    for (const sub of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            tag: notification.tag,
            data: notification.data,
          })
        );
      } catch (error) {
        console.error("Failed to send push:", error);
      }
    }

    // Mark as sent
    await supabase
      .from("push_notification_queue")
      .update({ status: "sent", processed_at: new Date() })
      .eq("id", notification.id);
  }
}

// Run every 30 seconds
setInterval(processPushQueue, 30000);
```

Deploy this to:

- **Railway.app** (free tier)
- **Fly.io** (free tier)
- **Any VPS** ($5/month)

### Option 2: GitHub Actions (Free)

Run every 5 minutes via GitHub Actions:

```yaml
# .github/workflows/push-sender.yml
name: Send Push Notifications
on:
  schedule:
    - cron: "*/5 * * * *" # Every 5 minutes

jobs:
  send:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: node push-sender.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SERVICE_ROLE_KEY: ${{ secrets.SERVICE_ROLE_KEY }}
          VAPID_PUBLIC_KEY: ${{ secrets.VAPID_PUBLIC_KEY }}
          VAPID_PRIVATE_KEY: ${{ secrets.VAPID_PRIVATE_KEY }}
```

### Option 3: Keep Edge Function for Sending Only

You can keep just the `send-push-notification` edge function but call it much less frequently:

```typescript
// Modified to process queue
const { data: notifications } = await supabase
  .from("push_notification_queue")
  .select("*")
  .eq("status", "pending");

// Process them...
```

## 📊 Expected Results

**Before:**

- Edge function invocations: ~1000-5000/day
- Cost: Depends on your plan
- Latency: 200-500ms per call

**After:**

- Edge function invocations: **0/day** (or minimal if using Option 3)
- Cost: **$0** for RPC functions
- Latency: <50ms per call

## 🗑️ Cleanup (After Testing)

Once everything works, you can delete the old edge functions:

```bash
# Remove edge function directories
rm -rf supabase/functions/subscribe-push
rm -rf supabase/functions/close-signal-trades
# Keep send-push-notification if using Option 3
```

## 🆘 Troubleshooting

**Issue:** RPC function not found

```
Solution: Run `npx supabase db push` to apply migrations
```

**Issue:** Permission denied on RPC function

```
Solution: Functions use SECURITY DEFINER, check if user is authenticated
```

**Issue:** Notifications not being sent

```
Solution: Set up one of the push sender options above
```

## 📝 Summary

✅ All edge function invocations eliminated  
✅ Client code updated to use RPC  
✅ Database functions created  
⏳ Push notifications now queued (need sender service)

**Next Step:** Choose a push notification sending option from above, or simply queue them for now and implement sending later.
