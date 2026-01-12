# How to Fix Excessive Edge Function Invocations

## Problem

The `monitor-signals` Edge Function has been called 792K times, exceeding the free plan quota.

## Root Cause

There's likely a cron job or webhook configured in Supabase Dashboard calling `monitor-signals` too frequently (possibly every few seconds instead of every few minutes).

## Solution

### Option 1: Disable Auto-Monitoring (Recommended for Free Plan)

1. Go to **Supabase Dashboard** → Your Project → **Database** → **Webhooks**
2. Look for any webhooks calling `monitor-signals`
3. **Delete or disable** the webhook

4. Go to **Database** → **Extensions** → **pg_cron** (if enabled)
5. Look for cron jobs calling the function
6. Disable or delete them

### Option 2: Reduce Frequency (If You Want to Keep It)

If you want to keep price monitoring active:

1. Change the cron schedule from `*/10 * * * *` (every 10 seconds) to `*/5 * * * *` (every 5 minutes)
2. Or even better: `*/15 * * * *` (every 15 minutes) to stay within free limits

### Calculate Your Usage

- **Free Plan:** 500K invocations/month
- **Every 5 minutes:** 8,640 invocations/month ✅
- **Every 1 minute:** 43,200 invocations/month ✅
- **Every 10 seconds:** 259,200 invocations/month ⚠️
- **Every 1 second:** 2,592,000 invocations/month ❌

### Manual Alternative (Best for Free Plan)

Instead of auto-monitoring, manually refresh signals when needed:

1. Admin opens the Signals page
2. Prices are checked only when viewing
3. Zero background invocations

### Check Current Configuration

Run this SQL to check for cron jobs:

```sql
SELECT * FROM cron.job WHERE command LIKE '%monitor-signals%';
```

If you find any, delete with:

```sql
SELECT cron.unschedule('job_name_here');
```

## Immediate Action

Until you fix the cron frequency, the monitoring will continue to burn through your quota. **Disable it immediately** to prevent further charges when you upgrade.
