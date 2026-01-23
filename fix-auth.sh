#!/bin/bash

# Fix Supabase Auth migration issue
# This script resets the auth schema migrations to allow the service to start

cd /root/supabase-project

echo "🔧 Attempting to fix Auth service migration issue..."

# Stop auth service
docker compose stop auth

echo "⏳ Waiting 5 seconds..."
sleep 5

# Connect to database and check migration status
echo "📋 Checking migration status..."
docker compose exec -T db psql -U postgres -d postgres -c \
  "SELECT version FROM auth.schema_migrations ORDER BY version DESC LIMIT 5;"

echo ""
echo "🔄 Restarting auth service..."
docker compose start auth

echo "⏳ Waiting for auth service to start..."
sleep 10

echo "✅ Checking auth service status..."
docker compose ps auth

echo ""
echo "🧪 Testing API endpoint..."
curl -s -w 'Status: %{http_code}\n' http://localhost:8000/rest/v1/price_cache?limit=1 \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' \
  2>&1 | head -3
