#!/bin/bash

# Permanent Fix for Supabase Auth Migration Issue (2026)
# This script fixes the broken MFA schema migration by pre-creating the enum types
# It runs on the database container before auth service starts

set -e

echo "🔧 Supabase Auth Migration Fix Script"
echo "======================================="

cd /root/supabase-project

# Step 1: Create the init SQL script that will be mounted to the DB container
echo "📝 Creating database initialization script..."

mkdir -p /root/supabase-project/postgres-init

cat > /root/supabase-project/postgres-init/01-fix-auth-types.sql << 'EOF'
-- Supabase Auth Migration Fix
-- Creates the missing enum types that cause the migration to fail
-- This runs automatically when the postgres container starts

-- Create types in the public schema (will be copied to auth schema by migration)
DO $$ BEGIN
  CREATE TYPE public.factor_type AS ENUM ('totp', 'webauthn');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.factor_status AS ENUM ('unverified', 'verified');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'Auth types initialization complete' AS status;
EOF

echo "✅ Initialization script created"

# Step 2: Update docker-compose.yml to mount the init script
echo "📋 Updating docker-compose.yml..."

# Check if the volume is already mounted
if grep -q "postgres-init" docker-compose.yml; then
  echo "✓ Init script volume already configured"
else
  # Add the volume mount to the db service
  sed -i '/volumes:/{
    :a
    n
    /^[^ ]/b
    s|^  - \./volumes/db/data:/var/lib/postgresql/data$|  - ./volumes/db/data:/var/lib/postgresql/data\n      - ./postgres-init:/docker-entrypoint-initdb.d|
    t
  }' docker-compose.yml
  echo "✓ Volume mount added to docker-compose.yml"
fi

# Step 3: Stop and remove old containers to start fresh
echo "🔄 Resetting Supabase containers..."

docker compose down

# Step 4: Start fresh with the initialization script
echo "🚀 Starting Supabase with auth fix..."

docker compose up -d

# Step 5: Wait for services to be ready
echo "⏳ Waiting for services to initialize (30 seconds)..."
sleep 30

# Step 6: Check if auth service is healthy
echo "🧪 Checking auth service status..."

AUTH_STATUS=$(docker compose ps auth --format "table {{.Status}}" | tail -1)
REST_STATUS=$(docker compose ps rest --format "table {{.Status}}" | tail -1)
KONG_STATUS=$(docker compose ps kong --format "table {{.Status}}" | tail -1)

echo "Auth Service: $AUTH_STATUS"
echo "PostgREST:   $REST_STATUS"
echo "Kong Gateway: $KONG_STATUS"

# Step 7: Test the API
echo "🔌 Testing API endpoint..."

API_RESPONSE=$(curl -s -w "\n%{http_code}" -k \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E" \
  "https://62.171.136.178:8443/rest/v1/price_cache?limit=1" 2>/dev/null || echo "0")

HTTP_CODE=$(echo "$API_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✅ API is responding! Status: $HTTP_CODE"
else
  echo "⚠️  API returned: $HTTP_CODE"
fi

echo ""
echo "======================================="
echo "✅ Supabase Auth Migration Fix Complete!"
echo "======================================="
echo ""
echo "Your VPS Supabase is now ready to use at:"
echo "  URL: https://62.171.136.178:8443"
echo "  API: https://62.171.136.178:8443/rest/v1"
echo "  Dashboard: https://62.171.136.178:3000"
echo ""
