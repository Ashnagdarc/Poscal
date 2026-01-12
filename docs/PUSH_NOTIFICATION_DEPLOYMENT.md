# 🚀 Push Notification Service - DigitalOcean Deployment Guide

This guide covers the complete setup of the Poscal push notification sender service on DigitalOcean using Docker.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The push notification service is a lightweight Docker container that:

- **Polls** the Supabase `push_notification_queue` table every 30 seconds
- **Processes** queued notifications for all subscribers
- **Delivers** notifications via Web Push API with VAPID authentication
- **Updates** notification status (sent/failed) in the database
- **Cleans up** expired push subscriptions automatically

### Why a Separate Service?

- **Edge Function Limits**: Supabase free tier has 500,000 edge function invocations/month
- **Cost Efficiency**: Running on your own droplet avoids edge function quota consumption
- **Reliability**: Independent service ensures notifications are delivered even during high traffic
- **Performance**: 30-second polling interval for near real-time delivery

### Resource Requirements

- **Memory**: ~50-80MB (128MB limit recommended)
- **CPU**: <1% (mostly idle, spikes during notification processing)
- **Disk**: ~100MB (Docker image)
- **Network**: ~2MB/day for 1,000 notifications
- **Bandwidth**: Minimal (primarily HTTP requests to push endpoints)

---

## 📦 Prerequisites

### 1. DigitalOcean Droplet

**Minimum Requirements:**
- **Plan**: Basic Droplet ($6/month or higher)
- **RAM**: 1GB minimum (512MB may work but not recommended)
- **OS**: Ubuntu 22.04 LTS (recommended)
- **Docker**: Installed

**Recommended Specs:**
- **RAM**: 2GB for running multiple services
- **CPU**: 1 vCPU
- **Storage**: 25GB SSD

### 2. Required Credentials

You'll need the following from your Supabase project:

#### A. Supabase Credentials
```bash
SUPABASE_URL              # Your project URL
SUPABASE_SERVICE_ROLE_KEY # Service role key (admin access)
```

**Where to find:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy **Project URL** and **service_role** key (not anon key!)

#### B. VAPID Keys
```bash
VAPID_PUBLIC_KEY   # Public key for browser subscription
VAPID_PRIVATE_KEY  # Private key for signing notifications
```

**Where to find:**
- Check your frontend code: `src/hooks/use-push-notifications.ts`
- Or generate new keys: `npx web-push generate-vapid-keys`

⚠️ **Important**: If you generate new VAPID keys:
1. Update the public key in your frontend code
2. All users must re-subscribe to push notifications
3. Old subscriptions will stop working

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Poscal App    │
│   (Frontend)    │
└────────┬────────┘
         │
         │ 1. User subscribes to push
         │    (stores subscription in DB)
         │
         ▼
┌─────────────────────────────────┐
│      Supabase Database          │
│  ┌──────────────────────────┐  │
│  │  push_subscriptions      │  │  Stores user push endpoints
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ push_notification_queue  │  │  Queue for pending notifications
│  └──────────────────────────┘  │
└────────────┬────────────────────┘
             │
             │ 2. App creates notification
             │    (e.g., signal hits TP)
             │
             ▼
   ┌─────────────────────┐
   │  DigitalOcean       │
   │  Docker Service     │
   │                     │
   │  ┌──────────────┐  │
   │  │ Push Sender  │  │  3. Polls DB every 30s
   │  │   Service    │  │  4. Fetches subscribers
   │  │              │  │  5. Sends Web Push
   │  │  (Node.js)   │  │  6. Updates status
   │  └──────────────┘  │
   └─────────────────────┘
             │
             │ 7. Delivers notification
             │
             ▼
   ┌─────────────────────┐
   │  User's Browser     │
   │  (Service Worker)   │
   └─────────────────────┘
```

### Database Schema

#### `push_subscriptions` Table
```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `push_notification_queue` Table
```sql
CREATE TABLE push_notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  icon TEXT,
  badge TEXT,
  data JSONB,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
```

---

## 🛠️ Setup Instructions

### Step 1: Prepare Your Droplet

SSH into your DigitalOcean droplet:

```bash
ssh root@your-droplet-ip
```

**Install Docker (if not already installed):**

```bash
# Update package index
apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version
```

### Step 2: Create Working Directory

