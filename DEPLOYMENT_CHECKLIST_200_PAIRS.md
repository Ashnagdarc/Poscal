# 🚀 Deployment Checklist: 200+ Pairs Expansion

## Pre-Deployment Verification ✅

### Code Quality
- [x] No syntax errors in `push-sender/index.ts`
- [x] No syntax errors in `src/components/CurrencyGrid.tsx`
- [x] No duplicate pair keys
- [x] All Finnhub mappings valid (OANDA:XXX_YYY format)
- [x] All Binance mappings valid (BINANCE:XXXUSDT format)
- [x] Pip decimal detection configured for all pair types

### File Changes
- [x] push-sender/index.ts: 788 lines (175+ pairs defined)
- [x] CurrencyGrid.tsx: 422 lines (230 pair definitions)
- [x] Documentation created:
  - [x] PAIRS_EXPANSION_200.md (comprehensive guide)
  - [x] PAIRS_EXPANSION_SUMMARY.txt (quick summary)
  - [x] DEPLOYMENT_CHECKLIST_200_PAIRS.md (this file)

---

## Deployment Steps

### Step 1: Backup Current Push-Sender
```bash
# SSH to VPS
ssh root@62.171.136.178

# Backup current push-sender
cp /opt/poscal/push-sender/index.ts /opt/poscal/push-sender/index.ts.backup.$(date +%Y%m%d_%H%M%S)

# Verify backup created
ls -la /opt/poscal/push-sender/index.ts*
```

### Step 2: Deploy New Push-Sender
```bash
# From local machine, copy updated push-sender
scp /Users/piusmolade/Documents/Development\ Server/Poscal/push-sender/index.ts root@62.171.136.178:/opt/poscal/push-sender/index.ts

# Verify file transfer
ssh root@62.171.136.178 "ls -lh /opt/poscal/push-sender/index.ts && head -20 /opt/poscal/push-sender/index.ts | grep -i symbol"
```

### Step 3: Verify Push-Sender Syntax
```bash
# SSH to VPS
ssh root@62.171.136.178

# Check if push-sender syntax is valid
cd /opt/poscal/push-sender && npx tsx index.ts --check 2>&1 | head -20

# Or just try to parse the file
node -c /opt/poscal/push-sender/index.ts 2>&1
```

### Step 4: Stop Current Push-Sender
```bash
# If running via PM2
pm2 stop push-sender
pm2 delete push-sender

# If running in screen/tmux, kill the process
pkill -f "tsx.*push-sender"
pkill -f "node.*push-sender"

# Verify it's stopped
ps aux | grep push-sender
```

### Step 5: Start New Push-Sender with 200+ Pairs
```bash
# Start with new pairs
cd /opt/poscal/push-sender

# Option A: Direct start (test mode)
npx tsx index.ts &

# Option B: With PM2 (production)
pm2 start index.ts --name push-sender --max-memory-restart 500M

# Option C: With logging
npx tsx index.ts > /var/log/push-sender.log 2>&1 &

# Verify it started
sleep 3 && tail -50 /var/log/push-sender.log | grep -E "(started|pairs|Live market data)"
```

### Step 6: Verify Finnhub WebSocket Subscriptions
```bash
# Check logs for subscription message
tail -100 /var/log/push-sender.log | grep -E "(Subscribed|subscribed|subscribe|WebSocket|pairs)"

# Should see something like:
# ✓ Live market data: 200 pairs
# ✓ Subscribed to price updates
```

---

## Testing After Deployment

### Test 1: Check Available Pairs in Cache
```bash
# Connect to database
psql postgresql://user:password@host:5432/poscal

# Count rows in price_cache
SELECT COUNT(*) as total_pairs FROM price_cache;
-- Expected: 150-200 rows (depending on Finnhub availability)

# Sample pairs
SELECT symbol, price, bid, ask, updated_at FROM price_cache 
WHERE price IS NOT NULL 
ORDER BY updated_at DESC 
LIMIT 10;
```

### Test 2: Test API Endpoints
```bash
# Test forex pair
curl -s http://localhost:3001/prices/EUR%2FUSD | jq '.'

# Test crypto pair
curl -s http://localhost:3001/prices/BTC%2FUSD | jq '.'

# Test metal pair
curl -s http://localhost:3001/prices/XAU%2FUSD | jq '.'

# Test index pair
curl -s http://localhost:3001/prices/US30 | jq '.'

# Test commodity pair
curl -s http://localhost:3001/prices/WTI%2FUSD | jq '.'
```

### Test 3: Frontend Position Calculator
1. Open application in browser
2. Navigate to Position Size Calculator
3. Click "Select Pair"
4. Scroll through ~200 available pairs
5. Select different pair types:
   - Forex: EUR/USD, USD/JPY
   - Metals: XAU/USD
   - Crypto: BTC/USD, ETH/USD
   - Indices: US30, NAS/USD
   - Commodities: WTI/USD, ZW/USD
6. Verify prices load correctly
7. Test "Add Custom Pair" feature

### Test 4: Performance Metrics
```bash
# Check push-sender metrics (every 60 seconds)
tail -300 /var/log/push-sender.log | grep -E "(notifications|prices|cache)"

# Should show metrics like:
# Notifications sent: X, failed: Y
# Prices received: Z per second
# Cache hits: >95%
```

### Test 5: Load Test (Optional)
```bash
# Simulate multiple price queries
for i in {1..100}; do
  curl -s http://localhost:3001/prices/EUR%2FUSD > /dev/null &
done
wait

# Check if all completed successfully
ps aux | grep curl | wc -l  # Should be 0 (no hanging processes)
```

---

## Monitoring

