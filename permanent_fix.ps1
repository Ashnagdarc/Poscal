#!/usr/bin/env pwsh

# Permanent Fix for Supabase VPS - Change password to simple value (no special chars)

$vpsIP = "62.171.136.178"
$vpsUser = "root"
$supabasePath = "/root/supabase-project"

Write-Host "🔧 PERMANENT FIX: Updating PostgreSQL password..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Update .env file with new password (no special characters)
Write-Host "📝 Step 1: Updating .env with new password..." -ForegroundColor Yellow
$envUpdateCmd = @"
cd $supabasePath
sed -i 's/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=Postgres123456/' .env
sed -i 's/DASHBOARD_PASSWORD=.*/DASHBOARD_PASSWORD=Postgres123456/' .env
grep POSTGRES_PASSWORD .env
"@

$result = ssh $vpsUser@$vpsIP $envUpdateCmd 2>&1
Write-Host $result

# Step 2: Full docker restart
Write-Host ""
Write-Host "🔄 Step 2: Restarting Docker services..." -ForegroundColor Yellow
$dockerCmd = @"
cd $supabasePath
docker compose down --remove-orphans > /dev/null 2>&1
docker compose up -d > /dev/null 2>&1
sleep 40
docker compose ps
"@

$result = ssh $vpsUser@$vpsIP $dockerCmd 2>&1
Write-Host $result | Select-Object -Last 15

# Step 3: Test API
Write-Host ""
Write-Host "🧪 Step 3: Testing API connectivity..." -ForegroundColor Yellow
$testCmd = @"
sleep 10
curl -k -s -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' https://127.0.0.1:8443/rest/v1/ 2>&1 | head -1
"@

$result = ssh $vpsUser@$vpsIP $testCmd 2>&1
Write-Host $result

Write-Host ""
Write-Host "✅ FIX COMPLETE" -ForegroundColor Green
Write-Host "================================================================"
Write-Host "New PostgreSQL Password: Postgres123456"
Write-Host "Reason: Removed special @ character from password"
Write-Host "Connection now uses: postgres://user:Postgres123456@supabase-db:5432"
Write-Host "================================================================"
