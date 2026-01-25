#!/bin/bash

# Update push-sender .env with correct SERVICE_TOKEN
cat << 'EOF' > /opt/poscal/push-sender/.env
# PosCal Push Notification Sender - Environment Variables

# ===================================
# Supabase Configuration (REQUIRED)
# ===================================
SUPABASE_URL=https://supabase.poscalfx.com
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhY2FiYXNlIiwKICAgICJhdWQiOiAiYXV0aGVudGljYXRlZCIsCiAgICAiaWF0IjogMTcwMDAwMDAwMCwKICAgICJleHAiOiAxOTAwMDAwMDAwCiAgfQ.MOCK_SERVICE_ROLE_KEY

# ===================================
# Market Data API Configuration (REQUIRED)
# ===================================
FINNHUB_API_KEY=d5q06g1r01qq2b69nvjgd5q06g1r01qq2b69nvk0

# ===================================
# VAPID Keys for Web Push (REQUIRED)
# ===================================
VAPID_PUBLIC_KEY=BE7EfMew8pPJTxly2cBT7PxInN62M2HWPB0yB-bNGwUniu0b2ouoLbEmfiQjHu5vowBcW0caNzaWpwP9mBZ0CM0
VAPID_PRIVATE_KEY=PaCGXpLpjIRr8CMRs5YrvJPkUOTw05Ngq6gcMmFBowI
VAPID_SUBJECT=mailto:info@poscalfx.com

# ===================================
# Service Configuration
# ===================================
POLL_INTERVAL=30000

# ===================================
# NestJS Backend Service Token (REQUIRED)
# ===================================
NESTJS_SERVICE_TOKEN=DV61CS5usRov82drimUncqlO4PBEWYpwjgzTy3Ik09etbKLQhXxFJNfaAHMGZ7

# ===================================
# NestJS API URL (REQUIRED)
# ===================================
NESTJS_API_URL=https://api.poscalfx.com
EOF

echo "✅ Push-sender .env updated successfully"
