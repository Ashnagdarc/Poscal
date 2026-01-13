# Password Reset Flow

## Overview
User-initiated password recovery through email verification with secure token.

## Flow Diagram
```
User on sign in page
    ↓
Clicks "Forgot Password?"
    ↓
Show password reset form
    ↓
User enters email address
    ↓
Click "Send Reset Link"
    ↓
POST to supabase.auth.resetPasswordForEmail()
    ↓
Supabase validates email exists
├─ Email NOT found
│   └─ Still show success message
│       (doesn't reveal if email registered or not - security)
│
└─ Email found
    ├─ Generate password reset token
    ├─ Token valid for: 24 hours
    ├─ Send email with reset link
    └─ Show: "Check your email for reset link"
                ↓
        User receives email
                ↓
        Email contains link:
        https://poscal.com/#/reset-password?code=<reset_token>
                ↓
        User clicks link
                ↓
        Frontend detects PASSWORD_RECOVERY event
                ↓
        Show form:
        ├─ New password
        ├─ Confirm password
        └─ Submit button
                ↓
        User enters new password
                ↓
        Validate:
        ├─ At least 6 characters
        └─ Passwords match
                ↓
        POST supabase.auth.updateUser({ password: newPassword })
                ↓
        Supabase validates reset token
        ├─ Token valid ✅
        │   ├─ Hash new password
        │   ├─ Update auth.users record
        │   └─ Invalidate all old sessions
        │
        └─ Token invalid/expired ❌
            └─ Show error: "Link expired. Request new reset email."
                ↓
        Password updated successfully
                ↓
        Redirect to /signin
                ↓
        User logs in with new password
```

## Step-by-Step Process

### 1. Forgot Password Page
**File:** `src/pages/SignIn.tsx`

User clicks "Forgot Password?" button on sign in form:

```typescript
const [showForgotPassword, setShowForgotPassword] = useState(false);

// In render:
{showForgotPassword ? (
  <ForgotPasswordForm />
) : (
  <SignInForm />
)}
```

### 2. Forgot Password Form
Shows form with:
- Email input field
- "Send Reset Link" button
- "Back to Sign In" button

```typescript
const handleResetPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!resetEmail) {
    toast.error("Please enter your email address");
    return;
  }

  setIsResetting(true);
  const { error } = await resetPassword(resetEmail);

  if (error) {
    toast.error(error.message);
  } else {
    toast.success("Password reset email sent! Check your inbox.");
    setShowForgotPassword(false);
    setResetEmail("");
  }
  setIsResetting(false);
};
```

### 3. Request Password Reset
**File:** `src/contexts/AuthContext.tsx`

```typescript
const resetPassword = async (email: string) => {
  if (!isSupabaseConfigured) {
    return { error: new Error('Supabase is not configured.') };
  }

  const redirectUrl = `${window.location.origin}/reset-password`;
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,  // Where to redirect after clicking email link
  });
  
  return { error };
};
```

**What this does:**
- Calls Supabase API with email
- Supabase checks if email exists in `auth.users`
- If email exists:
  - Generates secure reset token
  - Token includes: user ID, timestamp, signature
  - Sends email with reset link
- If email not found:
  - Still returns success (security practice)
  - No email sent, but user sees success message

### 4. Email Sent
User receives email:
```
Subject: Reset your PosCal password

Click the link below to reset your password:

[Reset Password Button]

This link expires in 24 hours.

Didn't request this? Ignore this email - your password remains unchanged.
```

**Email link structure:**
```
https://poscal.com/#/reset-password?code=eyJ0eXAiOiJKV1QiLCJhbGc...
```

