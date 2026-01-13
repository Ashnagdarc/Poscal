# User Account Settings & Preferences Flow

## Overview
User manages their profile, preferences, notification settings, and trading configuration.

## Flow Diagram

```
User navigates to /settings
    ↓
    ├─ Fetch user profile from auth.users
    ├─ Fetch user preferences from database
    ├─ Load notification settings
Settings.tsx component loads
    └─ Display multiple tabs
    ↓
User sees tabbed interface:
├─ Tab 1: Profile
│  ├─ Full name
│  ├─ Email (read-only)
│  ├─ Avatar/Profile picture
│  ├─ Bio/About
│  ├─ Trading experience level
│  └─ Save button
│
├─ Tab 2: Preferences
│  ├─ Theme (light/dark)
│  ├─ Currency display (USD/EUR/GBP)
│  ├─ Default trading pair
│  ├─ Leverage preference
│  ├─ Position size default
│  ├─ Language
│  └─ Save button
│
├─ Tab 3: Notifications
│  ├─ Push notifications (enabled/disabled)
│  ├─ Email notifications
│  │  ├─ New signal alerts
│  │  ├─ Trade closed alerts
│  │  ├─ Account performance summary
│  │  └─ Weekly report
│  ├─ Desktop notifications
│  ├─ Mobile notifications
│  └─ Save button
│
├─ Tab 4: Security
│  ├─ Current password (for verification)
│  ├─ New password
│  ├─ Confirm password
│  ├─ Active sessions list
│  │  ├─ Device info
│  │  ├─ Location
│  │  ├─ Last active
│  │  └─ "Sign out" button
│  ├─ Two-factor authentication (optional)
│  └─ Save button
│
└─ Tab 5: Danger Zone
   ├─ Delete account
   │  └─ Confirmation dialog (irreversible)
   ├─ Export data (GDPR)
   └─ Deactivate account (temporary)
    ↓
OPTION 1: UPDATE PROFILE
    ↓
    User updates: Full name, bio, experience level
        ↓
    Click "Save Profile"
        ↓
    Frontend validation
        ↓
    UPDATE auth.users metadata
    OR UPDATE custom users table
        ↓
    Profile updated
        ↓
    Toast: "Profile updated successfully!"
        ↓
OPTION 2: UPDATE PREFERENCES
    ↓
    User selects preferences:
    ├─ Theme: light/dark
    ├─ Currency: USD/EUR/GBP/JPY
    ├─ Default trading pair
    └─ Leverage preference
        ↓
    Click "Save Preferences"
        ↓
    UPDATE user_preferences table
    OR localStorage (client-side)
        ↓
    Frontend updates immediately
        ↓
    All screens respect preferences
        ↓
OPTION 3: NOTIFICATION SETTINGS
    ↓
    User toggles notification types:
    ├─ Signal alerts (on/off)
    ├─ Trade closed alerts (on/off)
    ├─ Weekly performance report (on/off)
    └─ Allow sound (on/off)
        ↓
    Click "Save Notification Settings"
        ↓
    UPDATE notification_settings table
        ↓
    Backend triggers notifications accordingly
        ↓
OPTION 4: CHANGE PASSWORD
    ↓
    User enters current password (verification)
    User enters new password
    User confirms new password
        ↓
    Frontend validation:
    ├─ New password >= 6 chars
    ├─ Passwords match
    └─ Different from old password
        ↓
    POST to supabase.auth.updateUser()
        ↓
    Supabase verifies current password
    ├─ Valid ✅ → Hash new password
    │           → Update auth.users
    │           → Invalidate all old sessions
    │           → Success
    │
    └─ Invalid ❌ → Error: "Current password incorrect"
        ↓
    Toast: "Password changed successfully!"
        ↓
    All old sessions signed out (security)
    User may need to re-login
        ↓
OPTION 5: MANAGE SESSIONS
    ↓
    User sees list of active sessions:
    ├─ Browser: Chrome on Windows
    ├─ Location: New York, NY
    ├─ Last active: 5 minutes ago
    └─ Sign out button
        ↓
    User can sign out individual sessions
        ↓
    Or "Sign out all other sessions"
        ↓
    POST to sign out endpoint
        ↓
    Session tokens invalidated
        ↓
    Other devices logged out
        ↓
    Toast: "Signed out successfully"
        ↓
OPTION 6: DELETE ACCOUNT
    ↓
    User clicks "Delete Account"
        ↓
    Confirmation modal appears:
    "Are you sure? This is irreversible.
     All your trades, signals, and data will be deleted."
    ├─ Cancel button
    └─ Delete button (requires email confirmation)
        ↓
    If confirmed:
    ├─ Send confirmation email
    ├─ Email contains deletion link
    ├─ Link valid for 24 hours
    ├─ User clicks link
    ├─ Account soft-deleted or hard-deleted
    │  ├─ Soft delete: Account marked deleted, data retained (GDPR)
    │  └─ Hard delete: All user data removed
    └─ Irreversible
```

