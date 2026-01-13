#!/bin/bash

# Supabase Database Backup Script
# This script creates a full backup of your Supabase database

set -e

# Load environment variables
if [ -f ../.env ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
BACKUP_DATA_ONLY="$BACKUP_DIR/backup_data_only_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "🔄 Starting database backup..."
echo "📅 Timestamp: $TIMESTAMP"

# Extract connection details from Supabase URL
# Format: postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Error: SUPABASE_DB_URL not found in .env file"
    exit 1
fi

# Full backup (schema + data)
echo "📦 Creating full backup..."
docker-compose run --rm backup pg_dump "$SUPABASE_DB_URL" \
    --clean \
    --if-exists \
    --quote-all-identifiers \
    --no-owner \
    --no-acl \
    -f /backups/backup_$TIMESTAMP.sql

# Data-only backup (for faster restores during development)
echo "📊 Creating data-only backup..."
docker-compose run --rm backup pg_dump "$SUPABASE_DB_URL" \
    --data-only \
    --quote-all-identifiers \
    --no-owner \
    --no-acl \
    -f /backups/backup_data_only_$TIMESTAMP.sql

# Compress backups
echo "🗜️  Compressing backups..."
gzip -f "$BACKUP_FILE"
gzip -f "$BACKUP_DATA_ONLY"

echo "✅ Backup completed successfully!"
echo "📁 Full backup: $BACKUP_FILE.gz"
echo "📁 Data-only backup: $BACKUP_DATA_ONLY.gz"

# Optional: Keep only last 10 backups
BACKUP_COUNT=$(ls -1 $BACKUP_DIR/*.gz 2>/dev/null | wc -l)
if [ $BACKUP_COUNT -gt 20 ]; then
    echo "🧹 Cleaning old backups (keeping last 20)..."
    ls -t $BACKUP_DIR/*.gz | tail -n +21 | xargs rm -f
fi

echo "✨ Done!"
