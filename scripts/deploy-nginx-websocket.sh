#!/bin/bash

# Deploy WebSocket-enabled Nginx config
# Usage: ./deploy-nginx-websocket.sh

echo "🚀 Deploying WebSocket-enabled Nginx configuration..."

VPS_IP="62.171.136.178"
SSH_USER="root"

# Copy the Nginx config to VPS
echo "📋 Copying Nginx config to VPS..."
scp "$(dirname "$0")/../infra/nginx-websocket-config.conf" ${SSH_USER}@${VPS_IP}:/etc/nginx/sites-available/poscalfx.com

# SSH to VPS and reload Nginx
echo "🔧 Reloading Nginx configuration..."
ssh ${SSH_USER}@${VPS_IP} << 'ENDSSH'

# Test Nginx config syntax
echo "✓ Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Configuration is valid, reloading Nginx..."
    systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Configuration has errors, please fix them"
    exit 1
fi

# Verify Socket.IO is running
echo "✓ Checking backend status..."
pm2 status | grep poscal-backend

ENDSSH

echo "🎉 Deployment complete!"
echo "WebSocket connections should now work at: wss://api.poscalfx.com/socket.io"
