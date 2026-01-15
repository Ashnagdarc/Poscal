# Week 2 Testing Guide - Payment UI

## ✅ What We Built This Week

1. **Pricing Page** (`src/pages/Pricing.tsx`)
   - Displays Free and Premium tier comparisons
   - Shows features for each tier
   - Beautiful card design with highlighted premium option
   - FAQ section
   - Links to upgrade flow

2. **Payment Modal** (`src/components/PaymentModal.tsx`)
   - Integrated with Paystack SDK (react-paystack)
   - Shows payment summary before processing
   - Handles success/error states
   - Verifies payment with backend function
   - Refreshes subscription after successful payment

3. **Upgrade Prompt** (`src/components/UpgradePrompt.tsx`)
   - Reusable component for feature-locked areas
   - Customizable title, description, and CTA
   - Shows pricing and features preview
   - Opens payment modal on click

4. **Routes & Environment**
   - Added `/pricing` route (public, no auth required)
   - Added `.env.example` with Paystack key
   - Integrated PaymentModal imports

---

## 🌐 Testing the Pricing Page

### Test 1: Access Pricing Page
1. Open: http://localhost:8081/pricing
2. ✅ PASS: Page loads without errors
3. ✅ Check: Two pricing tiers displayed (Free and Premium)
4. ✅ Check: Premium tier is highlighted
5. ✅ Check: All features listed correctly

### Test 2: Check Features Display
- ✅ Free tier shows 5 journal entries max
- ✅ Premium tier shows unlimited journal
- ✅ Free tier shows "View 3 Latest Signals"
- ✅ Premium tier shows "Take Unlimited Signals"
- ✅ All feature check marks and X marks display correctly

### Test 3: Check Current Plan Badge
1. Login as logged-in user
2. Navigate to `/pricing`
3. ✅ Check: Free users see "Start Free" button (disabled or styled differently)
4. ✅ Check: Premium users see "✓ Current Plan" badge

### Test 4: Click "Upgrade to Premium" Button
1. Click the upgrade button
2. ✅ PASS: Payment Modal opens
3. ✅ Check: Modal shows plan summary
4. ✅ Check: Modal displays pricing (₦500)
5. ✅ Check: Features list shown
6. ✅ Check: Paystack payment button visible

### Test 5: Payment Modal States
#### Without Login:
1. Open new incognito window
2. Go to `/pricing`
3. Click "Upgrade to Premium"
4. ✅ PASS: Redirects to `/signin`

#### With Login (Don't actually pay yet):
1. Login to app
2. Go to `/pricing`
3. Click "Upgrade to Premium"
4. ✅ Modal opens
5. ✅ Check: Shows correct email
6. ✅ Check: Shows correct pricing (₦500)
7. ✅ Don't click payment button yet (we'll test with test cards next)

---

## 💳 Testing Paystack Integration

### Setup Paystack Test Environment

**Important:** Before testing payments, you need to:

1. **Get Paystack Public Key:**
   - Go to https://dashboard.paystack.com
   - Login to your Paystack account
   - Go to Settings → API Keys & Webhooks
   - Copy the **Test Public Key** (starts with `pk_test_`)

2. **Add to .env.local:**
   Create file: `C:\Users\user\Documents\Poscal\.env.local`
   ```env
   VITE_SUPABASE_URL=https://ywnmxrpasfikvwdgexdo.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
   ```

