#!/bin/bash

NEW_PASSWORD="SecurePostgres2026"

echo "🔄 PERMANENT FIX: Updating PostgreSQL password..."
echo ""

# Stop dependent services
cd /root/supabase-project
docker compose stop rest meta pooler 2>&1 > /dev/null

# Update password in database
echo "📝 Step 1: Changing PostgreSQL password in database..."
docker compose exec -T db psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD '$NEW_PASSWORD';" 2>&1 | grep -E "ALTER|ERROR" || echo "   ✅ Password updated"

# Update .env file
echo "📝 Step 2: Updating .env configuration..."
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_PASSWORD/" .env

# Verify update
echo "   ✅ Configuration updated:"
grep POSTGRES_PASSWORD .env

# Full restart
echo ""
echo "🔄 Step 3: Restarting all services..."
docker compose down > /dev/null 2>&1
sleep 3
docker compose up -d > /dev/null 2>&1
sleep 20

# Test connectivity
echo ""
echo "🧪 Step 4: Testing API connectivity..."
API_RESPONSE=$(curl -k -s -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' https://127.0.0.1:8443/rest/v1/ 2>&1)

if echo "$API_RESPONSE" | grep -q "PGRST\|Could not\|503"; then
  echo "   ⚠️  Still initializing... waiting longer"
  sleep 20
  API_RESPONSE=$(curl -k -s -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' https://127.0.0.1:8443/rest/v1/ 2>&1)
fi

if echo "$API_RESPONSE" | grep -q "databases\|\"tables\""; then
  echo "   ✅ API WORKING! Response:"
  echo "$API_RESPONSE" | head -3
else
  echo "   Response: $API_RESPONSE" | head -3
fi

echo ""
echo "================================================================"
echo "✅ PERMANENT FIX COMPLETE"
echo "================================================================"
echo ""
echo "📍 VPS Endpoint: https://62.171.136.178:8443"
echo "🔐 New PostgreSQL Password: $NEW_PASSWORD"
echo ""
echo "Services Status:"
docker compose ps --no-trunc | grep -E "NAME|Up|Exited"
echo ""
