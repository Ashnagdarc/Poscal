# Login Flow

## Overview
User authentication with Supabase, session management, and access to protected routes.

## Flow Diagram
```
User opens app
    ↓
AuthProvider initializes
├─ Calls: supabase.auth.onAuthStateChange()
├─ Calls: supabase.auth.getSession()
└─ Checks: Is JWT token saved in browser?
           ├─ YES (valid session exists)
           │   ├─ Restore session
           │   ├─ Set user = true
           │   └─ Show authenticated UI
           │
           └─ NO (no session)
               └─ Check: hasSeenOnboarding?
                   ├─ NO → Show /welcome (onboarding)
                   └─ YES → Show /signin (login page)
                           ↓
                   User enters email + password
                           ↓
                   POST supabase.auth.signInWithPassword()
                           ↓
                   Supabase validates credentials
                   ├─ VALID ✅
                   │   ├─ Generate JWT token
                   │   ├─ Store in browser
                   │   ├─ Update AuthContext
                   │   └─ Redirect to / (dashboard)
                   │
                   └─ INVALID ❌
                       ├─ Show error toast
                       ├─ Clear password field
                       └─ User stays on /signin

User on Dashboard
    ↓
Access protected routes?
├─ YES → Check: Is user authenticated?
│        ├─ YES ✅ → Show page content
│        └─ NO ❌ → Redirect to /signin
│
└─ NO → Show public pages (calculator, settings, etc.)
```

## Step-by-Step Process

### 1. App Initialization (AuthContext)
**File:** `src/contexts/AuthContext.tsx`

```typescript
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // 2. THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
};
```

**What happens:**
- ✅ Listener detects auth state changes
- ✅ Session check looks for JWT token in storage
- ✅ If found: restore session immediately
- ✅ If not found: user is unauthenticated
- ✅ `loading` set to `false` when complete

### 2. Check Onboarding Status
**File:** `src/pages/Index.tsx`

```typescript
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      // First time visitor → show welcome
      navigate("/welcome", { replace: true });
    } else {
      // Returning user → show calculator
      setIsReady(true);
    }
  }, [navigate]);
};
```

### 3. Sign In Page
**File:** `src/pages/SignIn.tsx`

User sees:
- Email input field
- Password input field (with show/hide toggle)
- "Remember me" checkbox (optional)
- "Sign In" button
- "Forgot password?" link
- "Create Account" link

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validation
  if (!email || !password) {
    toast.error("Please fill in all fields");
    return;
  }

  if (password.length < 6) {
    toast.error("Password must be at least 6 characters");
    return;
  }

  setIsLoading(true);
  
  // Call sign in
  const { error } = await signIn(email, password);

  if (error) {
    // Handle errors
    if (error.message.includes("Invalid login credentials")) {
      toast.error("Invalid email or password");
    } else if (error.message.includes("Email not confirmed")) {
      toast.error("Please check your email to confirm your account");
    } else {
      toast.error(error.message);
    }
    setIsLoading(false);
    return;
  }

  // Success
  toast.success("Welcome back!");
  navigate("/");
};
```

### 4. Supabase Authentication
**File:** `src/contexts/AuthContext.tsx`

```typescript
const signIn = async (email: string, password: string) => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('[auth] Sign in error:', error.message);
    }
    
    return { error };
  } catch (err) {
    console.error('[auth] Sign in exception:', err);
    return { error: err as Error };
  }
};
```

### 5. Supabase Validates Credentials
**Backend:** Supabase Auth Service

Process:
1. Lookup user by email in `auth.users` table
2. Compare provided password with stored hash
3. Check if email is verified (if required)
4. Generate new JWT token if valid

**Response if valid:**
```json
{
  "session": {
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh_token": "xxxxxxxxxxx",
    "expires_in": 3600,
    "expires_at": 1234567890,
    "token_type": "bearer",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "email_confirmed_at": "2025-01-13T10:00:00Z",
      "user_metadata": {
        "full_name": "John Doe"
      },
      "created_at": "2025-01-10T10:00:00Z"
    }
  }
}
```

### 6. Store Session in Browser
Supabase automatically stores:
```javascript
// localStorage (by default)
localStorage.setItem(
  'supabase.auth.session',
  JSON.stringify(session)
);
```

Or IndexedDB depending on storage strategy.

### 7. AuthContext Updates
```typescript
// onAuthStateChange fires with 'SIGNED_IN' event
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    setSession(session);      // Session object
    setUser(session?.user);   // User object
    setLoading(false);       // Auth check complete
  }
});
```

### 8. Navigation to Dashboard
```typescript
// After successful sign in
navigate("/");  // Navigate to dashboard (Index)
```

**Dashboard (Index page):**
- Shows Calculator component
- Shows BottomNav
- User can access protected routes now

### 9. Accessing Protected Routes
**File:** `src/components/ProtectedRoute.tsx`

```typescript
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  // Still checking auth state
  if (loading) {
    return <LoadingSpinner />;  // Show spinner
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/signin" replace />;  // Force login
  }

  // Authenticated - show content
  return <>{children}</>;
};
```

**Protected routes:**
- `/signals` - Trading signals
- `/admin/users` - Admin user management
- `/admin/updates` - Admin updates
- `/manage-accounts` - Trading accounts

**Public routes (no protection):**
- `/` - Calculator
- `/journal` - Trading journal
- `/history` - Trade history
- `/settings` - Settings
- `/signin` - Sign in
- `/signup` - Sign up

## Login with Persistent Session

### On Next Visit (Same Device)

```
User closes app → closes browser
    ↓
