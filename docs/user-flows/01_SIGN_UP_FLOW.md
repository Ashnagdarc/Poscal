# Sign Up Flow

## Overview
Complete user registration process with email verification and account setup.

## Flow Diagram
```
User visits app
    ↓
Is user authenticated?
├─ YES → Skip to dashboard
└─ NO → Check localStorage.hasSeenOnboarding
        ├─ NO → Show /welcome (onboarding)
        └─ YES → Show /signin page
                 User clicks "Create Account" → /signup
                 ↓
        User enters email + password
                 ↓
        Frontend validation:
        ├─ Email format check
        ├─ Password length (min 6 chars)
        └─ Confirm password match
                 ↓
        POST to supabase.auth.signUp()
                 ↓
        Supabase creates user record
                 ↓
        Email sent: "Confirm your email"
                 ↓
        Show success message:
        "Check your email to confirm account"
                 ↓
        User clicks email link
                 ↓
        redirectTo: /
        (email verified automatically)
                 ↓
        User logged in → Dashboard loads
```

## Step-by-Step Process

### 1. Onboarding Entry
**File:** `src/pages/Welcome.tsx`
- User sees app introduction
- Clicks "Get Started"
- Navigates to `/signin`
- localStorage sets `hasSeenOnboarding = true`

### 2. Sign Up Page
**File:** `src/pages/SignUp.tsx`
- Email input field
- Password input field (with show/hide toggle)
- Confirm password field
- Full name field (optional)
- "Create Account" button
- "Already have account? Sign In" link

### 3. Client-Side Validation
```typescript
// src/pages/SignUp.tsx
const handleSubmit = async (e: React.FormEvent) => {
  // Check all fields filled
  if (!email || !password || !confirmPassword) {
    toast.error("Please fill in all fields");
    return;
  }

  // Check password length
  if (password.length < 6) {
    toast.error("Password must be at least 6 characters");
    return;
  }

  // Check passwords match
  if (password !== confirmPassword) {
    toast.error("Passwords do not match");
    return;
  }

  // Proceed to signup
  setIsLoading(true);
  const { error } = await signUp(email, password, fullName);
  // Handle response...
};
```

### 4. Supabase Authentication
**File:** `src/contexts/AuthContext.tsx`
```typescript
const signUp = async (email: string, password: string, fullName?: string) => {
  const redirectUrl = `${window.location.origin}/`;
  
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,  // Where to go after email confirmation
      data: {
        full_name: fullName || '',   // Store full name in user metadata
      },
    },
  });
  
  return { error };
};
```

### 5. Supabase Creates Account
**Backend:** Supabase Auth Service
- Creates new user record in `auth.users` table
- Generates confirmation email with verification link
- Link includes magic token valid for 24 hours
- Email sent to provided address

### 6. Email Confirmation
User receives email:
```
Subject: Confirm your email

Click the link below to confirm your email and activate your account:

[Confirm Email Button/Link]

This link expires in 24 hours.
```

### 7. User Clicks Email Link
- Link format: `https://poscal.com/#/redirect?code=<verification_code>`
- Supabase auth listener detects confirmation
- Automatically redirects to home page (`/`)
- JWT token stored in browser

### 8. Account Created Successfully
**AuthContext updates:**
```typescript
// onAuthStateChange fires
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    setSession(session);      // JWT token + metadata
    setUser(session?.user);   // User object
    setLoading(false);
  }
});
```

### 9. User Lands on Dashboard
**File:** `src/pages/Index.tsx`
- Calculator component loads
- BottomNav displays
- User is now authenticated
- Can access all protected routes

## Error Handling

### Email Already Exists
```
Supabase returns: "User already registered"
Toast: "Email already in use. Please sign in instead."
User redirected to /signin
```

### Weak Password
```
Supabase returns: "Password should be at least 6 characters"
Toast: "Password must be at least 6 characters"
User stays on form to retry
```

### Email Verification Expires
```
Link valid for: 24 hours
After expiration: "Link expired. Request new confirmation email."
User can request new email from settings
```

### Network Error During Signup
```
Client detects error
Toast: Displays error message
Form remains filled
User can retry submission
```

## Data Stored After Signup

### In Supabase auth.users
- `id` (UUID)
- `email`
- `encrypted_password`
- `email_confirmed_at` (timestamp when email verified)
- `user_metadata`:
  - `full_name` (if provided)
- `created_at`
- `updated_at`

### In Browser (localStorage/IndexedDB)
- `supabase.auth.session` (JWT token + expiry)
- `hasSeenOnboarding` = true

## Security Features

✅ **Password Requirements:**
- Minimum 6 characters
- Hashed before storage
- No plain text transmission

✅ **Email Verification:**
- Prevents bot accounts
- Verification link is single-use
- Expires after 24 hours
- User can request new link

✅ **Session Management:**
- JWT token stored securely
- Auto-refreshes before expiry
- Sign out clears token

✅ **HTTPS Only:**
- All auth requests encrypted
- No credentials exposed in logs

## Success Criteria

✅ User can enter email and password  
✅ Validation prevents submission with errors  
✅ Account created in Supabase  
✅ Confirmation email sent to user  
✅ User clicks email link  
✅ Email verified  
✅ User logged in automatically  
✅ User can access dashboard  

## Next Steps After Signup

1. User sees onboarding (if first time)
2. User can access calculator immediately
3. User can navigate to protected features (signals, journal, etc.)
4. User can create trading accounts
5. User can start logging trades

## Related Files

- [src/pages/SignUp.tsx](../../src/pages/SignUp.tsx) - UI component
- [src/contexts/AuthContext.tsx](../../src/contexts/AuthContext.tsx) - Auth logic
- [src/pages/Welcome.tsx](../../src/pages/Welcome.tsx) - Onboarding
- [src/integrations/supabase/client.ts](../../src/integrations/supabase/client.ts) - Supabase client
