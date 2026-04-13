#!/bin/bash
# PosCal Push-Sender Deployment Script for Contabo VPS
# Run as: ssh root@62.171.136.178 "bash -s" < deploy-push-sender.sh

set -e

echo "🚀 PosCal Push-Sender Deployment"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_PATH="/opt/poscal"
BACKEND_PORT=3000
SERVICE_TOKEN_LENGTH=32

echo -e "${YELLOW}Step 1: Generating Service Token${NC}"
SERVICE_TOKEN=$(openssl rand -hex $SERVICE_TOKEN_LENGTH)
echo -e "${GREEN}✓ Generated token: ${SERVICE_TOKEN}${NC}"
echo ""

echo -e "${YELLOW}Step 2: Updating Backend Environment${NC}"
if [ -f "$REPO_PATH/backend/.env" ]; then
  # Check if SERVICE_TOKEN already exists
  if grep -q "SERVICE_TOKEN=" "$REPO_PATH/backend/.env"; then
    echo "Updating existing SERVICE_TOKEN..."
    sed -i "/SERVICE_TOKEN=/d" "$REPO_PATH/backend/.env"
  fi
  echo "SERVICE_TOKEN=$SERVICE_TOKEN" >> "$REPO_PATH/backend/.env"
  echo -e "${GREEN}✓ Service token added to backend/.env${NC}"
else
  echo -e "${RED}✗ Backend .env not found at $REPO_PATH/backend/.env${NC}"
  exit 1
fi
echo ""

echo -e "${YELLOW}Step 3: Rebuilding Backend${NC}"
cd "$REPO_PATH/backend"
npm run build 2>&1 | tail -5
echo -e "${GREEN}✓ Backend built${NC}"
echo ""

echo -e "${YELLOW}Step 4: Restarting Backend Service${NC}"
if command -v pm2 &> /dev/null; then
  pm2 restart poscal-backend || pm2 start "npm run start:prod" --name poscal-backend --cwd "$REPO_PATH/backend"
  echo -e "${GREEN}✓ Backend restarted via pm2${NC}"
else
  echo -e "${YELLOW}⚠ pm2 not found, install with: npm install -g pm2${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5: Setting up Push-Sender${NC}"
if [ -d "$REPO_PATH/push-sender" ]; then
  cd "$REPO_PATH/push-sender"
  echo -e "${GREEN}✓ Push-sender directory found${NC}"
else
  echo -e "${RED}✗ Push-sender not found at $REPO_PATH/push-sender${NC}"
  exit 1
fi
echo ""

echo -e "${YELLOW}Step 6: Creating Push-Sender .env${NC}"
if [ -f "$REPO_PATH/push-sender/.env" ]; then
  echo "Backing up existing .env..."
  mv "$REPO_PATH/push-sender/.env" "$REPO_PATH/push-sender/.env.backup.$(date +%s)"
fi

# Create .env from template or create new
if [ -f "$REPO_PATH/push-sender/.env.example" ]; then
  cp "$REPO_PATH/push-sender/.env.example" "$REPO_PATH/push-sender/.env"
else
  # Create from scratch
  cat > "$REPO_PATH/push-sender/.env" << EOF
# NestJS Backend Configuration
NESTJS_API_URL=http://localhost:$BACKEND_PORT
NESTJS_SERVICE_TOKEN=$SERVICE_TOKEN

# Market Data API (get free key from https://finnhub.io/register)
FINNHUB_API_KEY=

# VAPID Keys (same as frontend)
VAPID_PUBLIC_KEY=BE7EfMew8pPJTxly2cBT7PxInN62M2HWPB0yB-bNGwUniu0b2ouoLbEmfiQjHu5vowBcW0caNzaWpwP9mBZ0CM0
VAPID_PRIVATE_KEY=

# Service Configuration
VAPID_SUBJECT=mailto:info@poscalfx.com
POLL_INTERVAL=30000
BATCH_INTERVAL=1000
EOF
fi

# Update .env with service token
sed -i "s|NESTJS_SERVICE_TOKEN=.*|NESTJS_SERVICE_TOKEN=$SERVICE_TOKEN|" "$REPO_PATH/push-sender/.env"
sed -i "s|NESTJS_API_URL=.*|NESTJS_API_URL=http://localhost:$BACKEND_PORT|" "$REPO_PATH/push-sender/.env"

echo -e "${GREEN}✓ Push-sender .env created/updated${NC}"
echo -e "${YELLOW}  ⚠ IMPORTANT: Add these to $REPO_PATH/push-sender/.env:${NC}"
echo -e "${YELLOW}     - FINNHUB_API_KEY (from https://finnhub.io)${NC}"
echo -e "${YELLOW}     - VAPID_PRIVATE_KEY (your existing key)${NC}"
echo ""

echo -e "${YELLOW}Step 7: Installing Push-Sender Dependencies${NC}"
cd "$REPO_PATH/push-sender"
npm install 2>&1 | tail -5
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 8: Building Push-Sender${NC}"
npm run build 2>&1 | tail -5
echo -e "${GREEN}✓ Push-sender built${NC}"
echo ""

echo -e "${YELLOW}Step 9: Starting Push-Sender with pm2${NC}"
if command -v pm2 &> /dev/null; then
  pm2 delete poscal-push-sender 2>/dev/null || true
  pm2 start "npm run start" --name poscal-push-sender --cwd "$REPO_PATH/push-sender" --watch dist
  pm2 save
  echo -e "${GREEN}✓ Push-sender started with pm2${NC}"
  echo ""
  echo -e "${YELLOW}View logs with:${NC}"
  echo "  pm2 logs poscal-push-sender"
else
  echo -e "${RED}✗ pm2 not found. Install with: npm install -g pm2${NC}"
fi
echo ""

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${YELLOW}Service Token (save this securely):${NC}"
echo -e "${GREEN}$SERVICE_TOKEN${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Edit $REPO_PATH/push-sender/.env and add:"
echo "   - FINNHUB_API_KEY"
echo "   - VAPID_PRIVATE_KEY"
echo ""
echo "2. Verify services:"
echo "   curl -H 'X-Service-Token: $SERVICE_TOKEN' http://localhost:$BACKEND_PORT/health"
echo "   curl -H 'X-Service-Token: $SERVICE_TOKEN' http://localhost:$BACKEND_PORT/notifications/push/pending"
echo ""
echo "3. Check logs:"
echo "   pm2 logs poscal-backend"
echo "   pm2 logs poscal-push-sender"
echo ""
echo "4. Test: Queue a notification and watch push-sender logs for 'Processing …'"
