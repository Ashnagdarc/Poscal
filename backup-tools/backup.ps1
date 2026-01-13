# Supabase Database Backup Script (PowerShell)
# This script creates a full backup of your Supabase database

$ErrorActionPreference = "Stop"

# Load environment variables from .env file
$envFile = Join-Path $PSScriptRoot "..\\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

# Configuration
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$year = Get-Date -Format "yyyy"
$month = Get-Date -Format "MM"

# Organize backups by year/month
$backupDir = Join-Path $PSScriptRoot "backups\$year\$month"
$backupFile = Join-Path $backupDir "backup_$timestamp.sql"
$backupDataOnly = Join-Path $backupDir "backup_data_only_$timestamp.sql"

# Create backup directory if it doesn't exist
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

Write-Host "[*] Starting database backup..." -ForegroundColor Cyan
Write-Host "[i] Timestamp: $timestamp" -ForegroundColor Gray

# Check for database URL
$dbUrl = $env:SUPABASE_DB_URL
if (-not $dbUrl) {
    Write-Host "[ERROR] SUPABASE_DB_URL not found in .env file" -ForegroundColor Red
    exit 1
}

# Full backup (schema + data)
Write-Host "[+] Creating full backup..." -ForegroundColor Yellow
docker-compose run --rm backup pg_dump $dbUrl `
    --clean `
    --if-exists `
    --quote-all-identifiers `
    --no-owner `
    --no-acl `
    -f /backups/backup_$timestamp.sql

# Data-only backup
Write-Host "[+] Creating data-only backup..." -ForegroundColor Yellow
docker-compose run --rm backup pg_dump $dbUrl `
    --data-only `
    --quote-all-identifiers `
    --no-owner `
    --no-acl `
    -f /backups/backup_data_only_$timestamp.sql

Write-Host "[SUCCESS] Backup completed successfully!" -ForegroundColor Green
Write-Host "[i] Full backup: $backupFile" -ForegroundColor Gray
Write-Host "[i] Data-only backup: $backupDataOnly" -ForegroundColor Gray

# Optional: Keep only last 20 backups in current month folder
$backups = Get-ChildItem -Path $backupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending
if ($backups.Count -gt 20) {
    Write-Host "[*] Cleaning old backups in this month (keeping last 20)..." -ForegroundColor Yellow
    $backups | Select-Object -Skip 20 | Remove-Item -Force
}

# Show folder organization
$rootBackupDir = Join-Path $PSScriptRoot "backups"
$totalBackups = (Get-ChildItem -Path $rootBackupDir -Filter "*.sql" -Recurse).Count
Write-Host "[i] Total backups: $totalBackups" -ForegroundColor Gray
Write-Host "[i] Organized in: backups\$year\$month\" -ForegroundColor Gray

Write-Host "[DONE] Backup process completed!" -ForegroundColor Green
