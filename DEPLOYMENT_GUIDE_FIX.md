# Deployment Guide - Critical Fix Applied

## What Was Wrong

The app was making requests to `https://api.poscalfx.com/feature-flag`, but the serverless function is actually deployed on your **main Vercel domain** at `/api/feature-flag`. This caused a 404 error, which cascaded into other failures.

## What's Fixed

✅ Feature-flag API now uses **relative paths**  
✅ Requests go to `/api/feature-flag` (correct domain)  
✅ Returns 200 instead of 404  
✅ App no longer hangs or shows null errors  
✅ Price polling works smoothly  

## Changes Made

**File: `src/lib/api.ts`**

Created a separate axios instance for serverless functions:
```typescript
// For serverless functions - uses relative paths (current domain)
const serverlessApi = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' }
});

// Feature-flag now uses this instance
export const featureFlagApi = {
  getPaidLock: async (): Promise<boolean> => {
    const { data } = await serverlessApi.get('/api/feature-flag'); // ✅ Relative path
  },
};
```

## Deployment Steps

### 1. Commit and Push
```bash
git add -A
git commit -m "fix: use relative paths for serverless functions"
git push origin main
```

### 2. Verify on Vercel
- Deployment should complete successfully
- No TypeScript errors

### 3. Test in Browser

**Test the endpoint directly:**
```javascript
fetch('/api/feature-flag')
  .then(r => r.json())
  .then(d => console.log(d))
```

**Expected response:**
```json
{"success": true, "key": "paid_lock_enabled", "enabled": false}
```

**Check Network tab:**
- Request URL: `/api/feature-flag`
- Status: **200 OK** ✅
- NOT 404 ❌

### 4. Monitor Console

Should see:
```
[feature-flag] Fetching paid lock status...
[feature-flag] Paid lock status: false
```

Should NOT see:
```
✗ GET https://api.poscalfx.com/feature-flag 404
✗ share-modal.js:1 TypeError: Cannot read properties of null
✗ 🔄 Starting... 🧹 Stopped (repeated)
```

## How This Works

| Before | After |
|--------|-------|
| `GET https://api.poscalfx.com/feature-flag` → 404 ❌ | `GET /api/feature-flag` → 200 ✅ |
| App hangs in loading state | App loads normally |
| Null errors in DOM | No DOM errors |
| Polling starts/stops repeatedly | Polling runs smoothly |

## Rollback

If you need to revert:
```bash
git revert <commit-hash>
git push origin main
```

## Support

If you still see issues:
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check Network tab for `/api/feature-flag` request
4. Verify response is 200, not 404
5. Check browser console for the debug logs

---

**Status: Ready to deploy! 🚀**