```bash
# Create directory for the service
mkdir -p /opt/poscal-push-sender
cd /opt/poscal-push-sender
```

### Step 3: Copy Service Files

**Option A: Clone from Git (Recommended)**

```bash
# If your repo is private, set up SSH key first
# Then clone
git clone https://github.com/yourusername/Poscal.git temp
mv temp/push-sender/* .
rm -rf temp

# Or just clone the push-sender directory if your repo supports sparse checkout
```

**Option B: Manual File Transfer**

From your local machine:

```bash
cd /path/to/Poscal/push-sender
scp -r * root@your-droplet-ip:/opt/poscal-push-sender/
```

### Step 4: Create Environment File

```bash
cd /opt/poscal-push-sender

# Create .env file
nano .env
```

Paste and configure:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxx

# VAPID Keys (Web Push)
VAPID_PUBLIC_KEY=BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional Configuration
VAPID_SUBJECT=mailto:admin@poscal.app
POLL_INTERVAL=30000
```

**Save and exit** (Ctrl+X, then Y, then Enter)

### Step 5: Build and Deploy

```bash
# Build the Docker image
docker-compose build

# Start the service
docker-compose up -d

# Verify it's running
docker ps | grep poscal-push-sender
```

You should see output like:
```
CONTAINER ID   IMAGE                  STATUS         PORTS     NAMES
abc123def456   poscal-push-sender    Up 10 seconds            poscal-push-sender
```

### Step 6: Verify Service is Working

```bash
# Check logs
docker logs -f poscal-push-sender
```

You should see:
```
🚀 Push Notification Sender started
📊 Polling every 30 seconds
🔗 Connected to: https://xxxxxxxxxxxxx.supabase.co

🔍 Checking for notifications...
✅ Found 0 pending notifications
```

Press Ctrl+C to exit log view.

---

## ⚙️ Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access) | `eyJhbGciOiJIUzI1NiIs...` |
| `VAPID_PUBLIC_KEY` | Web Push public key | `BExxxxxxxxxxxx...` |
| `VAPID_PRIVATE_KEY` | Web Push private key | `xxxxxxxxx...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VAPID_SUBJECT` | `mailto:admin@poscal.app` | Contact email for push service |
| `POLL_INTERVAL` | `30000` | Check interval in milliseconds |

### Configuration Examples

**Faster delivery (every 10 seconds):**
```env
POLL_INTERVAL=10000
```

**Less frequent (every 2 minutes):**
```env
POLL_INTERVAL=120000
```

**Custom contact email:**
```env
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 🚀 Deployment

### Docker Compose (Recommended)

The included `docker-compose.yml`:

```yaml
version: '3.8'

services:
  poscal-push-sender:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: poscal-push-sender
    restart: unless-stopped
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 128M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Features:**
- Auto-restart on failure
- Memory limit (128MB)
- Log rotation (max 10MB per file, 3 files)

**Commands:**

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose build
docker-compose up -d
```

### Standalone Docker

If you prefer not to use Docker Compose:

```bash
# Build
docker build -t poscal-push-sender .

# Run
docker run -d \
  --name poscal-push-sender \
  --restart unless-stopped \
  --env-file .env \
  --memory 128m \
  poscal-push-sender

# Stop
docker stop poscal-push-sender

# Start
docker start poscal-push-sender

# Remove
docker rm poscal-push-sender
```

---

## 📊 Monitoring & Maintenance

### Check Service Status

```bash
# Is it running?
docker ps | grep poscal-push-sender

# Resource usage
docker stats poscal-push-sender
```

### View Logs

```bash
# Live logs
docker logs -f poscal-push-sender

# Last 100 lines
docker logs --tail 100 poscal-push-sender

# Logs with timestamps
docker logs -t poscal-push-sender
```

### Log Examples

**Successful processing:**
```
🔍 Checking for notifications...
📬 Processing 2 notification(s)...
📤 Sending to 15 subscriber(s)...
✅ Notification "EUR/USD Hit TP1": 15 sent, 0 failed
✅ Notification "GBP/USD Hit SL": 15 sent, 0 failed
```

**No notifications:**
```
🔍 Checking for notifications...
✅ Found 0 pending notifications
```

