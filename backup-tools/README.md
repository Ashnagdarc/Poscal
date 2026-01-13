# Supabase Database Backup & Restore Tools

This folder contains tools to backup and restore your Supabase database. These backups allow you to:
- Move your database to a new Supabase organization
- Restore data if you lose access to your current organization
- Create development/staging database copies
- Keep local backups of your production data

## Prerequisites

- Docker installed and running
- Supabase database connection URL
- Internet connection (to pull PostgreSQL 17 Docker image)

## Setup

1. **Add database URL to your `.env` file** (in project root):
   ```env
   SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
   ```

   You can find this in your Supabase project settings:
   - Go to Project Settings → Database
   - Copy the "Connection string" (URI format)
   - Replace `[YOUR-PASSWORD]` with your actual database password
   - **Important**: URL-encode special characters in password:
     - `@` becomes `%40`
     - `#` becomes `%23`
     - `%` becomes `%25`

2. **Make sure Docker is running**

## Creating a Backup

### On Windows:
```powershell
cd backup-tools
.\backup.ps1
```

### On Linux/Mac:
```bash
cd backup-tools
chmod +x backup.sh
./backup.sh
```

This will create two backup files in the `backups/` folder:
- **Full backup**: Complete database with schema and data
- **Data-only backup**: Just the data (useful if you already have migrations)

## Restoring a Backup

### Restore to Current Database:
```powershell
.\restore.ps1
```
This will show you a list of available backups and prompt you to select one.

### Restore to a NEW Supabase Project:
1. Create a new Supabase project
2. Get the new database URL from Project Settings → Database
3. Add it to your `.env` file as:
   ```env
   RESTORE_DB_URL=postgresql://postgres:[PASSWORD]@[NEW-HOST]:[PORT]/postgres
   ```
4. Run the restore script:
   ```powershell
   .\restore.ps1
   ```

### Restore a Specific Backup:
```powershell
.\restore.ps1 -BackupFile ".\backups\backup_20260113_143022.sql"
```

## What Gets Backed Up?

- ✅ All database tables and data
- ✅ Database functions and triggers
- ✅ Row Level Security (RLS) policies
- ✅ Indexes and constraints
- ❌ Edge Functions (stored in `supabase/functions/` - already in Git)
- ❌ Storage bucket files (need separate backup)
- ❌ Auth users (handled separately by Supabase)

## Migration Strategy

Your project uses Supabase migrations (in `supabase/migrations/`). For the cleanest restore:

1. **Option A - Data-only restore** (Recommended):
   - Push your Git repo (with migrations) to new project
   - Apply migrations: `supabase db push`
   - Restore data only: Use the `backup_data_only_*.sql` file

2. **Option B - Full restore**:
   - Use the full `backup_*.sql` file
   - This includes both schema and data

## Automated Backups

### Schedule Daily Backups (Windows Task Scheduler):
1. Open Task Scheduler
2. Create Basic Task
3. Set it to run daily
4. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-File "C:\Users\user\Documents\Poscal\backup-tools\backup.ps1"`

### Schedule Daily Backups (Linux/Mac with cron):
```bash
# Edit crontab
crontab -e

# Add this line to run daily at 2 AM
0 2 * * * cd /path/to/Poscal/backup-tools && ./backup.sh
```

## Storage Considerations

- Backups are stored in `backup-tools/backups/`
- Old backups are automatically cleaned up (keeps last 20)
- Consider backing up to cloud storage (Google Drive, Dropbox, etc.)

## Moving to a New Organization

If you lose access to your current Supabase organization:

1. **Create new Supabase project**
2. **Set up the database**:
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Link to new project
   supabase link --project-ref [NEW-PROJECT-REF]
   
   # Apply migrations
   supabase db push
   ```
3. **Restore data**:
   ```powershell
   cd backup-tools
   .\restore.ps1
   ```
4. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy
   ```
5. **Update environment variables** in your app with new Supabase URL and keys

## Troubleshooting

### "SUPABASE_DB_URL not found"
- Make sure your `.env` file exists in the project root
- Check that the variable name is exactly `SUPABASE_DB_URL`

### "Connection refused"
- Check your database password is correct
- Make sure your IP is allowed in Supabase database settings
- Verify the connection string format

### "Permission denied"
- On Linux/Mac: Run `chmod +x backup.sh restore.sh`
- On Windows: Run PowerShell as Administrator if needed

## Security Notes

⚠️ **Important**:
- Never commit backup files to Git (already in `.gitignore`)
- Never commit your `.env` file with database credentials
- Store backups in a secure location
- Regularly test your restore process

## Support

For issues or questions, check:
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
