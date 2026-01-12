# PosCal Push Notification Sender

A lightweight Docker service that sends push notifications to your PosCal users. Polls the database every 30 seconds for queued notifications and delivers them via FCM (Firebase Cloud Messaging) and APNs (Apple Push Notification service).

## 📦 What's Included

- `index.ts` - Main service logic (190 lines)
- `Dockerfile` - Multi-stage build for ~100MB image
- `docker-compose.yml` - Ready-to-deploy configuration
- `.env.example` - Environment variable template

## 🚀 Quick Start (DigitalOcean Droplet)

### 1. Copy Files to Your Droplet

```bash
# On your local machine
cd push-sender
scp -r * root@your-droplet-ip:/opt/poscal-push-sender/
```

Or clone your repo and navigate to the folder:

```bash
# On your droplet
cd /opt
git clone <your-repo> poscal-push-sender
cd poscal-push-sender/push-sender
```

### 2. Create Environment File

```bash
# Copy example and edit
cp .env.example .env
nano .env
```

Fill in these **required** values:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VAPID_PUBLIC_KEY=BE7EfMew8pPJTxly2cBT7PxInN62M2HWPB0yB-bNGwUniu0b2ouoLbEmfiQjHu5vowBcW0caNzaWpwP9mBZ0CM0
VAPID_PRIVATE_KEY=your-private-key-here
```

**How to get these values:**

1. **Supabase URL & Service Role Key:**
   - Go to your [Supabase dashboard](https://supabase.com/dashboard)
   - Project Settings → API
   - Copy "Project URL" and "service_role" key

2. **VAPID Public Key:**
   - Already in your code: [src/hooks/use-push-notifications.ts](../src/hooks/use-push-notifications.ts#L7)
   - Or check your Supabase project (if stored there)

3. **VAPID Private Key:**
   - If you don't have it, generate new keys:
     ```bash
     npx web-push generate-vapid-keys
     ```
   - ⚠️ **Warning:** If you generate new keys, update the public key in your frontend code!

### 3. Deploy

**Option A: Standalone Docker**

```bash
# Build and run
docker build -t poscal-push-sender .
docker run -d \
  --name poscal-push-sender \
  --restart unless-stopped \
  --env-file .env \
  poscal-push-sender

# Check logs
docker logs -f poscal-push-sender
```

**Option B: Add to Existing docker-compose.yml**

```bash
# If you have other services running with docker-compose,
# add this service to your existing docker-compose.yml:

services:
  # ... your existing services ...
  
  poscal-push-sender:
    build:
      context: ./push-sender
      dockerfile: Dockerfile
    container_name: poscal-push-sender
    restart: unless-stopped
    env_file: ./push-sender/.env
    deploy:
      resources:
        limits:
          memory: 128M

# Then restart
docker-compose up -d
```

### 4. Verify It's Working

```bash
# Check logs
docker logs -f poscal-push-sender

# You should see:
# 🚀 Push Notification Sender started
# 📊 Polling every 30 seconds
# 🔗 Connected to: https://xxxxx.supabase.co
```

### 5. Test Push Notifications

1. **Subscribe to push** in your app (bell icon)
2. **Create a test notification** (e.g., create a new signal or app update)
3. **Check service logs:**
   ```bash
   docker logs poscal-push-sender
   ```
4. **You should see within 30 seconds:**
   ```
   📬 Processing 1 notification(s)...
   📤 Sending to 1 subscriber(s)...
   ✅ Notification "Test": 1 sent, 0 failed
   ```

## 📊 Resource Usage

- **Memory:** ~50-80MB (128MB limit set)
- **CPU:** <1% (mostly idle)
- **Network:** ~2MB/day for 1000 notifications
- **Disk:** ~100MB (Docker image)

Perfect for adding to your existing droplet!

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ | - | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | - | Service role key (has admin access) |
| `VAPID_PUBLIC_KEY` | ✅ | - | Web Push public key |
| `VAPID_PRIVATE_KEY` | ✅ | - | Web Push private key |
| `VAPID_SUBJECT` | ❌ | `mailto:admin@poscal.app` | Contact email |
| `POLL_INTERVAL` | ❌ | `30000` | Check interval (ms) |

### Adjusting Poll Interval

```env
# Faster delivery (every 10 seconds)
POLL_INTERVAL=10000

# Less frequent (every 2 minutes)
POLL_INTERVAL=120000
```

## 🐛 Troubleshooting

### Service won't start

```bash
# Check logs for errors
docker logs poscal-push-sender

# Common issues:
# - Missing environment variables
# - Invalid Supabase credentials
# - Network issues
```

### Notifications not sending

```bash
# 1. Check if notifications are queued
# In your Supabase SQL editor:
SELECT * FROM push_notification_queue WHERE status = 'pending';

# 2. Check if subscriptions exist
SELECT * FROM push_subscriptions;

# 3. Check service logs
docker logs -f poscal-push-sender
```

### Expired subscriptions

The service automatically removes expired subscriptions (HTTP 410/404 responses).

### Generate new VAPID keys

```bash
npx web-push generate-vapid-keys

# Then update:
# 1. .env file (VAPID_PRIVATE_KEY)
# 2. src/hooks/use-push-notifications.ts (VAPID_PUBLIC_KEY)
# 3. Ask users to re-subscribe
```

## 🔄 Updates

```bash
# Pull latest code
cd /opt/poscal-push-sender
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Or standalone:
docker build -t poscal-push-sender .
docker stop poscal-push-sender
docker rm poscal-push-sender
docker run -d --name poscal-push-sender --restart unless-stopped --env-file .env poscal-push-sender
```

## 📝 Monitoring

### Check service status

```bash
docker ps | grep poscal-push-sender
```

### View live logs

```bash
docker logs -f poscal-push-sender
```

### Restart service

```bash
docker restart poscal-push-sender
```

### Check resource usage

```bash
docker stats poscal-push-sender
```

## 🔒 Security Notes

- **Service role key:** Has admin access to your database. Keep it secret!
- **VAPID private key:** Required for push notifications. Keep it secret!
- **Non-root user:** Service runs as `nodejs` user (UID 1001) for security
- **Resource limits:** 128MB memory limit prevents runaway processes

## 📞 Support

If you encounter issues:

1. Check logs: `docker logs poscal-push-sender`
2. Verify environment variables: `docker exec poscal-push-sender env | grep SUPABASE`
3. Test database connection: Check Supabase dashboard for active connections
4. Verify VAPID keys: Use `npx web-push generate-vapid-keys` to generate new ones if needed

---

**Ready to deploy?** Follow the Quick Start steps above! 🚀
