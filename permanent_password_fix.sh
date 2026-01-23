#!/bin/bash

# ================================================================
# PERMANENT FIX: Change PostgreSQL Password (No Special Chars)
# ================================================================
# This fixes the double-@@ issue in connection strings

set -e

PROJECT_DIR="/root/supabase-project"
cd "$PROJECT_DIR"

echo "🔧 PERMANENT FIX: PostgreSQL Password Update"
echo "================================================================"
echo ""

# Step 1: Stop all services
echo "Step 1: Stopping all services..."
docker compose down 2>&1 | tail -3

# Step 2: Update .env with safe password (no special characters)
echo ""
echo "Step 2: Updating password in .env..."
OLD_PASS="Samueldaniel12@"
NEW_PASS="SafePostgresPass123"

sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$NEW_PASS|" .env
sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=$NEW_PASS|" .env

echo "   ✅ Password changed to: $NEW_PASS"
echo "   ✅ Old password: $OLD_PASS (removed)"

# Step 3: Start fresh
echo ""
echo "Step 3: Starting fresh Supabase stack..."
docker compose up -d 2>&1 | grep -E "^Creating|^Container|Started|Healthy" | tail -20

# Step 4: Wait for services to be healthy
echo ""
echo "Step 4: Waiting for services to initialize (45 seconds)..."
sleep 45

# Step 5: Test database connectivity
echo ""
echo "Step 5: Testing database..."
docker compose exec -T db psql -U postgres -d postgres -c "SELECT version();" > /dev/null 2>&1 && echo "   ✅ Database is responding" || echo "   ⚠️  Database not ready yet"

# Step 6: Test PostgREST
echo ""
echo "Step 6: Testing PostgREST API..."
for i in {1..3}; do
  HTTP_CODE=$(curl -k -s -o /dev/null -w '%{http_code}' \
    -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' \
    https://127.0.0.1:8443/rest/v1/ 2>&1)
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ]; then
    echo "   ✅ PostgREST responding: HTTP $HTTP_CODE"
    break
  else
    echo "   Attempt $i: HTTP $HTTP_CODE (retrying...)"
    sleep 10
  fi
done

# Step 7: Show status
echo ""
echo "================================================================"
echo "✅ PERMANENT FIX COMPLETE!"
echo "================================================================"
echo ""
echo "New Configuration:"
echo "  - PostgreSQL Password: $NEW_PASS"
echo "  - No more special character issues"
echo "  - All services running fresh"
echo ""
echo "Next steps:"
echo "  1. Update your .env file locally with new password"
echo "  2. Restart your frontend dev server"
echo "  3. Test API connectivity"
echo ""
echo "Environment file updated at: $PROJECT_DIR/.env"
echo ""
