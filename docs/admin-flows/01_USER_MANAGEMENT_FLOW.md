# Admin User Management Flow

## Overview
Admin panel for managing application users, viewing user details, and handling user-related operations.

## Flow Diagram

```
Admin user navigates to /admin/users
    ↓
<ProtectedRoute> checks:
├─ Is user authenticated? 
├─ Is user admin?
└─ YES ✅ → Show User Management page
           NO ❌ → Redirect to /
    ↓
AdminUsersTab component loads
    ├─ Fetch all users from database
    ├─ Load user statistics
    ├─ Initialize real-time subscriptions
    └─ Render users list
    ↓
Admin sees:
├─ Total users count
├─ Active users count
├─ Users table with columns:
│  ├─ User ID
│  ├─ Email
│  ├─ Full Name
│  ├─ Account Type
│  ├─ Join Date
│  ├─ Last Login
│  ├─ Trading Accounts (count)
│  ├─ Status (active/suspended)
│  └─ Actions (view, edit, suspend, delete)
│
├─ Filters:
│  ├─ By status (active/suspended/all)
│  ├─ By join date
│  ├─ By last login
│  └─ Search by email/name
│
├─ Sorting options
└─ Pagination
    ↓
OPTION 1: VIEW USER DETAILS
    ↓
    Admin clicks user row
        ↓
    User detail modal opens
        ├─ User ID
        ├─ Email
        ├─ Full name
        ├─ Account type (regular/admin)
        ├─ Trading accounts (list)
        ├─ Total trades
        ├─ Account balance
        ├─ Join date
        ├─ Last login
        ├─ Email verified
        ├─ 2FA enabled
        └─ Action buttons
        ↓
    Admin can:
    ├─ View trading accounts
    ├─ View trade history
    ├─ View journal entries
    └─ Export user data
        ↓
OPTION 2: SUSPEND/UNSUSPEND USER
    ↓
    Admin clicks "Suspend" action
        ↓
    Confirmation modal:
    "Suspend user? They won't be able to access the app."
        ↓
    If confirmed:
    ├─ UPDATE users table
    │  SET status = 'suspended'
    │  WHERE user_id = X
    │
    └─ UPDATE sessions (logout all)
        ├─ Invalidate all JWT tokens
        └─ Force re-login
        ↓
    User sees: "Account suspended. Contact support."
        ↓
    Admin can unsuspend anytime
        ↓
OPTION 3: DELETE USER
    ↓
    Admin clicks "Delete" action
        ↓
    Confirmation dialog (multiple confirmations)
        ├─ "Delete user?"
        ├─ "Are you sure? Irreversible."
        ├─ Type user email to confirm
        └─ Final confirmation
        ↓
    If confirmed:
    ├─ Export user data (GDPR compliance)
    ├─ Hard delete or soft delete
    │  ├─ Soft: Mark as deleted, retain data
    │  └─ Hard: Remove all records
    ├─ Delete trades
    ├─ Delete signals
    ├─ Delete accounts
    └─ Delete auth user
        ↓
    User permanently removed
        ↓
OPTION 4: SEND MESSAGE TO USER
    ↓
    Admin clicks "Send Message"
        ↓
    Message form opens
        ├─ Subject
        ├─ Message body
        ├─ Send as email
        ├─ Send as in-app notification
        └─ Send button
        ↓
    Click "Send"
        ↓
    Email sent to user
        ↓
    In-app notification queued
        ↓
    Message logged in admin panel
        ↓
OPTION 5: EXPORT USER DATA
    ↓
    Admin clicks "Export Data"
        ↓
    System generates JSON:
    ├─ User profile
    ├─ All trades
    ├─ All signals
    ├─ All accounts
    ├─ Settings
    └─ Audit trail
        ↓
    File downloaded (GDPR compliant)
        ↓
    User can be notified
```

## Step-by-Step Process

### 1. Admin Access Check

**File:** `src/hooks/use-admin.ts`

```typescript
export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    // Check if user is admin
    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(data?.role === 'admin');
      setLoading(false);
    };

    checkAdmin();
  }, [user]);

  return { isAdmin, loading };
};
```

### 2. Protected Admin Route

**File:** `src/components/ProtectedRoute.tsx`

```typescript
export const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (loading || adminLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;  // Not admin, go to home
  }

  return <>{children}</>;
};

// Usage in routes:
<Route 
  path="/admin/users" 
  element={
    <ProtectedRoute adminOnly={true}>
      <UserManagement />
    </ProtectedRoute>
  } 
/>
```

