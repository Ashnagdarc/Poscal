# Supabase CORS Configuration Guide

## Problem
Your app at `https://www.poscalfx.com` cannot connect to Supabase because CORS is not configured.

## Root Cause
The Supabase server at `https://supabase.poscalfx.com` is rejecting requests from your frontend due to missing CORS headers.

## Solution: Add Allowed Origins to Supabase

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.poscalfx.com/
2. Log in with your credentials
3. Select your project (poscalfx)

### Step 2: Navigate to API Settings
1. Click **Settings** (⚙️ icon at bottom left)
2. Click **API** tab in the left sidebar
3. Look for **CORS** section (might be labeled "Allowed origins" or "Access Control")

### Step 3: Add Required Origins
Add these origins one by one:

**Development:**
- `http://localhost:3000`
- `http://localhost:5173`
- `http://localhost:8080`

**Production:**
- `https://www.poscalfx.com`
- `https://poscalfx.com`
- `https://poscal-alpha.vercel.app`

### Step 4: Save Changes
Click the Save/Update button to apply the settings.

### Step 5: Clear Browser Cache
After saving:
1. Open your app
2. Press **Ctrl + Shift + Delete** to open DevTools cache clearing
3. Clear cache and cookies for `poscalfx.com`
4. Reload the page

## Verification
After adding origins, you should see:
- No CORS errors in browser console
- App loads successfully with data from Supabase
- Real-time features work properly

## Troubleshooting

### Still Getting CORS Errors?
1. **Check origin format** - must include `http://` or `https://`
2. **No trailing slashes** - `https://www.poscalfx.com` NOT `https://www.poscalfx.com/`
3. **Wait a few minutes** - DNS propagation may be needed
4. **Hard refresh** - Ctrl+Shift+R (not just Ctrl+R)

### Wildcard Option (NOT RECOMMENDED for production)
You can add `*` to allow all origins, but this is insecure:
- `*` - Allow all origins (security risk!)

### Domain Configuration
If your Supabase domain (`supabase.poscalfx.com`) uses a different root domain:
- Make sure DNS A/AAAA records point to your Supabase IP
- Verify SSL certificate is valid

## Alternative: Backend Proxy (Advanced)
If you cannot modify Supabase settings, create a backend proxy:
```
Frontend → Your Backend (http://localhost:3001) → Supabase
```

## Database Connection Status
✅ Database: PostgreSQL at `db.poscalfx.supabase.co`
✅ Service Role Key: Configured
✅ Anonymous Key: Configured
⚠️ CORS: **NEEDS TO BE ADDED**

Current Configuration:
- Supabase URL: http://62.171.136.178:8000
- Database User: postgres
- 
