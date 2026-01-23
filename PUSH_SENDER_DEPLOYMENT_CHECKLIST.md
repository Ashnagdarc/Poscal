# Push-Sender Deployment Checklist for Contabo VPS

## 📋 Prerequisites Checklist
- [ ] SSH access to VPS (root@62.171.136.178)
- [ ] Backend running and accessible on localhost:3000
- [ ] PostgreSQL database set up with tables
- [ ] Node.js and npm installed on VPS
- [ ] pm2 installed globally: `npm install -g pm2`
- [ ] Finnhub API key (free from https://finnhub.io/register)
- [ ] VAPID private key (from existing frontend setup)

---

## 🚀 Step 1: Generate Service Token & Update Backend (5 min)

Run these commands on your VPS:

```bash
# 1. Generate a strong service token
SERVICE_TOKEN=$(openssl rand -hex 32)
echo "Your Service Token: $SERVICE_TOKEN"

# 2. Add to backend .env
echo "" >> /opt/poscal/backend/.env
echo "SERVICE_TOKEN=$SERVICE_TOKEN" >> /opt/poscal/backend/.env

# 3. Rebuild backend
cd /opt/poscal/backend
npm run build

# 4. Restart backend
pm2 restart poscal-backend
# or if using npm directly: npm run start:prod

# 5. Verify backend started
sleep 3
curl http://localhost:3000/health
```

**Expected output:** `{"status":"ok",...}`

---

## 🔧 Step 2: Configure Push-Sender Environment (5 min)

```bash
# 1. Navigate to push-sender
cd /opt/poscal/push-sender

# 2. Create .env from template
cp .env.example .env

# 3. Edit .env with your values
nano .env
# Or use sed to auto-update:
sed -i "s|NESTJS_SERVICE_TOKEN=.*|NESTJS_SERVICE_TOKEN=$SERVICE_TOKEN|" .env
sed -i "s|NESTJS_API_URL=.*|NESTJS_API_URL=http://localhost:3000|" .env

# 4. Verify these fields are filled in .env:
grep -E "FINNHUB_API_KEY|VAPID_PRIVATE_KEY" .env
```

**Important:** Edit manually and add:
- `FINNHUB_API_KEY=<your-key-from-finnhub.io>`
- `VAPID_PRIVATE_KEY=<your-existing-key>`

---

## 📦 Step 3: Install & Build (10 min)

```bash
# 1. Install dependencies
cd /opt/poscal/push-sender
npm install

# 2. Build TypeScript
npm run build

# 3. Verify build succeeded
ls -la dist/
```

---

## ▶️ Step 4: Start with pm2 (2 min)

```bash
# 1. Start push-sender
pm2 start "npm run start" --name poscal-push-sender --cwd /opt/poscal/push-sender

# 2. Save pm2 config (auto-restart on reboot)
pm2 save
pm2 startup

# 3. Verify it's running
pm2 status
```

**Expected output:** poscal-push-sender should show "online"

---

## ✅ Step 5: Verification Tests (5 min)

```bash
# 1. Test backend service token auth
curl -H "X-Service-Token: $SERVICE_TOKEN" http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"...","version":"1.0.0"}

# 2. Test pending notifications endpoint
curl -H "X-Service-Token: $SERVICE_TOKEN" http://localhost:3000/notifications/push/pending
# Expected: [] or array of notifications

# 3. Test price cache endpoint
curl -H "X-Service-Token: $SERVICE_TOKEN" http://localhost:3000/prices
# Expected: [] or array of prices

# 4. Watch push-sender logs (keep running)
pm2 logs poscal-push-sender --lines 50
```

Leave logs running and in another terminal:

---

## 🧪 Step 6: End-to-End Test (5 min)

```bash
# In another terminal, queue a test notification
curl -X POST \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "title": "Test Notification",
    "body": "This is a test from deployment",
    "icon": "/icon.png"
  }' \
  http://localhost:3000/notifications/push

# In the logs terminal, watch for:
# "📬 Processing 1 notification(s)..."
# "✅ Notification "Test Notification": X sent, 0 failed"
```

---

## 📊 Monitoring & Logs

```bash
# View all services
pm2 status

# Backend logs
pm2 logs poscal-backend

# Push-sender logs
pm2 logs poscal-push-sender

# Restart if needed
pm2 restart poscal-push-sender
pm2 restart poscal-backend

# Stop/start
pm2 stop poscal-push-sender
pm2 start poscal-push-sender
```

---

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| "NESTJS_SERVICE_TOKEN not configured" | Check backend .env has SERVICE_TOKEN, rebuild + restart |
| "Cannot connect to localhost:3000" | Verify backend is running: `pm2 status` or `curl http://localhost:3000/health` |
| "Invalid service token" | Ensure push-sender .env has same token as backend |
| "No subscriptions found" | Normal if no browser has subscribed yet; test with queue endpoint |
| "FINNHUB_API_KEY not set" | Optional (prices won't update), but add it for full features |
| Push-sender crashes on start | Check logs: `pm2 logs poscal-push-sender --err` |

---

## 🔐 Security Notes

- **SERVICE_TOKEN:** Keep it secret, same on backend + push-sender .env
- **VAPID_PRIVATE_KEY:** Never commit to git, only in .env (already excluded)
- **FINNHUB_API_KEY:** Free tier is unlimited; rotate if exposed
- **pm2 startup:** Auto-restarts services on VPS reboot

---

## ✨ Summary

| Component | Status | Port | Command |
|-----------|--------|------|---------|
| Backend | Running | 3000 | `pm2 logs poscal-backend` |
| Push-Sender | Running | N/A | `pm2 logs poscal-push-sender` |
| PostgreSQL | Running | 5432 | Native process |
| Finnhub WS | Streaming | - | Check logs for "Connected to Finnhub" |

Once all ✅ show green, your system is live and ready for notifications + real-time prices!