### Log Files Location
```
/var/log/push-sender.log       # Push-sender logs
/var/log/backend.log          # Backend API logs
~/.pm2/logs/push-sender.log    # If using PM2
```

### Key Logs to Watch
```bash
# Real-time logs
tail -f /var/log/push-sender.log

# Search for errors
grep -i "error\|failed\|exception" /var/log/push-sender.log

# Search for subscription info
grep -i "subscribe\|finnhub\|websocket" /var/log/push-sender.log

# Check memory usage
grep -i "memory\|cache" /var/log/push-sender.log
```

### Expected Log Output
```
🚀 Push Notification Sender started
📊 Polling for notifications every 30 seconds
✓ Live market data: 200 pairs
💾 Cache system: enabled (subscriptions, prices, VAPID keys)
🔗 Backend: http://localhost:3001

📊 Metrics (60s):
   Notifications: sent=850, failed=2
   Prices: received=12000, batched=200
   Cache: hits=98.5%, subscriptions=5000
```

---

## Rollback Plan (If Issues Occur)

### Quick Rollback
```bash
# Stop current push-sender
pm2 stop push-sender
pkill -f "tsx.*push-sender"

# Restore backup
cp /opt/poscal/push-sender/index.ts.backup.* /opt/poscal/push-sender/index.ts

# Restart with previous version
cd /opt/poscal/push-sender && npx tsx index.ts &

# Verify
tail -50 /var/log/push-sender.log | grep "pairs"
# Should show: ✓ Live market data: 65 pairs
```

### Database Rollback
```bash
# Prices are automatically updated, no data loss
# Simply restarting with old version will use 65 pairs
# New pairs in price_cache will remain but won't be updated

# Optional: Delete prices for new pairs
DELETE FROM price_cache WHERE symbol NOT IN (
  'EUR/USD', 'GBP/USD', ... (original 65 pairs)
);
```

---

## Success Criteria

✅ **Deployment Successful When:**
1. Push-sender starts without errors
2. Logs show: `✓ Live market data: 200 pairs`
3. GET /prices/:symbol returns data for all available pairs
4. Position calculator shows 200+ pair options
5. Frontend loads prices without delays
6. Database price_cache has 150-200 rows with recent updates
7. No error spikes in logs
8. Memory usage stable (~50-100MB)
9. CPU usage minimal (<5%)
10. Cache hit rate >95%

❌ **Issues to Investigate If:**
1. Push-sender crashes on startup
2. WebSocket connection fails
3. Fewer than 150 pairs in price_cache
4. API queries timeout or error
5. Frontend hangs when loading pairs
6. Memory increases continuously
7. Database queries slow (>100ms)

---

## Support Commands

### Check Push-Sender Status
```bash
# PM2 status
pm2 status

# Check if running
ps aux | grep "tsx.*push-sender"
ps aux | grep "node.*index"

# Check port listening
netstat -tlnp | grep 3001
lsof -i :3001
```

### Restart Push-Sender
```bash
# With PM2
pm2 restart push-sender

# Without PM2
pkill -f "tsx.*push-sender"
sleep 2
cd /opt/poscal/push-sender && nohup npx tsx index.ts > /var/log/push-sender.log 2>&1 &
```

### View Real-Time Metrics
```bash
# Show last 10 metric logs
tail -50 /var/log/push-sender.log | grep "Metrics\|notifications\|Prices"

# Monitor live
watch -n 5 'tail -5 /var/log/push-sender.log'
```

### Database Queries
```bash
# Count total pairs
psql -U postgres -d poscal -c "SELECT COUNT(*) FROM price_cache;"

# List all pairs with prices
psql -U postgres -d poscal -c "SELECT symbol, price FROM price_cache WHERE price IS NOT NULL ORDER BY symbol;"

# Find latest updates
psql -U postgres -d poscal -c "SELECT symbol, price, updated_at FROM price_cache ORDER BY updated_at DESC LIMIT 20;"

# Count by category
psql -U postgres -d poscal -c "SELECT 
  CASE 
    WHEN symbol LIKE '%/USD' AND symbol NOT LIKE 'BTC%' AND symbol NOT LIKE 'ETH%' THEN 'Forex'
    WHEN symbol LIKE 'BTC/%' OR symbol LIKE 'ETH/%' THEN 'Crypto'
    WHEN symbol LIKE 'XA%' OR symbol LIKE 'XS%' THEN 'Metals'
    ELSE 'Other'
  END as category,
  COUNT(*) as count
FROM price_cache
GROUP BY category;"
```

---

## Estimated Downtime

- **Deployment time**: 5-10 minutes
- **Testing time**: 5-15 minutes
- **Total estimated**: 10-25 minutes
- **Service interruption**: ~2 minutes (during restart)

---

## Documentation Updated

✅ All documentation files created and updated:
- `PAIRS_EXPANSION_200.md` - Comprehensive expansion guide
- `PAIRS_EXPANSION_SUMMARY.txt` - Quick reference
- `DEPLOYMENT_CHECKLIST_200_PAIRS.md` - This deployment guide
- Original docs still valid: `LIVE_MARKET_DATA_SUMMARY.md`, `MARKET_DATA_CACHE_OPTIMIZATION.md`

---

## Questions?

If deployment issues occur:
1. Check logs: `tail -100 /var/log/push-sender.log`
2. Verify syntax: `node -c /opt/poscal/push-sender/index.ts`
3. Test database: `psql -U postgres -d poscal -c "SELECT COUNT(*) FROM price_cache;"`
4. Check Finnhub connection: Look for WebSocket errors in logs
5. Rollback if needed using steps above

---

**Last Updated**: 2026-01-23
**Version**: 200+ Pairs Expansion
**Status**: Ready for Deployment ✅