### 3. Load Users List

**File:** `src/pages/UserManagement.tsx`

```typescript
const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    sortBy: 'createdAt',
    searchTerm: '',
  });

  useEffect(() => {
    if (!user) return;

    const loadUsers = async () => {
      let query = supabase
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          status,
          created_at,
          last_login_at,
          trading_accounts(count),
          trades(count)
        `);

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.searchTerm) {
        query = query.or(`email.ilike.%${filters.searchTerm}%,full_name.ilike.%${filters.searchTerm}%`);
      }

      // Apply sorting
      query = query.order(filters.sortBy, { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error loading users:', error);
        return;
      }

      setUsers(data || []);
      setLoading(false);
    };

    loadUsers();
  }, [user, filters]);

  return (
    <div className="pb-24">
      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-6">
        <StatCard 
          label="Total Users" 
          value={users.length} 
        />
        <StatCard 
          label="Active" 
          value={users.filter(u => u.status === 'active').length} 
        />
      </div>

      {/* Filters */}
      <div className="px-4 mb-6 space-y-3">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={filters.searchTerm}
          onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        />
        
        <select
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="px-4 space-y-3">
        {users.map(userItem => (
          <UserRow 
            key={userItem.id} 
            user={userItem}
            onAction={() => loadUsers()}
          />
        ))}
      </div>
    </div>
  );
};
```

### 4. User Row with Actions

```typescript
const UserRow = ({ user, onAction }: { user: User, onAction: () => void }) => {
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState<'view' | 'suspend' | 'delete' | null>(null);

  const handleSuspend = async () => {
    const { error } = await supabase
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', user.id);

    if (error) {
      toast.error("Failed to suspend user");
      return;
    }

    toast.success("User suspended");
    setShowModal(false);
    onAction();  // Refresh list
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .rpc('delete_user', { user_id: user.id });

    if (error) {
      toast.error("Failed to delete user");
      return;
    }

    toast.success("User deleted");
    setShowModal(false);
    onAction();
  };

  return (
    <>
      <div className="bg-secondary rounded-lg p-4 flex justify-between items-center">
        <div>
          <p className="font-medium">{user.full_name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs mt-1">
            Joined: {format(parseISO(user.created_at), 'MMM dd, yyyy')}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAction('view');
              setShowModal(true);
            }}
            className="px-3 py-1 bg-foreground text-background rounded text-sm"
          >
            View
          </button>
          <button
            onClick={() => {
              setAction('suspend');
              setShowModal(true);
            }}
            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm"
          >
            {user.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
          </button>
          <button
            onClick={() => {
              setAction('delete');
              setShowModal(true);
            }}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      {showModal && (
        <UserActionModal
          action={action}
          user={user}
          onConfirm={action === 'suspend' ? handleSuspend : handleDelete}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};
```

## Admin User Fields

| Field | Type | Editable | Example |
|-------|------|----------|---------|
| id | UUID | ❌ | uuid |
| email | text | ❌ | user@example.com |
| full_name | text | ✅ | John Doe |
| role | enum | ✅ | admin, user |
| status | enum | ✅ | active, suspended, deleted |
| created_at | timestamp | ❌ | 2025-01-13 |
| last_login_at | timestamp | ❌ | 2025-01-13 14:30 |
| email_verified | boolean | ❌ | true |
| 2fa_enabled | boolean | ✅ | false |

## Real-Time Updates

```typescript
// Subscribe to users changes
const usersChannel = supabase
  .channel('users')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'users',
    },
    (payload) => {
      const { eventType, new: newUser } = payload;

      if (eventType === 'INSERT') {
        setUsers(prev => [newUser, ...prev]);
      } else if (eventType === 'UPDATE') {
        setUsers(prev =>
          prev.map(u => u.id === newUser.id ? newUser : u)
        );
      } else if (eventType === 'DELETE') {
        setUsers(prev => prev.filter(u => u.id !== newUser.id));
      }
    }
  )
  .subscribe();
```

## Related Files

- [src/pages/UserManagement.tsx](../../src/pages/UserManagement.tsx) - User management page
- [src/components/AdminUsersTab.tsx](../../src/components/AdminUsersTab.tsx) - Users tab
- [src/hooks/use-admin.ts](../../src/hooks/use-admin.ts) - Admin check hook

## Next: System Updates

View system updates → [Admin Updates Flow](./02_ADMIN_UPDATES_FLOW.md)
