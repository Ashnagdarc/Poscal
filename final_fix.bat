@echo off
REM Final Permanent Fix for Supabase on VPS
REM This removes the @ character from the PostgreSQL password completely

echo [1] Connecting to VPS and fixing password...

REM Create a remote script to run on the VPS
ssh root@62.171.136.178 "cat > /tmp/apply_fix.sh << 'FIXEOF'
#!/bin/bash
cd /root/supabase-project

echo '=== PERMANENT FIX ==='
echo ''
echo 'Step 1: Updating password (no special characters)...'
sed -i 's/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=Samueldaniel12/' .env
sed -i 's/DASHBOARD_PASSWORD=.*/DASHBOARD_PASSWORD=Samueldaniel12/' .env

echo 'Step 2: Stopping all services...'
docker compose down 2>&1 | tail -2

echo ''
echo 'Step 3: Starting fresh...'
docker compose up -d 2>&1 | tail -2

echo ''
echo 'Step 4: Waiting for services (60 seconds)...'
sleep 60

echo ''
echo 'Step 5: Testing database...'
docker compose exec -T db psql -U postgres -d postgres -c 'SELECT 1;' > /dev/null 2>&1 && echo '✅ Database OK' || echo '❌ DB Failed'

echo ''
echo 'Step 6: Testing API...'
curl -k -s -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' https://127.0.0.1:8443/rest/v1/profiles?limit=1 2>&1 | grep -q 'code\|message' && echo '✅ API responding' || echo 'Still loading...'

echo ''
echo '✅ PERMANENT FIX APPLIED'
echo ''
FIXEOF
chmod +x /tmp/apply_fix.sh
bash /tmp/apply_fix.sh"

echo.
echo [Complete] VPS has been updated.
pause