## Step-by-Step Process

### 1. Open Settings Page

**File:** `src/pages/Settings.tsx`

```typescript
const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  if (!user) {
    return <Navigate to="/signin" />;
  }

  return (
    <div className="pb-24">
      {/* Tab Navigation */}
      <div className="flex gap-2 px-4 overflow-x-auto">
        {['profile', 'preferences', 'notifications', 'security', 'danger'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${
              activeTab === tab ? 'bg-foreground text-background' : 'bg-secondary'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-6">
        {activeTab === 'profile' && <ProfileTab user={user} />}
        {activeTab === 'preferences' && <PreferencesTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'security' && <SecurityTab user={user} />}
        {activeTab === 'danger' && <DangerTab user={user} />}
      </div>
    </div>
  );
};
```

### 2. Profile Tab

```typescript
const ProfileTab = ({ user }: { user: User }) => {
  const [formData, setFormData] = useState({
    fullName: user.user_metadata?.full_name || '',
    bio: user.user_metadata?.bio || '',
    experience: user.user_metadata?.experience_level || 'beginner',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: formData.fullName,
        bio: formData.bio,
        experience_level: formData.experience,
      },
    });

    if (error) {
      toast.error("Failed to update profile");
      setIsLoading(false);
      return;
    }

    toast.success("Profile updated successfully!");
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Full Name</label>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={user.email}
          disabled
          className="w-full px-3 py-2 border rounded-lg bg-muted"
        />
        <p className="text-xs text-muted-foreground mt-1">
          To change email, contact support
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Bio</label>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData({...formData, bio: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Tell us about your trading experience"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Trading Experience</label>
        <select
          value={formData.experience}
          onChange={(e) => setFormData({...formData, experience: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="beginner">Beginner (< 1 year)</option>
          <option value="intermediate">Intermediate (1-3 years)</option>
          <option value="advanced">Advanced (3+ years)</option>
          <option value="professional">Professional</option>
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={isLoading}
        className="w-full bg-foreground text-background py-2 rounded-lg"
      >
        {isLoading ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  );
};
```

### 3. Preferences Tab

```typescript
const PreferencesTab = () => {
  const [prefs, setPrefs] = useState({
    theme: localStorage.getItem('theme') || 'dark',
    currency: localStorage.getItem('currency') || 'USD',
    defaultPair: localStorage.getItem('defaultPair') || 'EUR/USD',
    language: localStorage.getItem('language') || 'en',
  });

  const handleSave = async () => {
    // Save to localStorage (client-side preferences)
    localStorage.setItem('theme', prefs.theme);
    localStorage.setItem('currency', prefs.currency);
    localStorage.setItem('defaultPair', prefs.defaultPair);
    localStorage.setItem('language', prefs.language);

    // Apply theme
    if (prefs.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    toast.success("Preferences updated!");
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Theme</label>
        <select
          value={prefs.theme}
          onChange={(e) => setPrefs({...prefs, theme: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto (System)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Base Currency</label>
        <select
          value={prefs.currency}
          onChange={(e) => setPrefs({...prefs, currency: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="USD">USD (US Dollar)</option>
          <option value="EUR">EUR (Euro)</option>
          <option value="GBP">GBP (British Pound)</option>
          <option value="JPY">JPY (Japanese Yen)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Default Trading Pair</label>
        <select
          value={prefs.defaultPair}
          onChange={(e) => setPrefs({...prefs, defaultPair: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="EUR/USD">EUR/USD</option>
          <option value="GBP/USD">GBP/USD</option>
          <option value="USD/JPY">USD/JPY</option>
          <option value="AUD/USD">AUD/USD</option>
        </select>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-foreground text-background py-2 rounded-lg"
      >
        Save Preferences
      </button>
    </div>
  );
};
```

### 4. Notifications Tab