3. **Restart Dev Server:**
   ```powershell
   # Stop current dev server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

### Test Payment Flow (Test Cards)

**Test Cards Available (Test Mode):**
- **Successful Payment:** `4084084084084081` (Any future date, any CVV)
- **Declined:** `4084080000000409`
- **Insufficient Funds:** `4084082000000408`

### Test 1: Successful Payment

1. Login to app
2. Go to `/pricing`
3. Click "Upgrade to Premium"
4. Payment Modal opens
5. Click "Pay ₦500" button
6. Paystack popup appears
7. Enter test card details:
   - Card: `4084084084084081`
   - Expiry: Any future date (e.g., 12/25)
   - CVV: Any 3 digits (e.g., 123)
   - Email: Any email
8. Click "Pay"

**Expected Result:**
- ✅ Success message appears: "🎉 Payment successful! Welcome to Premium!"
- ✅ Modal shows success state with checkmark
- ✅ After 2 seconds, modal closes
- ✅ Subscription status updates in React DevTools
- ✅ Page shows premium features

**What Happens Behind the Scenes:**
1. Paystack processes payment
2. Webhook sent to backend (configure next week)
3. Backend verifies payment
4. Backend updates user's `payment_status` to 'paid'
5. Frontend calls `refreshSubscription()`
6. SubscriptionContext updates with new status

### Test 2: Payment Failure

1. Repeat steps 1-5 above
2. When Paystack popup appears, use declined card: `4084080000000409`
3. Click "Pay"

**Expected Result:**
- ✅ Error message appears
- ✅ Modal shows error state
- ✅ "Try Again" button appears
- ✅ Can click "Try Again" to retry

### Test 3: User Cancels Payment

1. Click "Upgrade to Premium"
2. Payment Modal opens
3. Click "Pay ₦500" button
4. Paystack popup appears
5. **Close the popup** (don't complete payment)

**Expected Result:**
- ✅ Toast message: "Payment cancelled. Try again whenever you're ready."
- ✅ Modal stays open
- ✅ Can try again

---

## 🎨 Testing Upgrade Prompt Component

The Upgrade Prompt component isn't fully integrated yet (we'll do that in Week 3 when gating features), but let's verify it renders:

### Test in Browser Console:

1. In DevTools, check if component imports correctly:
```javascript
// No import errors in console
console.log('UpgradePrompt component available');
```

2. You can also temporarily add it to any page to see it:
```tsx
// In any page component:
import { UpgradePrompt } from '@/components/UpgradePrompt';

// Then in JSX:
<UpgradePrompt feature="unlimited journal entries" />
```

**Expected:**
- ✅ Beautiful card component displays
- ✅ Shows "Unlock unlimited journal entries"
- ✅ Click "Upgrade Now" opens payment modal

---

## 📋 Testing Checklist

### Pricing Page:
- [ ] Page loads without errors
- [ ] Two pricing tiers displayed
- [ ] Premium tier is highlighted
- [ ] Features listed correctly
- [ ] Current plan badge shows for logged-in users
- [ ] All buttons clickable
- [ ] Responsive on mobile

### Payment Modal:
- [ ] Opens when upgrade button clicked
- [ ] Shows plan summary
- [ ] Shows correct pricing
- [ ] Features listed
- [ ] Paystack button visible

### Paystack Integration (requires test key):
- [ ] Test key added to .env.local
- [ ] Dev server restarted
- [ ] Modal opens payment flow
- [ ] Successful payment with test card shows success state
- [ ] Failed payment shows error state
- [ ] Cancelling payment shows toast

### Build:
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No console errors

---

## ⚙️ Next Steps (Week 3)

Next week we'll:
1. Create Edge Function to verify payments (`paystack-webhook`)
2. Update user's subscription status in database
3. Add feature gating to Journal page (5-trade limit)
4. Add feature gating to Signals page (view-only mode)
5. Test complete payment-to-feature-unlock flow

---

## 🆘 Troubleshooting

### "VITE_PAYSTACK_PUBLIC_KEY is not set"
- Create `.env.local` file
- Add your Paystack test public key
- Restart dev server

### Payment Modal doesn't appear
- Check browser console for errors
- Verify PaymentModal component imported in Pricing.tsx
- Check that you're logged in (required to open modal)

### Paystack Button not working
- Check that public key is valid
- Try refreshing page
- Clear browser cache

### Payment succeeds but no backend update
- Backend webhook not set up yet (next week)
- Check Supabase logs for errors
- Verify `verify-payment` Edge Function exists

---

## 📊 Success Criteria

✅ All tests pass if:
1. Pricing page displays both tiers
2. Payment modal opens when clicking upgrade
3. Modal shows payment summary
4. Paystack button appears
5. Build completes successfully
6. No console errors

❌ Do NOT proceed to Week 3 if:
1. Payment modal doesn't open
2. Paystack button missing or broken
3. Build fails
4. Console shows errors

---

Good luck testing! Let me know when you're ready to move to Week 3 (Webhook Handler). 🚀
