#!/bin/bash
cd /root/supabase-project
docker exec supabase-db psql -U postgres -d postgres -c "ALTER ROLE postgres WITH PASSWORD 'SecurePostgres2026';"
grep POSTGRES_PASSWORD .env
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=SecurePostgres2026/" .env
docker compose restart rest meta
sleep 20
curl -k -s -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxOTU3MzQ1MjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OG2T9FtRO2BRBNW8SBd5E' https://127.0.0.1:8443/rest/v1/profiles?limit=1 2>&1 | head -10