**Failed subscriptions (cleaned up automatically):**
```
📤 Sending to 10 subscriber(s)...
⚠️  Removed expired subscription (HTTP 410)
✅ Notification "Test": 9 sent, 1 failed
```

### Database Monitoring

Check notification queue status:

```sql
-- Pending notifications
SELECT * FROM push_notification_queue 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Recent sent notifications
SELECT * FROM push_notification_queue 
WHERE status = 'sent' 
ORDER BY sent_at DESC 
LIMIT 10;

-- Failed notifications
SELECT * FROM push_notification_queue 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Active subscriptions
SELECT COUNT(*) FROM push_subscriptions;
```

### Health Check Script

Create a monitoring script:

```bash
nano /opt/poscal-push-sender/health-check.sh
```

```bash
#!/bin/bash

# Check if container is running
if docker ps | grep -q poscal-push-sender; then
    echo "✅ Service is running"
    
    # Check memory usage
    MEM=$(docker stats --no-stream --format "{{.MemUsage}}" poscal-push-sender)
    echo "💾 Memory: $MEM"
    
    # Check recent logs for errors
    ERRORS=$(docker logs --tail 50 poscal-push-sender 2>&1 | grep -i error | wc -l)
    if [ $ERRORS -gt 0 ]; then
        echo "⚠️  Found $ERRORS errors in recent logs"
    else
        echo "✅ No errors in recent logs"
    fi
else
    echo "❌ Service is NOT running!"
    exit 1
fi
```

```bash
chmod +x /opt/poscal-push-sender/health-check.sh

# Run it
./health-check.sh
```

### Updates

**Pull and deploy updates:**

```bash
cd /opt/poscal-push-sender

# Pull latest code
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Verify
docker logs -f poscal-push-sender
```

**Manual update:**

```bash
# Copy new files from local machine
scp -r push-sender/* root@your-droplet-ip:/opt/poscal-push-sender/

# On droplet
cd /opt/poscal-push-sender
docker-compose build
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Service Won't Start

**Problem:** Container exits immediately

```bash
# Check logs for errors
docker logs poscal-push-sender

# Common issues and solutions:
```

**Issue 1: Missing environment variables**
```
Error: SUPABASE_URL is required
```
**Solution:** Check your `.env` file has all required variables

**Issue 2: Invalid Supabase credentials**
```
Error: Invalid JWT
```
**Solution:** Verify your `SUPABASE_SERVICE_ROLE_KEY` is correct (not the anon key!)

**Issue 3: Network issues**
```
Error: ENOTFOUND xxxxx.supabase.co
```
**Solution:** Check droplet has internet access: `ping supabase.com`

### Notifications Not Sending

**Problem:** Service runs but notifications aren't delivered

**Step 1: Check if notifications are queued**
```sql
-- In Supabase SQL editor
SELECT * FROM push_notification_queue 
WHERE status = 'pending';
```

**Step 2: Check if subscriptions exist**
```sql
SELECT COUNT(*) as subscriber_count 
FROM push_subscriptions;
```

**Step 3: Verify VAPID keys match**
- Public key in frontend: `src/hooks/use-push-notifications.ts`
- Private key in `.env` file on server
- They must be a matching pair!

**Step 4: Check service logs**
```bash
docker logs -f poscal-push-sender
```

### Expired Subscriptions

**Problem:** Users not receiving notifications

The service automatically removes expired subscriptions (HTTP 410/404). Users need to:

1. Unsubscribe (bell icon)
2. Re-subscribe (bell icon again)

**Bulk cleanup:**
```sql
-- Remove all subscriptions (users will need to re-subscribe)
DELETE FROM push_subscriptions;
```

### Generate New VAPID Keys

If you lose your VAPID private key or want to rotate keys:

```bash
npx web-push generate-vapid-keys
```

**Then update:**
1. `.env` file: `VAPID_PRIVATE_KEY`
2. Frontend code: `src/hooks/use-push-notifications.ts` → `VAPID_PUBLIC_KEY`
3. Rebuild and redeploy both frontend and push service
4. All users must re-subscribe

### High Memory Usage

**Problem:** Service using more than 128MB

**Check memory:**
```bash
docker stats poscal-push-sender
```

**Solutions:**
1. Increase memory limit in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 256M
```

2. Increase poll interval to reduce frequency:
```env
POLL_INTERVAL=60000  # Check every minute instead of 30s
```

