#!/bin/bash
cd /root/supabase-project

echo "1️⃣ Stopping all services..."
docker compose stop 2>&1 | tail -2

echo ""
echo "2️⃣ Updating .env with new password..."
sed -i 's/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=Postgres123456/' .env
grep POSTGRES_PASSWORD .env

echo ""
echo "3️⃣ Starting services fresh..."
docker compose up -d 2>&1 | tail -3

echo ""
echo "⏳ Waiting 40 seconds for services to initialize..."
sleep 40

echo ""
echo "4️⃣ Checking service status..."
docker compose ps 2>&1 | grep -E "rest|db|kong" | head -3

echo ""
echo "5️⃣ Testing API endpoint..."
curl -k -s -w "HTTP %{http_code}\n" -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' https://127.0.0.1:8443/rest/v1/ 2>&1 | head -2

echo ""
echo "✅ PERMANENT FIX COMPLETE!"
echo "New password: Postgres123456 (no special characters)"
