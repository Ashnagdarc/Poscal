#!/bin/bash

# Install Push-Sender as systemd service
# This ensures only ONE instance runs and handles restarts automatically

set -e

echo "📦 Installing PosCal Push-Sender as systemd service..."

# Copy service file
sudo cp /opt/poscal/poscal-push-sender.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Kill any existing push-sender processes
echo "🛑 Stopping any existing push-sender instances..."
pkill -9 npm || true
pkill -9 tsx || true
pkill -9 "node.*push-sender" || true
sleep 2

# Clear old screen sessions
screen -ls | grep poscal_push | awk -F'.' '{print $1}' | xargs -r screen -X -S quit || true

# Enable and start the service
echo "✅ Enabling push-sender service..."
sudo systemctl enable poscal-push-sender

echo "🚀 Starting push-sender service..."
sudo systemctl start poscal-push-sender

# Wait for startup
sleep 3

# Check status
echo ""
echo "📊 Service Status:"
sudo systemctl status poscal-push-sender --no-pager

# Verify only one instance is running
echo ""
echo "🔍 Checking process count..."
PROCESS_COUNT=$(pgrep -f "npm.*start" | wc -l || echo "0")
if [ "$PROCESS_COUNT" -eq 1 ]; then
    echo "✅ Exactly 1 push-sender instance running (correct!)"
else
    echo "⚠️  WARNING: Found $PROCESS_COUNT instances (should be 1)"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status poscal-push-sender    # Check status"
echo "  sudo journalctl -u poscal-push-sender -f    # Watch logs"
echo "  sudo systemctl restart poscal-push-sender   # Restart service"
echo "  sudo systemctl stop poscal-push-sender      # Stop service"
