# Debugging 404 NOT_FOUND Error

## Error Details
```
404: NOT_FOUND
Code: NOT_FOUND
ID: cpt1::7fsgx-1767431369637-8c116a4320d2
```

This error is coming from Supabase, not your React app. Here's how to debug it:

## Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Look for red errors showing which API call is failing
4. Check the **Network** tab to see failed requests

## Common Causes & Solutions

### 1. **Twelve Data API Key Missing**
If you see errors related to `get-live-prices`:

```bash
# Set your Twelve Data API key
npx supabase secrets set TWELVE_DATA_API_KEY=your_api_key_here
```

### 2. **VAPID Keys Missing** 
If you see errors related to push notifications:

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set the keys
npx supabase secrets set VAPID_PUBLIC_KEY=your_public_key
npx supabase secrets set VAPID_PRIVATE_KEY=your_private_key
```

### 3. **Environment Variables Not Set**
Check if environment variables are set:

```bash
npx supabase secrets list
```

### 4. **Function Timeout or Error**
Check function logs:

```bash
# View logs for specific function
npx supabase functions logs get-live-prices
npx supabase functions logs monitor-signals
npx supabase functions logs send-push-notification
npx supabase functions logs subscribe-push
```

## Quick Test

Run this in your browser console while on your site:

```javascript
// Test get-live-prices function
const { data, error } = await window.supabase?.functions.invoke('get-live-prices', {
  body: { symbols: ['EUR/USD'] }
});
console.log('Result:', data, 'Error:', error);
```

## If Still Having Issues

1. **Check Supabase Dashboard**: https://supabase.com/dashboard/project/ywnmxrpasfikvwdgexdo/functions
2. **View Edge Function Logs** in the dashboard
3. **Check if API quotas are exceeded** (Twelve Data free tier: 800 requests/day)

## Temporary Workaround

If the issue is with live prices, you can temporarily disable live price fetching:

1. Go to Signals page
2. The app will work without live prices, just won't show real-time updates
