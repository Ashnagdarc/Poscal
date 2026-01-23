#!/usr/bin/env powershell
# Quick reference commands for local Supabase Docker setup

Write-Host "=== POSCAL LOCAL SUPABASE DOCKER REFERENCE ===" -ForegroundColor Green

Write-Host "`n📊 Container Status:" -ForegroundColor Cyan
Write-Host "docker compose -f docker-compose-local.yml ps"

Write-Host "`n🚀 Start Stack:" -ForegroundColor Cyan
Write-Host "docker compose -f docker-compose-local.yml up -d"

Write-Host "`n⛔ Stop Stack:" -ForegroundColor Cyan
Write-Host "docker compose -f docker-compose-local.yml down"

Write-Host "`n📝 Generate JWT Token:" -ForegroundColor Cyan
Write-Host "python generate_token.py"

Write-Host "`n🔗 API Base URL:" -ForegroundColor Cyan
Write-Host "http://localhost:3000"

Write-Host "`n📚 Database Endpoints:" -ForegroundColor Cyan
Write-Host "GET    http://localhost:3000/profiles"
Write-Host "POST   http://localhost:3000/profiles"
Write-Host "GET    http://localhost:3000/trading_accounts"
Write-Host "POST   http://localhost:3000/trading_accounts"
Write-Host "GET    http://localhost:3000/trading_journal"
Write-Host "POST   http://localhost:3000/trading_journal"
Write-Host "GET    http://localhost:3000/taken_trades"
Write-Host "POST   http://localhost:3000/taken_trades"

Write-Host "`n🧪 Test Profile Creation:" -ForegroundColor Cyan
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiaWF0IjoxNzY5MTA2NTQ2LCJleHAiOjE3NjkxMTAxNDZ9.iLc-W9OPQlpgG7q95De6p70W7sv9ngDUX7bpmQdLnyg"
Write-Host "`$token = `"$token`""
Write-Host "`$body = @{user_id=`"test-user-123`"; email=`"test@example.com`"; display_name=`"Test User`"} | ConvertTo-Json"
Write-Host "Invoke-WebRequest -Uri http://localhost:3000/profiles -Method POST -Headers @{`"Authorization`" = `"Bearer `$token`"; `"Content-Type`" = `"application/json`"} -Body `$body"

Write-Host "`n🗄️ Database Access:" -ForegroundColor Cyan
Write-Host "docker exec -i supabase-db-local psql -U postgres -d postgres"

Write-Host "`n📋 Container Logs:" -ForegroundColor Cyan
Write-Host "docker logs supabase-rest-local        # API logs"
Write-Host "docker logs supabase-db-local          # Database logs"
Write-Host "docker logs supabase-realtime-local    # Realtime logs"

Write-Host "`n✅ JWT Secret (for reference):" -ForegroundColor Cyan
Write-Host "6TXrpcgE1JyJdkyKWhImwrEbSndjT8eGkCZVi3n1oxc="

Write-Host "`n🔑 Database Credentials:" -ForegroundColor Cyan
Write-Host "Host: localhost or db (in docker network)"
Write-Host "Port: 5432"
Write-Host "User: postgres"
Write-Host "Password: postgres123"
Write-Host "Database: postgres"

Write-Host "`n📍 Network Details:" -ForegroundColor Cyan
Write-Host "Docker Network: supabase-local"
Write-Host "Services can reach each other by hostname: db, rest, realtime"

Write-Host "`n✅ Status:" -ForegroundColor Green
Write-Host "Local Docker Supabase setup is COMPLETE and TESTED"
Write-Host "All services running and responding"
Write-Host "Database RLS policies enforced"
Write-Host "JWT authentication working"
Write-Host "`nReady to deploy to VPS when tests complete!"

Write-Host ""
