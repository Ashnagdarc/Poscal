# Twelve Data API Key Configuration

The `TWELVE_DATA_API_KEY` is correctly implemented in the Edge Function at:
`supabase/functions/get-live-prices/index.ts`

## To Configure in Supabase:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ywnmxrpasfikvwdgexdo
2. Navigate to **Settings > Edge Functions > Secrets**
3. Add a new secret:
   - **Name:** `TWELVE_DATA_API_KEY`
   - **Value:** Your Twelve Data API key
4. Click "Add Secret"

The API key is already removed from the frontend and secured in the backend Edge Function.

## Alternative: Using Supabase CLI

```bash
npx supabase secrets set TWELVE_DATA_API_KEY=your_api_key_here
```

## Security Benefits:

✅ API key is not exposed in frontend code  
✅ API key is not committed to Git  
✅ Requests are routed through your secure backend  
✅ Rate limiting can be added at the Edge Function level