### 5. Click Reset Link
User clicks link in email:
1. Browser navigates to `/reset-password`
2. URL contains code parameter with reset token
3. AuthContext detects this via `onAuthStateChange`

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    // Token is valid - user can reset password
    // AuthContext passes session to reset page
  }
});
```

### 6. Reset Password Page
**File:** `src/pages/ResetPassword.tsx`

Shows form:
- New password field (with show/hide)
- Confirm password field (with show/hide)
- "Reset Password" button

```typescript
const handleResetPassword = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validation
  if (!newPassword || !confirmPassword) {
    toast.error("Please fill in all fields");
    return;
  }

  if (newPassword.length < 6) {
    toast.error("Password must be at least 6 characters");
    return;
  }

  if (newPassword !== confirmPassword) {
    toast.error("Passwords do not match");
    return;
  }

  setIsLoading(true);

  // Update password in Supabase
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    toast.error(error.message);
    setIsLoading(false);
    return;
  }

  toast.success("Password reset successfully! Redirecting to sign in...");
  
  // Redirect to sign in
  setTimeout(() => {
    navigate("/signin");
  }, 1500);
};
```

### 7. Supabase Updates Password
**Backend:** Supabase Auth Service

Process:
1. Validates reset token (signature, expiration)
2. If valid:
   - Extract user ID from token
   - Hash new password with bcrypt
   - Update `auth.users.encrypted_password`
   - Invalidate all existing sessions for this user
   - Return success
3. If invalid/expired:
   - Return error: "Link expired"

### 8. Sessions Invalidated
**Important:** After password reset, **all existing sessions are invalidated**

This means:
- ✅ On current device: User stays logged in (new session)
- ✅ On other devices: User is logged out (old sessions invalid)
- ✅ Security: Attacker can't use compromised session

```typescript
// After password change, AuthContext updates:
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    // Other devices see this
    setUser(null);
    setSession(null);
  }
});
```

### 9. Redirect to Sign In
```typescript
// After successful reset
navigate("/signin", { replace: true });

// Show success toast
toast.success("Password reset successfully!");
```

### 10. User Logs In with New Password
User returns to `/signin`:
1. Enters email
2. Enters new password
3. Follows normal [Login Flow](./02_LOGIN_FLOW.md)

## Error Handling

### Email Not Found
```
Supabase returns: success (security - doesn't reveal registered emails)
Toast: "Password reset email sent! Check your inbox."
User waits for email but it never arrives
User can try:
1. Check spam folder
2. Request another reset
3. Try different email
```

### Reset Link Expired
```
User waits > 24 hours
Clicks old reset link
AuthContext detects invalid token
Toast: "Link has expired. Please request a new reset."
User redirected to /signin
User clicks "Forgot Password?" again
```

### Passwords Don't Match
```
Frontend validation catches it
Toast: "Passwords do not match"
Form not submitted
User can correct and retry
```

### Password Too Short
```
Frontend validation catches it
Toast: "Password must be at least 6 characters"
Form not submitted
```

### Network Error During Request
```
Fetch fails during password update
Toast: "Network error. Please try again."
User can retry submission
Reset token still valid
```

### User Clicks Link on Different Device
```
Reset link sent to desktop user
User opens link on mobile phone
Password reset succeeds (token works across devices)
User can now login on mobile
Old desktop session becomes invalid
```

## Security Features

✅ **Token Security**
- Reset token is single-use
- Tamper-proof (signed with secret)
- Expires after 24 hours
- Includes user ID (can't be reused for different user)

✅ **Email Verification**
- Only user with email access can receive link
- No one else can reset password
- Prevents unauthorized access

✅ **Session Invalidation**
- All old sessions revoked after password change
- Attacker with compromised password can't use old session
- User forced to login again on all devices

✅ **Safe Email Practice**
- Doesn't reveal if email is registered (prevents enumeration)
- Email not shown in URL
- No credentials in email link (only token)

✅ **Logging**
- All reset attempts logged
- Unusual activity can be detected
- User can see password change history

## Related Files

- [src/pages/SignIn.tsx](../../src/pages/SignIn.tsx) - Forgot password button
- [src/pages/ResetPassword.tsx](../../src/pages/ResetPassword.tsx) - Reset form
- [src/contexts/AuthContext.tsx](../../src/contexts/AuthContext.tsx) - Auth logic

## Next: Account Management

After login, user can manage accounts → [Trading Account Flow](./04_TRADING_ACCOUNT_FLOW.md)
