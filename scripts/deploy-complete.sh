#!/bin/bash

# Complete deployment script for Poscal backend
# Run this on your local machine

VPS_IP="62.171.136.178"
SSH_USER="root"
BACKEND_PATH="/opt/poscal-backend"

echo "🚀 Deploying Poscal backend to $VPS_IP..."
echo ""

# Step 1: Build locally
echo "📦 Step 1: Building backend locally..."
cd backend
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Local build failed!"
    exit 1
fi

echo "✅ Local build successful"
echo ""

# Step 2: Deploy files via SCP/rsync
echo "📤 Step 2: Uploading files to VPS..."

# Copy built files and package.json
scp -r dist/ ${SSH_USER}@${VPS_IP}:${BACKEND_PATH}/dist/
scp package.json ${SSH_USER}@${VPS_IP}:${BACKEND_PATH}/
scp package-lock.json ${SSH_USER}@${VPS_IP}:${BACKEND_PATH}/ 2>/dev/null || true

echo "✅ Files uploaded"
echo ""

# Step 3: Install and restart on VPS
echo "🔧 Step 3: Installing dependencies and restarting on VPS..."
echo ""

ssh ${SSH_USER}@${VPS_IP} << 'ENDSSH'
set -e

cd /opt/poscal-backend

echo "📦 Installing production dependencies..."
npm install --production --omit=dev

echo "✅ Dependencies installed"
echo ""

echo "🔄 Restarting PM2 process..."
# Restart PM2 app
pm2 restart poscal-backend || pm2 start dist/main.js --name poscal-backend

# Show status
pm2 status

echo ""
echo "✅ Backend restarted"

ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test the feature-flag endpoint:"
echo "   curl https://api.poscalfx.com/admin/feature-flag"
echo ""
echo "2. If all looks good, trigger Vercel rebuild:"
echo "   Push to GitHub or manually trigger Vercel deploy"
