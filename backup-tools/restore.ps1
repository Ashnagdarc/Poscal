# Supabase Database Restore Script (PowerShell)
# This script restores a backup to a Supabase database

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile
)

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

$backupDir = Join-Path $PSScriptRoot "backups"

# If no backup file specified, show available backups
if (-not $BackupFile) {
    Write-Host "[i] Available backups:" -ForegroundColor Cyan
    Write-Host ""
    
    # Search all subdirectories for backups
    $backups = Get-ChildItem -Path $backupDir -Filter "*.sql" -Recurse | Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Host "[ERROR] No backups found in $backupDir" -ForegroundColor Red
        exit 1
    }
    
    for ($i = 0; $i -lt $backups.Count; $i++) {
        $backup = $backups[$i]
        $size = [math]::Round($backup.Length / 1MB, 2)
        $relativePath = $backup.FullName.Replace("$backupDir\", "")
        Write-Host "[$i] $relativePath - $size MB - $($backup.LastWriteTime)" -ForegroundColor Gray
    }
    
    Write-Host ""
    $selection = Read-Host "Enter backup number to restore (or 'q' to quit)"
    
    if ($selection -eq 'q') {
        exit 0
    }
    
    $BackupFile = $backups[[int]$selection].FullName
}

# Check if backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "[ERROR] Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[WARNING] This will restore the database and may overwrite existing data!" -ForegroundColor Yellow
Write-Host "[i] Backup file: $BackupFile" -ForegroundColor Gray
Write-Host ""
$confirm = Read-Host "Are you sure you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "[CANCELLED] Restore cancelled" -ForegroundColor Red
    exit 0
}

# Check for database URL
$dbUrl = $env:SUPABASE_DB_URL
if (-not $dbUrl) {
    Write-Host "[ERROR] SUPABASE_DB_URL not found in .env file" -ForegroundColor Red
    Write-Host "[TIP] You can also set RESTORE_DB_URL to restore to a different database" -ForegroundColor Yellow
    exit 1
}

# Use RESTORE_DB_URL if provided (for restoring to a different database)
if ($env:RESTORE_DB_URL) {
    $dbUrl = $env:RESTORE_DB_URL
    Write-Host "[*] Restoring to alternate database..." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "[*] Starting database restore..." -ForegroundColor Cyan

# Get just the filename for docker volume mount
$backupFileName = Split-Path $BackupFile -Leaf

# Restore the backup
docker-compose run --rm backup psql $dbUrl -f /backups/$backupFileName

Write-Host ""
Write-Host "[SUCCESS] Restore completed successfully!" -ForegroundColor Green
Write-Host "[DONE] Restore process completed!" -ForegroundColor Green