```typescript
const NotificationsTab = () => {
  const { permission } = useNotifications();
  const [settings, setSettings] = useState({
    pushEnabled: permission === 'granted',
    signalAlerts: true,
    tradeClosedAlerts: true,
    weeklyReport: true,
    enableSound: true,
  });

  const handleSave = async () => {
    const { user } = useAuth();
    if (!user) return;

    const { error } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: user.id,
        push_enabled: settings.pushEnabled,
        signal_alerts: settings.signalAlerts,
        trade_closed_alerts: settings.tradeClosedAlerts,
        weekly_report: settings.weeklyReport,
        sound_enabled: settings.enableSound,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      toast.error("Failed to save notification settings");
      return;
    }

    toast.success("Notification settings saved!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between py-3 border-b">
        <span className="font-medium">Push Notifications</span>
        <input
          type="checkbox"
          checked={settings.pushEnabled}
          onChange={(e) => setSettings({...settings, pushEnabled: e.target.checked})}
          className="w-5 h-5"
        />
      </div>

      <div className="flex items-center justify-between py-3 border-b">
        <span>Signal Alerts</span>
        <input
          type="checkbox"
          checked={settings.signalAlerts}
          onChange={(e) => setSettings({...settings, signalAlerts: e.target.checked})}
          disabled={!settings.pushEnabled}
          className="w-5 h-5"
        />
      </div>

      <div className="flex items-center justify-between py-3 border-b">
        <span>Trade Closed Alerts</span>
        <input
          type="checkbox"
          checked={settings.tradeClosedAlerts}
          onChange={(e) => setSettings({...settings, tradeClosedAlerts: e.target.checked})}
          disabled={!settings.pushEnabled}
          className="w-5 h-5"
        />
      </div>

      <div className="flex items-center justify-between py-3 border-b">
        <span>Weekly Performance Report</span>
        <input
          type="checkbox"
          checked={settings.weeklyReport}
          onChange={(e) => setSettings({...settings, weeklyReport: e.target.checked})}
          disabled={!settings.pushEnabled}
          className="w-5 h-5"
        />
      </div>

      <div className="flex items-center justify-between py-3 border-b">
        <span>Enable Sound</span>
        <input
          type="checkbox"
          checked={settings.enableSound}
          onChange={(e) => setSettings({...settings, enableSound: e.target.checked})}
          className="w-5 h-5"
        />
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-foreground text-background py-2 rounded-lg mt-4"
      >
        Save Notification Settings
      </button>
    </div>
  );
};
```

### 5. Security Tab

```typescript
const SecurityTab = ({ user }: { user: User }) => {
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [isChanging, setIsChanging] = useState(false);

  const handleChangePassword = async () => {
    // Validation
    if (!passwords.current || !passwords.new) {
      toast.error("Please fill in all fields");
      return;
    }

    if (passwords.new.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setIsChanging(true);

    // First, verify current password by attempting sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: passwords.current,
    });

    if (verifyError) {
      toast.error("Current password is incorrect");
      setIsChanging(false);
      return;
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: passwords.new,
    });

    if (updateError) {
      toast.error("Failed to change password");
      setIsChanging(false);
      return;
    }

    toast.success("Password changed successfully!");
    setPasswords({ current: '', new: '', confirm: '' });
    setIsChanging(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Current Password</label>
        <input
          type="password"
          value={passwords.current}
          onChange={(e) => setPasswords({...passwords, current: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Enter current password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">New Password</label>
        <input
          type="password"
          value={passwords.new}
          onChange={(e) => setPasswords({...passwords, new: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Enter new password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Confirm Password</label>
        <input
          type="password"
          value={passwords.confirm}
          onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Confirm new password"
        />
      </div>

      <button
        onClick={handleChangePassword}
        disabled={isChanging}
        className="w-full bg-foreground text-background py-2 rounded-lg"
      >
        {isChanging ? 'Changing...' : 'Change Password'}
      </button>

      <div className="mt-6 pt-6 border-t">
        <h3 className="font-semibold mb-4">Active Sessions</h3>
        {/* List active sessions */}
        <button className="text-red-500 text-sm">
          Sign out all other sessions
        </button>
      </div>
    </div>
  );
};
```

### 6. Danger Zone Tab

```typescript
const DangerTab = ({ user }: { user: User }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');

  const handleDeleteAccount = async () => {
    if (deleteEmail !== user.email) {
      toast.error("Please enter your correct email to confirm");
      return;
    }

    // Send confirmation email
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error("Failed to delete account");
      return;
    }

    // In production, you'd send a delete confirmation email
    toast.success("Account deletion link sent to your email");
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg">
        <h3 className="font-semibold text-red-800 dark:text-red-100 mb-2">
          Delete Account
        </h3>
        <p className="text-sm text-red-700 dark:text-red-200 mb-4">
          This action is irreversible. All your data will be permanently deleted.
        </p>

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="bg-red-600 text-white px-4 py-2 rounded-lg"
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={deleteEmail}
              onChange={(e) => setDeleteEmail(e.target.value)}
              placeholder="Enter your email to confirm"
              className="w-full px-3 py-2 border rounded-lg"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-gray-300 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 dark:text-blue-100 mb-2">
          Export Data (GDPR)
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-200 mb-4">
          Download all your data in JSON format
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          Export Data
        </button>
      </div>
    </div>
  );
};
```

## Related Files

- [src/pages/Settings.tsx](../../src/pages/Settings.tsx) - Settings page
- [src/contexts/AuthContext.tsx](../../src/contexts/AuthContext.tsx) - Auth functions
- [src/hooks/use-notifications.ts](../../src/hooks/use-notifications.ts) - Notifications hook

## Next: Return to Main Flows

Go back to [User Flows Overview](./README.md)
