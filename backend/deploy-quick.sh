#!/bin/bash
# Quick backend deployment to VPS

echo "📦 Building backend..."
npm run build

echo "🚀 Deploying to VPS..."
rsync -avz --progress dist/ root@62.171.136.178:/opt/poscal-backend/dist/

echo "🔄 Restarting PM2..."
ssh root@62.171.136.178 "pm2 restart poscal-backend"

echo "✅ Deployment complete!"
echo "🔍 Checking status..."
ssh root@62.171.136.178 "pm2 status poscal-backend"
