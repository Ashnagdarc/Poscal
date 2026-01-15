# Week 1 Testing Checklist - Payment System Foundation

## ✅ Database Tests (COMPLETED)

### Test Results:
- ✅ **7 payment columns** added to profiles table
- ✅ **Payments table** created with 18 columns
- ✅ **Paystack webhook logs** table created
- ✅ **12 indexes** created for performance
- ✅ **RLS enabled** on both new tables
- ✅ **4 helper functions** created and working:
  - `has_active_subscription()` ✅
  - `get_subscription_details()` ✅
  - `get_payment_statistics()` ✅
  - `can_access_feature()` ✅

---

## 🌐 Browser Testing (DO THIS NOW)

### Step 1: Start Dev Server

```powershell
cd C:\Users\user\Documents\Poscal
npm run dev
```

### Step 2: Open Browser & Login

1. Navigate to: http://localhost:5173
2. Login with your account (daniel.nonso48@gmail.com or another test account)
3. Open **Chrome DevTools** (F12 or Right-click → Inspect)
4. Go to **Console** tab

---

## 🧪 Test 1: Verify Subscription Context Loads

**In Browser Console, type:**

```javascript
// Check if SubscriptionContext is working
window.__subscription_test = true;

// Wait for page to load fully, then check React DevTools
```