User opens app again (next day)
    ↓
AuthProvider initializes
    ↓
Check localStorage for session
    ↓
Session exists + valid?
├─ YES ✅
│   ├─ Restore session
│   ├─ JWT token still valid
│   ├─ Set user = true
│   └─ Show /
│
└─ NO ❌ (expired or missing)
    └─ Clear session
    └─ Redirect to /signin
```

### Token Expiration & Refresh

Supabase JWT tokens expire in ~3600 seconds (1 hour).

```typescript
// AuthContext monitors token expiration
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('[auth] Token refreshed successfully');
    // New token stored automatically
  }
});
```

Supabase **automatically refreshes** token before expiry:
- App is active? → Refresh ~5 minutes before expiry
- App is inactive? → Refresh on next interaction
- User doesn't need to re-login (seamless)

## Error Handling

### Invalid Email Format
```
Validation fails on form
Toast: "Invalid email format"
Form not submitted
```

### Email Not Verified
```
Supabase returns: "Email not confirmed"
Toast: "Please check your email to confirm your account"
User directed to resend verification email
```

### Invalid Email or Password
```
Supabase returns: "Invalid login credentials"
Toast: "Invalid email or password"
Password field cleared
User can retry
```

### Password Too Short
```
Frontend validation catches it
Toast: "Password must be at least 6 characters"
Form not submitted
```

### Network Error
```
Fetch fails / connection timeout
Toast: "Network error. Please check your connection."
User can retry after connection restored
```

### Too Many Login Attempts
```
Supabase may rate-limit (after ~5 failed attempts)
Toast: "Too many failed login attempts. Please try again later."
User must wait before retrying
```

### Session Expired (Inactive)
```
User inactive for 7+ days
Token expires
Next action (click button) triggers refresh
If refresh fails: redirect to /signin
User must login again
```

## Security Features

✅ **Password Hashing**
- Passwords hashed with bcrypt
- Never stored in plain text
- Never transmitted in logs

✅ **JWT Tokens**
- Signed with secret key
- Tamper-proof
- Include expiration time
- Stored in secure storage

✅ **HTTPS Only**
- All login requests encrypted
- No credentials exposed in URLs

✅ **Token Storage**
- Stored in localStorage (or IndexedDB)
- Cleared on sign out
- Not accessible to third-party scripts (if using httpOnly cookies)

✅ **Session Monitoring**
- Tracks active sessions
- Detects concurrent logins (if needed)
- Can invalidate sessions

✅ **Rate Limiting**
- Supabase rate-limits failed attempts
- Prevents brute force attacks

## User Journey After Login

```
User logged in
    ↓
Lands on Calculator (/)
    ↓
Can navigate to:
├─ /journal - View/create trades
├─ /history - View past trades
├─ /settings - Update preferences
├─ /signals - View trading signals (PROTECTED)
└─ Account setup - Create trading accounts
    ↓
Prices load from WebSocket
    ↓
User can use all features
```

## Related Files

- [src/pages/SignIn.tsx](../../src/pages/SignIn.tsx) - Sign in UI
- [src/contexts/AuthContext.tsx](../../src/contexts/AuthContext.tsx) - Auth logic
- [src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) - Route protection
- [src/pages/Index.tsx](../../src/pages/Index.tsx) - Dashboard
- [src/integrations/supabase/client.ts](../../src/integrations/supabase/client.ts) - Supabase client

## Next: Forgot Password Flow

User can click "Forgot Password?" on sign in page → [Password Reset Flow](./03_PASSWORD_RESET_FLOW.md)
