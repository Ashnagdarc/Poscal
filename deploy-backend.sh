#!/bin/bash

# Deploy backend to Contabo VPS
# Usage: ./deploy-backend.sh

echo "🚀 Deploying backend to Contabo VPS..."

# Get VPS details
read -p "Enter VPS IP address: " VPS_IP
read -p "Enter SSH user (default: root): " SSH_USER
SSH_USER=${SSH_USER:-root}

# Build locally
echo "📦 Building backend..."
cd backend && npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"

# Create deployment package
echo "📦 Creating deployment package..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
    ./ ${SSH_USER}@${VPS_IP}:/opt/poscal-backend/

# Install dependencies and restart on VPS
echo "🔧 Installing dependencies on VPS..."
ssh ${SSH_USER}@${VPS_IP} << 'ENDSSH'
cd /opt/poscal-backend
npm install --production
npm run build

# Restart PM2 service
pm2 restart poscal-backend || pm2 start dist/main.js --name poscal-backend

echo "✅ Backend deployed and restarted"
ENDSSH

echo "🎉 Deployment complete!"
echo "Test the endpoint: curl https://api.poscalfx.com/admin/feature-flag"