**What to look for:**
- ✅ No errors in console about "useSubscription must be used within SubscriptionProvider"
- ✅ No infinite loops (page doesn't freeze)
- ✅ No network errors fetching subscription data

**Expected Behavior:**
- Console should be clean (no red errors)
- Page loads normally
- Network tab shows RPC call to `get_subscription_details`

---

## 🧪 Test 2: Check Subscription State via React DevTools

### Install React DevTools (if not installed):
1. Chrome Web Store → Search "React Developer Tools"
2. Install extension
3. Restart browser

### Check Subscription State:
1. Open DevTools → **Components** tab
2. Find `<SubscriptionProvider>` in component tree
3. Look at its state/hooks:

**Expected State (for free user):**
```javascript
{
  isPaid: false,
  isTrial: false,
  isLoading: false,
  subscriptionTier: 'free',
  paymentStatus: 'free',
  expiresAt: null,
  trialEndsAt: null,
  daysUntilExpiry: null,
  daysUntilTrialEnd: null
}
```

**✅ PASS if:**
- `isLoading` is `false` after page load
- `subscriptionTier` is `'free'`
- `isPaid` is `false`

**❌ FAIL if:**
- `isLoading` stays `true` forever (infinite loading)
- State is `undefined` (context not working)
- Console shows RPC errors

---

## 🧪 Test 3: Manual Feature Access Test

**In Browser Console, type:**

```javascript
// Access the subscription context (hack for testing)
// This won't work in production, but helps us test

// Alternative: Check if protected routes redirect
// Navigate to: http://localhost:5173/signals
```

**Expected Behavior:**
- You should be able to access `/signals` page (because it's only auth-protected, not premium-protected yet)
- Page loads without errors

---

## 🧪 Test 4: Test Route Protection

### Test Auth Protection (Already Working):
1. Open private/incognito window
2. Navigate to: http://localhost:5173/signals
3. **Expected:** Should redirect to `/signin`

### Test Premium Protection (Not Yet Active):
1. Login to app
2. Navigate to: http://localhost:5173/signals
3. **Expected:** Should load normally (no premium check yet)
4. Check console for any errors

---

## 🧪 Test 5: Test Loading States

### What to Check:
1. **Initial Load:**
   - Should show loading spinner briefly
   - Then show actual content
   - Should not flash between states rapidly

2. **Navigation:**
   - Clicking between pages should be smooth
   - No loading spinner on every page change (subscription is cached)

3. **Refresh:**
   - Press F5 to refresh page
   - Should reload subscription state
   - Should not cause infinite loop

**✅ PASS if:**
- Loading spinner shows < 1 second
- Page loads smoothly
- No console errors

**❌ FAIL if:**
- Loading spinner never goes away
- Console shows repeated RPC calls (infinite loop)
- Page crashes or freezes

---

## 🧪 Test 6: Network Performance Check

### In DevTools → Network Tab:

1. Clear network log (trash icon)
2. Refresh page (F5)
3. Look for RPC call: `get_subscription_details`

**Expected:**
- ✅ 1 call to `get_subscription_details` on page load
- ✅ Status: 200 OK
- ✅ Response time: < 500ms
- ✅ Returns correct JSON with subscription data

**Check Response:**
```json
[
  {
    "payment_status": "free",
    "subscription_tier": "free",
    "expires_at": null,
    "trial_ends_at": null,
    "is_active": false
  }
]
```

**❌ RED FLAGS:**
- Multiple calls to same function (infinite loop)
- 500 Internal Server Error
- Timeout errors
- "Function not found" error

---

## 🧪 Test 7: Test with Different User States

### Simulate Premium User (Temporarily):

**In Supabase Dashboard:**
1. Go to Table Editor → profiles
2. Find your test user row
3. Edit the row:
   - `payment_status` → `'paid'`
   - `subscription_tier` → `'premium'`
   - `subscription_expires_at` → Set to 30 days from now
   - `payment_date` → Set to today
4. Save changes

**In Browser:**
1. Refresh page (F5)
2. Open React DevTools → Components → SubscriptionProvider
3. Check state

**Expected:**
```javascript
{
  isPaid: true,
  isTrial: false,
  subscriptionTier: 'premium',
  paymentStatus: 'paid',
  expiresAt: Date(2026-02-13...), // 30 days from now
  daysUntilExpiry: 30
}
```

### Simulate Trial User:

**In Supabase Dashboard:**
1. Edit your test user:
   - `payment_status` → `'trial'`
   - `subscription_tier` → `'premium'`
   - `trial_ends_at` → Set to 7 days from now

**In Browser:**
1. Refresh page
2. Check state

**Expected:**
```javascript
{
  isPaid: false,
  isTrial: true,
  subscriptionTier: 'premium',
  paymentStatus: 'trial',
  trialEndsAt: Date(...),
  daysUntilTrialEnd: 7
}
```

---

## 🧪 Test 8: Test Feature Access Function

### In Browser Console:

Since we can't directly access the context from console, let's add a temporary test:

**Add this to any component temporarily:**

```javascript
// In src/pages/Profile.tsx or any page
import { useSubscription } from '@/contexts/SubscriptionContext';

// Inside component:
const { checkFeatureAccess, subscriptionTier, isPaid } = useSubscription();

console.log('=== SUBSCRIPTION TEST ===');
console.log('Tier:', subscriptionTier);
console.log('Is Paid:', isPaid);
console.log('Can access journal_unlimited:', checkFeatureAccess('journal_unlimited'));
console.log('Can access signals_take:', checkFeatureAccess('signals_take'));
console.log('Can access export_csv:', checkFeatureAccess('export_csv'));
console.log('========================');
```

**Expected Output (Free User):**
```
=== SUBSCRIPTION TEST ===
Tier: free
Is Paid: false
Can access journal_unlimited: false
Can access signals_take: false
Can access export_csv: false
========================
```

**Expected Output (Premium User):**
```
=== SUBSCRIPTION TEST ===
Tier: premium
Is Paid: true
Can access journal_unlimited: true
Can access signals_take: true
Can access export_csv: true
========================
```

---

## 🚨 Red Flags to Watch For

### Critical Issues (Stop and Fix):
1. **Infinite Loop:**
   - Network tab shows continuous RPC calls
   - Browser freezes or becomes unresponsive
   - Console fills with repeated logs

2. **Context Error:**
   - "useSubscription must be used within SubscriptionProvider"
   - This means provider is not wrapping the app correctly

3. **RLS Permission Error:**
   - "permission denied for function get_subscription_details"
   - Check that function has SECURITY DEFINER

4. **Type Errors:**
   - TypeScript errors in console
   - Red squiggly lines in VS Code

### Minor Issues (Note but Can Continue):
1. **Slow Loading:**
   - Subscription takes > 2 seconds to load
   - May need optimization later

2. **Console Warnings:**
   - React warnings about useEffect dependencies
   - Can be addressed later

3. **DevTools Warnings:**
   - React DevTools shows optimization opportunities
   - Not critical for functionality

---

## 🎯 Success Criteria Summary

### ✅ All Tests Pass If:
1. ✅ Page loads without errors
2. ✅ Subscription state appears in React DevTools
3. ✅ `isLoading` becomes `false` within 1 second
4. ✅ Free user shows `isPaid: false, tier: 'free'`
5. ✅ Premium user (when simulated) shows `isPaid: true, tier: 'premium'`
6. ✅ `checkFeatureAccess()` returns correct boolean based on tier
7. ✅ Only 1 RPC call per page load (no infinite loops)
8. ✅ Route protection works (redirects to signin when not logged in)
9. ✅ No TypeScript errors in VS Code
10. ✅ Build completes successfully (`npm run build`)

### ❌ Do NOT Proceed to Week 2 If:
1. ❌ Infinite loops in network requests
2. ❌ Context not loading (stays undefined)
3. ❌ Console shows continuous errors
4. ❌ Page crashes or freezes
5. ❌ TypeScript compilation errors
6. ❌ RLS permission denied errors

---

## 🔄 Reset Test User to Free Tier

**After testing, reset your user:**

```sql
-- In Supabase SQL Editor or via MCP:
UPDATE profiles 
SET 
  payment_status = 'free',
  subscription_tier = 'free',
  payment_date = NULL,
  subscription_expires_at = NULL,
  trial_ends_at = NULL,
  payment_reference = NULL
WHERE email = 'your-test-email@example.com';
```

---

## 📋 Test Results Checklist

Copy this to document your test results:

```
WEEK 1 TESTING RESULTS
=====================

Date: ____________
Tester: ____________

DATABASE TESTS:
[ ] All columns created in profiles table
[ ] Payments table exists with correct structure
[ ] Indexes created (12 total)
[ ] RLS enabled on new tables
[ ] Helper functions exist and work

BROWSER TESTS:
[ ] Page loads without errors
[ ] Subscription context loads
[ ] React DevTools shows subscription state
[ ] isLoading becomes false
[ ] Free user shows correct state
[ ] Premium user (simulated) shows correct state
[ ] Feature access function works correctly
[ ] Only 1 RPC call per page load
[ ] Auth protection redirects correctly
[ ] No infinite loops
[ ] Build succeeds

PERFORMANCE:
[ ] Subscription loads in < 1 second
[ ] Page navigation is smooth
[ ] No memory leaks (check DevTools Memory tab)
[ ] Network requests are optimized

ISSUES FOUND:
_______________________________________
_______________________________________
_______________________________________

READY FOR WEEK 2: [ ] YES  [ ] NO

Notes:
_______________________________________
_______________________________________
```

---

## 🚀 Next Steps After All Tests Pass

Once all tests pass:
1. ✅ Commit changes to Git
2. ✅ Document any issues found and fixed
3. ✅ Ready to proceed to **Week 2: Payment UI**

---

## 💡 Quick Debugging Tips

### If Subscription Context Not Loading:
1. Check App.tsx has `<SubscriptionProvider>` wrapped correctly
2. Verify import path is correct
3. Check browser console for import errors

### If RPC Call Fails:
1. Check Supabase project is running
2. Verify function exists: `select * from pg_proc where proname = 'get_subscription_details'`
3. Check SECURITY DEFINER is set on function

### If TypeScript Errors:
1. Run: `npm install` (ensure all deps installed)
2. Restart VS Code TypeScript server
3. Check tsconfig.json includes contexts folder

### If Infinite Loop:
1. Check useEffect dependencies in SubscriptionContext
2. Ensure `user?.id` in dependency array (not whole user object)
3. Add console.log to see how many times fetchSubscriptionDetails runs

---

## 📞 Support

If you encounter issues not covered here:
1. Check browser console for error messages
2. Check Supabase logs in dashboard
3. Use React DevTools Profiler to check render counts
4. Review SubscriptionContext.tsx for logic errors

---

**Good luck with testing! 🧪**
