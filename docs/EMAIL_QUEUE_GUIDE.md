# 📧 Email Queue System Guide

## 🎯 What This Does

**Automatically spreads welcome emails over multiple days** to stay within Resend's free tier (100 emails/day).

### How It Works:

1. **User signs up** → Added to email queue (instant, no delay)
2. **Scheduled job runs** → Every 4 hours, processes up to 95 emails
3. **Rate limiting** → Respects Resend's 2 req/sec limit
4. **Smart retry** → Failed emails retry up to 3 times
5. **Daily reset** → New day = another 100 emails can be sent

## 📊 Capacity

| Signups | Days to Email All            | Status |
| ------- | ---------------------------- | ------ |
| 100     | Same day                     | ✅     |
| 500     | 5 days                       | ✅     |
| 1,000   | 10 days                      | ✅     |
| 3,000   | 30 days (monthly limit)      | ⚠️     |
| 5,000   | Need to enable pay-as-you-go | ❌     |

## 🚀 Setup Instructions

### 1. Apply Database Migration

```bash
# Apply the migration to create email_queue table
npx supabase db push
```

This creates:

- `email_queue` table to store pending emails
- Trigger to automatically queue emails on signup

### 2. Deploy the Queue Processor

```bash
# Deploy the email processing function
npx supabase functions deploy process-email-queue --no-verify-jwt
```

### 3. Set Up Cron Job

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to [Database > Cron Jobs](https://supabase.com/dashboard/project/ywnmxrpasfikvwdgexdo/database/cron-jobs)
2. Click "Create a new cron job"
3. Name: `process-email-queue`
4. Schedule: `0 */4 * * *` (every 4 hours)
5. Command:
   ```sql
   SELECT net.http_post(
     url := 'https://ywnmxrpasfikvwdgexdo.supabase.co/functions/v1/process-email-queue',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
     ),
     body := '{}'::jsonb
   );
   ```

**Option B: Manual Trigger (For Testing)**

You can manually trigger the queue processing:

```bash
curl -X POST "https://ywnmxrpasfikvwdgexdo.supabase.co/functions/v1/process-email-queue" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### 4. Enable pg_cron Extension

```sql
-- Enable pg_cron extension in Supabase
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

## 📋 How to Monitor

### Check Queue Status

```sql
-- See pending emails
SELECT COUNT(*) as pending_count
FROM email_queue
WHERE status = 'pending';

-- See emails sent today
SELECT COUNT(*) as sent_today
FROM email_queue
WHERE status = 'sent'
  AND sent_at >= CURRENT_DATE;

-- See failed emails
SELECT *
FROM email_queue
WHERE status = 'failed';

-- Overall statistics
SELECT
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM email_queue
GROUP BY status;
```

### View Queue in Dashboard

You can also query the queue via Supabase dashboard:

1. Go to [Table Editor](https://supabase.com/dashboard/project/ywnmxrpasfikvwdgexdo/editor)
2. Select `email_queue` table
3. View pending/sent/failed emails

## ⚙️ Configuration

### Adjust Daily Limit

Edit `process-email-queue/index.ts`:

```typescript
const DAILY_EMAIL_LIMIT = 95; // Change this number
```

### Adjust Processing Frequency

Edit the cron schedule:

- `0 */4 * * *` = Every 4 hours
- `0 */2 * * *` = Every 2 hours
- `0 * * * *` = Every hour
- `*/30 * * * *` = Every 30 minutes

### Adjust Batch Size

Edit `process-email-queue/index.ts`:

```typescript
const BATCH_SIZE = 10; // Process 10 at a time
```

## 🔧 Troubleshooting

### Emails Not Being Sent

1. **Check if queue processor is running:**

   ```bash
   npx supabase functions list
   ```

2. **Check function logs:**

   ```bash
   npx supabase functions logs process-email-queue
   ```

3. **Manually trigger processing:**
   ```bash
   curl -X POST "YOUR_SUPABASE_URL/functions/v1/process-email-queue" \
     -H "Authorization: Bearer YOUR_KEY"
   ```

### Check Cron Job Status

```sql
-- View cron jobs
SELECT * FROM cron.job;

-- View cron job runs
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Reset Failed Emails

If emails failed and you want to retry them:

```sql
-- Reset failed emails to pending (they'll be retried)
UPDATE email_queue
SET status = 'pending',
    attempts = 0,
    error_message = NULL
WHERE status = 'failed';
```

### Clear Old Sent Emails

Keep database clean by removing old sent emails:

```sql
-- Delete emails sent more than 30 days ago
DELETE FROM email_queue
WHERE status = 'sent'
  AND sent_at < NOW() - INTERVAL '30 days';
```

## 📈 Scaling Up

### When You Need More Than 100/day:

**Option 1: Enable Resend Pay-as-you-go** ($0.90/1000 emails)

- Go to [Resend Settings](https://resend.com/settings/billing)
- Enable "Pay-as-you-go"
- Update `DAILY_EMAIL_LIMIT` to a higher number (e.g., 500)

**Option 2: Use Multiple Email Providers**

- Add fallback providers (SendGrid, AWS SES, etc.)
- Modify the queue processor to use different providers

**Option 3: Priority Queue**
Add priority system for VIP users:

```sql
-- Add priority column
ALTER TABLE email_queue ADD COLUMN priority INTEGER DEFAULT 1;

-- Modify queue query to prioritize
ORDER BY priority DESC, created_at ASC
```

## 🎨 Customization

### Add Different Email Types

```sql
-- The queue supports different email types
INSERT INTO email_queue (user_id, email, name, email_type)
VALUES ('user-id', 'user@example.com', 'John', 'password_reset');
```

Then modify the processor to handle different templates.

### Track Email Opens (Optional)

Add tracking to emails:

1. Use Resend's webhook feature
2. Add tracking pixels to HTML
3. Store open events in a separate table

## 🔐 Security Notes

- ✅ RLS enabled - users can only see their own queue entries
- ✅ Service role key kept secure in Edge Function
- ✅ Resend API key never exposed to frontend
- ✅ Automatic retry prevents data loss

## 📊 Performance

- Processes up to 95 emails every 4 hours
- Respects rate limits (500ms between requests)
- Failed emails automatically retry
- Daily counter resets at midnight UTC

## 🎉 Benefits

✅ **Stay within free tier** - 100 emails/day = 3,000/month  
✅ **No user blocking** - Signups work even if queue is full  
✅ **Automatic retry** - Failed emails don't get lost  
✅ **Scalable** - Handle 1,000+ signups without issues  
✅ **Monitoring** - Track queue status in real-time  
✅ **Cost effective** - Free for up to 3,000 users/month

## 💰 Cost Comparison

| Users/Month | With Queue (Free) | Without Queue (Pay-as-you-go) |
| ----------- | ----------------- | ----------------------------- |
| 100         | $0                | $0                            |
| 1,000       | $0                | $0.90                         |
| 3,000       | $0                | $2.70                         |
| 5,000       | Need upgrade      | $4.50                         |

---

**Need help?** Check the logs or contact info@poscalfx.com
