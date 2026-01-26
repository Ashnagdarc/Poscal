#!/bin/bash

# Deploy Push-Sender to VPS
# Run from your local machine: bash deploy-push-sender-vps.sh

set -e

VPS_HOST="root@62.171.136.178"
VPS_PATH="/opt/poscal/push-sender"
LOCAL_PATH="./push-sender"

echo "🚀 Deploying push-sender to VPS..."

# 1. Copy push-sender directory to VPS
echo "📦 Copying push-sender files..."
ssh "$VPS_HOST" "mkdir -p $VPS_PATH"
scp -r "$LOCAL_PATH" "$VPS_HOST:/opt/poscal/"

# 2. SSH and setup
echo "🔧 Setting up on VPS..."
ssh "$VPS_HOST" << 'ENDSSH'
cd /opt/poscal/push-sender

# Install dependencies
npm install

# Build TypeScript
npm run build

# Setup .env file (you'll need to add your API keys manually)
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  .env created from template - UPDATE WITH YOUR API KEYS:"
    echo "   - FINNHUB_API_KEY"
    echo "   - VAPID_PRIVATE_KEY"
    nano .env
fi

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

echo "✅ Deploy complete!"
echo "📋 Check logs: pm2 logs poscal-price-ingestor"
ENDSSH

echo "Done!"
