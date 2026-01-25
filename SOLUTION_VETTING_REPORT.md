# Solution Vetting Report: Push-Sender Single Instance Fix

## Executive Summary
**The proposed systemd solution is GOOD but NOT OPTIMAL for your use case.** Here's why:

---

## Issue #1: Systemd Service File Has Problems ⚠️

### Problem Found:
```ini
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/poscal/push-sender /var/log/poscal-push-sender.log
```

**Why this breaks:**
- `ProtectSystem=strict` makes `/usr/bin/`, `/usr/lib/` read-only
- But npm needs to execute files in `/opt/poscal/push-sender/node_modules/.bin/`
- This will cause: `npm: command not found` or permission denied errors
- `ReadWritePaths` doesn't grant execute permission, only read/write

### Better systemd config:
```ini
ProtectSystem=no          # Allow system write access (npm needs this)
ProtectHome=true         # Still protect home dir
# Remove PrivateTmp=true  # npm needs /tmp for caching
```

---

## Issue #2: Systemd is Overcomplicated for Your Setup ⚠️

**Your deployment:** VPS with raw Node.js, not containerized
**Better alternative:** Use **PM2** (Node.js standard)

### Why PM2 is better:
```
✅ PM2                          ✅ Systemd
1 line to start                 10 lines of config
Auto-restart on crash          Auto-restart on crash  
Built-in logs                  Journal logs (complex)
Simple process list            Complex systemctl commands
Industry standard for Node     Server admin tool
Easy to deploy via CI/CD        Requires root + systemctl
```

---

## Issue #3: Database Schema Issue Not Fully Resolved ❌

The error showed:
```
error: column notification.attempts does not exist
```

**What I did:** Tried to add column but got permission error
**What I should have done:** Actually verify it was added

**Need to confirm:**
```bash
ssh root@62.171.136.178 \
  "sudo -u postgres psql -d poscal_db -c '\d push_notification_queue' | grep attempts"
```

If missing, this will break push-sender when it queries notifications.

---

## Issue #4: Missing Backend Configuration ⚠️

The backend still needs to validate:
1. SERVICE_TOKEN matches between backend and push-sender ✓ (Done)
2. `attempts` column exists in push_notification_queue ❌ (Not confirmed)
3. Backend is actually running and responsive

---

## Issue #5: Multiple Batch Timer Creation (Already Fixed) ✅

**What was wrong:**
- `priceBatch` and batch interval were inside `connectPriceWebSocket()`
- Each reconnection created a NEW setInterval
- With 4 instances = 4 setIntervals = quadruple the batch POSTs

**Status:** Fixed in index.ts - moved to module level ✅

---

## The BETTER Solution (Recommended)

### Option A: PM2 (BEST - Simple & Industry Standard)
```bash
# Install PM2
npm install -g pm2

# Start push-sender with PM2
pm2 start /opt/poscal/push-sender/index.ts --name poscal-push-sender

# Auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 monitor  # or: pm2 logs poscal-push-sender
```

**Why better:**
- Single command instead of 40-line service file
- Better logs output
- Standard in Node.js community
- Easier to debug
- Works on any Linux distribution

### Option B: Docker (If you use containers)
```dockerfile
FROM node:18
WORKDIR /app
COPY push-sender .
RUN npm install
CMD ["npm", "start"]
```
Then manage with docker-compose or Kubernetes - avoids systemd entirely.

### Option C: Keep Systemd (If you must)
Need to fix the service file:
```ini
[Service]
Type=simple
User=root
WorkingDirectory=/opt/poscal/push-sender
EnvironmentFile=/opt/poscal/push-sender/.env
ExecStart=/usr/bin/node /opt/poscal/push-sender/dist/index.js
Restart=on-failure
RestartSec=10

# Remove: ProtectSystem=strict, ProtectHome=true, PrivateTmp=true
# These break npm execution
```

---

## Action Plan for BEST Fix (Recommended)

### Step 1: Install PM2
```bash
ssh root@62.171.136.178 "npm install -g pm2"
```

### Step 2: Kill all existing instances
```bash
ssh root@62.171.136.178 "pkill -9 npm; pkill -9 node; pkill -9 tsx; sleep 2"
```

### Step 3: Start with PM2
```bash
ssh root@62.171.136.178 "cd /opt/poscal/push-sender && pm2 start index.ts --name poscal-push-sender"
```

### Step 4: Verify only ONE instance
```bash
ssh root@62.171.136.178 "pm2 list"  # Should show 1 push-sender
ssh root@62.171.136.178 "ps aux | grep node | grep -v grep | wc -l"  # Should be 1
```

### Step 5: Setup auto-restart on reboot
```bash
ssh root@62.171.136.178 "cd /opt/poscal/push-sender && pm2 startup && pm2 save"
```

### Step 6: Fix database schema (CRITICAL)
```bash
ssh root@62.171.136.178 \
  "sudo -u postgres psql -d poscal_db -c \
   'ALTER TABLE push_notification_queue ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;'"
```

### Step 7: Test price population
```bash
# Wait 10 seconds for first batch
# Check if prices exist:
ssh root@62.171.136.178 \
  "PGPASSWORD='P0sc@l_2026_Secure!' psql -h localhost -U poscal_user -d poscal_db -c \
   'SELECT COUNT(*), COUNT(DISTINCT symbol) FROM price_cache;'"
```

### Step 8: Verify no rate limits
```bash
ssh root@62.171.136.178 "pm2 logs poscal-push-sender | grep -i '429\|rate\|limit'"
# Should show nothing (no rate limit errors)
```

---

## Summary Table

| Aspect | Systemd (Proposed) | PM2 (Recommended) |
|--------|-------------------|-----------------|
| Complexity | High (40 lines) | Low (1 command) |
| Industry Standard | System Admins | Node.js Devs |
| Error Messages | Journal logs | Console output |
| Auto-restart | ✅ Yes | ✅ Yes |
| Permission Issues | ⚠️ Yes (in my config) | ✅ No |
| Learning Curve | Steep | Flat |
| Debugging | Difficult | Easy |

---

## Critical Unresolved Issues

1. **Database `attempts` column** - MUST verify it exists
2. **Backend responsiveness** - MUST check 200 response on /health
3. **Finnhub API key** - MUST verify it's not exhausted
4. **Price population** - MUST confirm prices appear in cache

---

## Recommendation

**Use PM2 instead of systemd** because:
1. ✅ Avoids the permission issues in my systemd config
2. ✅ Much simpler to understand and debug
3. ✅ Standard for Node.js deployments
4. ✅ Better log output for troubleshooting
5. ✅ Industry best practice

Then immediately:
1. Fix database schema (add attempts column)
2. Verify prices populate
3. Check no Finnhub rate limits
4. Test with multiple users
