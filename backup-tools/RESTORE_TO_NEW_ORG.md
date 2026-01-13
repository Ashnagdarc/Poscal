# Restore Poscal FX to New Supabase Organization

This guide walks you through moving your entire Poscal FX database to a new Supabase organization if you lose access to your current one.

## Quick Summary

✅ **Everything you need is already backed up:**
- Database (schema + all data) ✓
- Code (in Git) ✓
- Migrations (in Git) ✓
- Edge Functions (in Git) ✓

**Storage files (images) are optional** - they can be re-uploaded if needed.

## Prerequisites

- Your database backup file (`backup_*.sql` from `backup-tools/backups/`)
- Your Git repository (already has code, migrations, edge functions)
- Docker Desktop running (for restoring database)

## Step 1: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in to a new organization
3. Click **"New Project"**
4. Fill in:
   - **Project Name**: e.g., "Poscal FX v2"
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose same region as before (eu-west-1 recommended)
5. Wait for database to initialize (5-10 minutes)

## Step 2: Get New Project Credentials

1. Go to **Project Settings** → **API**
2. Copy and save:
   - **Project URL** (copy full URL)
   - **anon key** (public key)
   - **service_role key** (secret key)
3. Go to **Project Settings** → **Database**
4. Copy the **Connection string (URI format)**
   - Replace `[YOUR-PASSWORD]` with the password you created
   - URL-encode special characters in password (e.g., `@` → `%40`)

## Step 3: Restore Database

### Option A: Using Backup File (Recommended)

1. Navigate to backup-tools folder:
```powershell
cd backup-tools
```

2. List available backups:
```powershell
# List available backups
Get-ChildItem backups/

# Example output:
# backup_20260113_154127.sql
# backup_data_only_20260113_154127.sql
```

3. Restore using Docker:
```powershell
$newDbUrl = "postgresql://postgres:YOUR_NEW_PASSWORD@db.NEW_PROJECT_ID.supabase.co:5432/postgres"

# Use the latest backup file (replace with actual filename)
docker-compose run --rm backup psql $newDbUrl -f /backups/backup_20260113_154127.sql
```

### Option B: Using Supabase CLI + Migrations

1. Link CLI to new project:
```bash
supabase link --project-ref [NEW_PROJECT_ID]
```

2. Apply all migrations:
```bash
supabase db push
```

3. If you want to use the backup file instead:
```bash
psql [NEW_DB_CONNECTION_STRING] < backup_20260113_154127.sql
```

## Step 4: Deploy Edge Functions

1. From project root:
```bash
supabase functions deploy
```

This uploads all functions from `supabase/functions/` to the new project.

## Step 5: Update Environment Variables

1. Update `.env` file with new credentials:
```env
VITE_SUPABASE_URL=https://[NEW_PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=[NEW_ANON_KEY]
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[NEW_PROJECT_ID].supabase.co:5432/postgres
```

2. Update `.env.production` if you have one

3. Update any backend `.env` files (e.g., `push-sender/.env`)

## Step 6: Restore Storage Buckets (OPTIONAL)

**Storage is NOT required to restore your database.** If you don't have storage backups, you can:
- Skip this step and re-upload images later
- Or continue if you have backed-up files

### Option A: Using Supabase CLI (No Installation Needed)

Use `npx` - no installation required:

```powershell
# Create buckets in new project
npx supabase link --project-ref [NEW_PROJECT_ID]

# Create the bucket structure
npx supabase storage create trade-screenshots --public
npx supabase storage create avatars --public
npx supabase storage create signal-charts --public

# If you have backups, upload them
npx supabase storage upload trade-screenshots ./storage-backups/backup_*/trade-screenshots/* --recursive
npx supabase storage upload avatars ./storage-backups/backup_*/avatars/* --recursive
npx supabase storage upload signal-charts ./storage-backups/backup_*/signal-charts/* --recursive
```

### Option B: Manual Re-upload

Users can re-upload their images when they log back in. It's optional!

## Step 7: Verify Everything Works

1. **Test Database Connection**:
```bash
npm run dev
```
- Check that the app loads
- Try signing in
- Check that journal data loads

2. **Test Edge Functions**:
- Check browser console for any Edge Function errors
- Test any features that use Edge Functions

3. **Test Storage**:
- Upload a new trade screenshot
- Verify it appears in storage
- Check avatars load correctly

4. **Test Real-time Features** (if applicable):
- Make changes from multiple tabs/devices
- Verify data syncs in real-time

## Step 8: Update DNS & Deploy

1. Update your domain's DNS to point to new Supabase URL (if applicable)
2. Deploy your application:
```bash
npm run build
# Deploy to your hosting (Vercel, Netlify, etc.)
```

## Step 9: Notify Users (if applicable)

If you have users, notify them of:
- New database URL
- Any downtime during migration
- Any data that needs to be re-uploaded

## Troubleshooting

### "Connection refused" Error
**Solution**: Check that your IP is whitelisted in new Supabase project
- Go to Project Settings → Network
- Add your IP to allowed IPs

### "Permission denied" on restore
**Solution**: Use correct database password and URL encoding
- `@` in password → `%40`
- `#` in password → `%23`
- `%` in password → `%25`

### Storage buckets not accessible
**Solution**: Make sure buckets are set to public
```bash
supabase storage update trade-screenshots --public
supabase storage update avatars --public
supabase storage update signal-charts --public
```

### Edge Functions not deploying
**Solution**: Check function code and try again
```bash
supabase functions deploy --no-verify-jwt  # if needed during testing
```

### RLS Policies not working
**Solution**: RLS policies are included in backup, but verify:
1. Check Supabase dashboard → Authentication → Policies
2. If policies missing, they're in `sql/` folder - apply manually

## Backup What You Need

For a **complete restore of your database and code**, you have:

| Component | Status | Required? | Location |
|-----------|--------|-----------|----------|
| Database Schema | ✅ | **YES** | `supabase/migrations/` (in Git) |
| Database Data | ✅ | **YES** | `backup-tools/backups/backup_*.sql` |
| Code | ✅ | **YES** | Git repository |
| Edge Functions | ✅ | **YES** | `supabase/functions/` (in Git) |
| Migrations | ✅ | **YES** | `supabase/migrations/` (in Git) |
| RLS Policies | ✅ | **YES** | Included in database backup |
| Storage Files | ⚠️ | **NO** | `backup-tools/storage-backups/` (optional) |

## Recovery Checklist

- [ ] New Supabase project created
- [ ] New credentials saved in `.env`
- [ ] Database restored from backup
- [ ] Migrations applied
- [ ] Edge Functions deployed
- [ ] Storage buckets created and populated
- [ ] Environment variables updated
- [ ] Application tested locally
- [ ] Application deployed to production
- [ ] Storage accessible (images, avatars, etc.)
- [ ] Real-time features working
- [ ] All database tables have data
- [ ] RLS policies enforced

## Quick Reference: Commands

```bash
# Check Supabase CLI is installed
supabase --version

# Link to new project
supabase link --project-ref [PROJECT_ID]

# Push migrations
supabase db push

# Deploy edge functions
supabase functions deploy

# Create storage buckets
supabase storage create trade-screenshots --public
supabase storage create avatars --public
supabase storage create signal-charts --public

# List storage buckets
supabase storage ls

# Upload to storage
supabase storage upload trade-screenshots ./path/to/file
```

## Support

If you need help:
1. Check [Supabase Docs](https://supabase.com/docs)
2. Check your backup log files
3. Verify all credentials are correct
4. Check browser console for errors