### Service Keeps Restarting

**Check restart loop:**
```bash
docker ps -a | grep poscal-push-sender
docker logs poscal-push-sender
```

**Common causes:**
- Out of memory (increase limit)
- Database connection errors (check credentials)
- Code errors (check logs for stack traces)

**Disable auto-restart temporarily to debug:**
```bash
docker update --restart=no poscal-push-sender
```

### Connection to Supabase Fails

**Problem:** Can't connect to database

**Test connection:**
```bash
# From your droplet
curl https://xxxxxxxxxxxxx.supabase.co/rest/v1/

# Should return: {"message":"The server is running"}
```

**Solutions:**
- Check Supabase project is active (not paused)
- Verify URL in `.env` is correct
- Check firewall rules allow outbound HTTPS

---

## 🔒 Security Best Practices

### 1. Protect Environment Variables

```bash
# Secure the .env file
chmod 600 /opt/poscal-push-sender/.env
chown root:root /opt/poscal-push-sender/.env
```

### 2. Use Service Role Key Safely

⚠️ **Important:** The service role key has admin access to your entire database!

- Never commit it to Git
- Never expose it in logs
- Only use it on your secure server
- Rotate it periodically in Supabase dashboard

### 3. Enable Firewall

```bash
# Enable UFW firewall
ufw enable

# Allow SSH
ufw allow 22/tcp

# Allow HTTPS (if running web server)
ufw allow 443/tcp
ufw allow 80/tcp

# Check status
ufw status
```

### 4. Keep Docker Updated

```bash
# Update Docker
apt update
apt upgrade docker-ce docker-ce-cli containerd.io
```

### 5. Monitor for Security Issues

```bash
# Check container security
docker scan poscal-push-sender

# Update base image regularly
docker-compose pull
docker-compose up -d --build
```

---

## 📈 Scaling Considerations

### Current Capacity

With default settings (30s polling, 128MB memory):

- **Users**: ~10,000 subscribers
- **Notifications**: ~50,000 per day
- **Throughput**: ~1,600 notifications per minute

### Scale Up

**For more subscribers:**

1. **Increase memory:**
```yaml
deploy:
  resources:
    limits:
      memory: 256M
```

2. **Decrease poll interval:**
```env
POLL_INTERVAL=15000  # Check every 15 seconds
```

3. **Upgrade droplet:**
- 2GB RAM droplet ($12/month)
- 4GB RAM droplet ($24/month)

**For higher throughput:**

Run multiple instances:

```yaml
services:
  poscal-push-sender-1:
    build: .
    container_name: poscal-push-sender-1
    env_file: .env

  poscal-push-sender-2:
    build: .
    container_name: poscal-push-sender-2
    env_file: .env
```

Each instance will process notifications independently.

---

## 📞 Support

### Quick Reference

**Service location:** `/opt/poscal-push-sender`

**Essential commands:**
```bash
# Status
docker ps | grep poscal-push-sender

# Logs
docker logs -f poscal-push-sender

# Restart
docker-compose restart

# Stop
docker-compose down

# Start
docker-compose up -d
```

### Getting Help

1. **Check logs first:** `docker logs poscal-push-sender`
2. **Verify configuration:** `cat .env` (be careful not to expose secrets!)
3. **Test database connection:** Check Supabase dashboard
4. **Check GitHub issues:** [Your repo issues page]

---

## ✅ Deployment Checklist

- [ ] DigitalOcean droplet created and accessible via SSH
- [ ] Docker and Docker Compose installed
- [ ] Working directory created (`/opt/poscal-push-sender`)
- [ ] Service files copied to droplet
- [ ] `.env` file created with all required credentials
- [ ] Supabase URL and service role key verified
- [ ] VAPID keys match frontend configuration
- [ ] Docker image built successfully
- [ ] Service started with `docker-compose up -d`
- [ ] Logs show successful connection to Supabase
- [ ] Test notification sent and received
- [ ] Auto-restart configured (`unless-stopped`)
- [ ] Firewall configured (if applicable)
- [ ] Monitoring/health check script created

---

**Ready to deploy? Follow the steps above and your push notifications will be running in minutes! 🚀**

**Need help?** Check the [main documentation](./README.md) or open an issue on GitHub.
