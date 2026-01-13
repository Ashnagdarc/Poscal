# Admin System Updates & Announcements Flow

## Overview
Admin panel for managing system updates, announcements, and platform-wide notifications.

## Flow Diagram

```
Admin user navigates to /admin/updates
    ↓
<ProtectedRoute> checks admin status
    ├─ YES ✅ → Show Admin Updates page
    └─ NO ❌ → Redirect to /
    ↓
AdminUpdates component loads
    ├─ Fetch all updates from database
    ├─ Fetch announcements
    ├─ Fetch system status
    └─ Display updates list
    ↓
Admin sees dashboard:
├─ System Status Card:
│  ├─ App Status (online/offline)
│  ├─ API Status
│  ├─ Database Status
│  ├─ WebSocket Status (Finnhub)
│  └─ Last checked
│
├─ Updates List:
│  ├─ Title
│  ├─ Version number
│  ├─ Release date
│  ├─ Status (draft/published/archived)
│  ├─ Users notified count
│  └─ Actions (edit, publish, delete)
│
├─ Announcements List:
│  ├─ Title
│  ├─ Message
│  ├─ Type (info/warning/critical)
│  ├─ Active (yes/no)
│  └─ Actions (edit, deactivate)
│
└─ Action Buttons:
   ├─ "Create Update"
   ├─ "Create Announcement"
   └─ "View Release History"
    ↓
OPTION 1: CREATE SYSTEM UPDATE
    ↓
    Admin clicks "Create Update"
        ↓
    Update form opens:
    ├─ Title (e.g., "v2.5.0 Released")
    ├─ Version number
    ├─ Features list
    ├─ Bug fixes list
    ├─ Breaking changes list
    ├─ Release notes (markdown)
    ├─ Changelog (markdown)
    ├─ Schedule publication date
    ├─ Notify users (toggle)
    │  ├─ Send email
    │  ├─ Send push notification
    │  └─ Show in-app banner
    ├─ Target audience:
    │  ├─ All users
    │  ├─ Specific role
    │  └─ Specific users
    └─ Publish button
        ↓
    Admin fills form
        ↓
    Click "Publish"
        ↓
    Frontend validation:
    ├─ Title required
    ├─ Version format valid (e.g., 2.5.0)
    ├─ Release date <= today (past)
    └─ At least 1 feature/bug
        ↓
    INSERT into updates table
    Columns:
    ├─ id
    ├─ title
    ├─ version
    ├─ release_date
    ├─ features (array)
    ├─ bug_fixes (array)
    ├─ breaking_changes (array)
    ├─ release_notes
    ├─ changelog
    ├─ status (published/draft/archived)
    ├─ created_by (admin_id)
    ├─ created_at
    └─ updated_at
        ↓
    Update published
        ↓
    If notify enabled:
    ├─ Queue push notifications
    ├─ Queue emails
    └─ Show in-app banner
        ↓
    Users see:
    ├─ In-app banner notification
    ├─ Email with release notes
    ├─ Push notification on mobile
    └─ Updates page shows new version
        ↓
OPTION 2: CREATE ANNOUNCEMENT
    ↓
    Admin clicks "Create Announcement"
        ↓
    Announcement form opens:
    ├─ Title
    ├─ Message (markdown)
    ├─ Type:
    │  ├─ info (blue)
    │  ├─ warning (yellow)
    │  ├─ critical (red)
    │  └─ success (green)
    ├─ Priority level
    ├─ Start date
    ├─ End date (expires)
    ├─ Display location:
    │  ├─ Top banner
    │  ├─ Modal popup
    │  └─ In-app notification
    ├─ Target audience
    ├─ Rich text editor
    └─ Publish button
        ↓
    Admin fills form
        ↓
    Click "Publish"
        ↓
    INSERT into announcements table
        ↓
    Announcement published
        ↓
    Live immediately on user dashboards
        ↓
    Example announcements:
    ├─ "Scheduled maintenance on Jan 15"
    ├─ "New feature released: Signal Templates"
    ├─ "WebSocket API upgraded"
    └─ "Trading halted for maintenance"
        ↓
OPTION 3: VIEW SYSTEM STATUS
    ↓
    Admin clicks "System Status"
        ↓
    Status dashboard shows:
    ├─ Overall health: ✅ Healthy
    ├─ Components:
    │  ├─ Frontend: ✅ Online
    │  ├─ API (Supabase): ✅ Online
    │  ├─ Database: ✅ Online
    │  ├─ Authentication: ✅ Working
    │  ├─ WebSocket (Finnhub): ✅ Connected
    │  ├─ Realtime: ✅ Broadcasting
    │  ├─ Storage: ✅ Available
    │  ├─ Email Service: ✅ Working
    │  └─ Push Notifications: ✅ Working
    │
    ├─ Metrics:
    │  ├─ API response time: 45ms
    │  ├─ Database queries: 150/sec
    │  ├─ Active users: 342
    │  ├─ Realtime connections: 1,245
    │  ├─ WebSocket uptime: 99.8%
    │  └─ Error rate: 0.02%
    │
    └─ Recent Incidents: (none)
        ↓
    Admin can:
    ├─ View detailed logs
    ├─ Check error rates
    ├─ Monitor API usage
    └─ View performance trends
        ↓
OPTION 4: VIEW RELEASE HISTORY
    ↓
    Admin clicks "Release History"
        ↓
    Timeline view shows:
    ├─ v2.5.0 (Jan 13, 2025) - Published
    │  ├─ Features: Signal Templates, Dashboard...
    │  ├─ Bug Fixes: Fixed price update lag...
    │  └─ Users notified: 1,234
    │
    ├─ v2.4.5 (Jan 10, 2025) - Published
    │  ├─ Bug fixes release
    │  └─ Users notified: 1,150
    │
    └─ v2.4.0 (Jan 1, 2025) - Archived
        ↓
    Admin can:
    ├─ Re-publish old version
    ├─ Edit release info
    ├─ Delete old announcements
    └─ View who read each update
        ↓
OPTION 5: MANAGE ANNOUNCEMENTS
    ↓
    Announcement list shows active announcements:
    ├─ [info] "New feature: Signal Templates" (Active)
    ├─ [warning] "Maintenance Jan 15 2-3am" (Active)
    ├─ [critical] "Security patch required" (Archived)
    └─ Actions: Edit, Deactivate, View Stats
        ↓
    Admin can:
    ├─ Edit announcement
    ├─ Deactivate (remove)
    ├─ Archive (hide from users)
    ├─ View statistics:
    │  ├─ Views count
    │  ├─ Click-through rate
    │  ├─ User segments seen
    │  └─ Read by users
    └─ Republish if needed
        ↓
OPTION 6: SCHEDULE UPDATES
    ↓
    Admin creates update for future release
        ↓
    Set "Schedule publication" date
        ↓
    Update saved as "scheduled"
        ↓
    System automatically publishes at scheduled time
        ↓
    Notifications sent automatically
        ↓
    Users see update notification
        ↓
OPTION 7: MAINTENANCE MODE
    ↓
    Admin needs to put app in maintenance
        ↓
    Go to System Settings
        ↓
    Toggle "Maintenance Mode"
        ↓
    Set message:
    "We're performing scheduled maintenance.
     Expected downtime: 2 hours (until 3:00 AM UTC)"
        ↓
    All users see:
    ├─ App locked except admin
    ├─ Maintenance banner
    ├─ Estimated time
    └─ Support contact info
        ↓
    Admin performs maintenance
        ↓
    Toggle off maintenance mode
        ↓
    App returns to normal
        ↓
    Users notified automatically
```

## Step-by-Step Process

### 1. Load Updates Page

**File:** `src/pages/AdminUpdates.tsx`

```typescript
const AdminUpdates = () => {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Load updates
      const { data: updatesData } = await supabase
        .from('updates')
        .select('*')
        .order('release_date', { ascending: false });

      // Load announcements
      const { data: announcementsData } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true);

      // Load system status
      const { data: statusData } = await supabase
        .from('system_status')
        .select('*')
        .single();

      setUpdates(updatesData || []);
      setAnnouncements(announcementsData || []);
      setStatus(statusData);
      setLoading(false);
    };

    loadData();
  }, []);

  return (
    <div className="pb-24">
      {/* System Status Card */}
      <SystemStatusCard status={status} />

      {/* Create Buttons */}
      <div className="flex gap-2 px-4 mb-6">
        <button className="flex-1 bg-foreground text-background py-2 rounded-lg">
          Create Update
        </button>
        <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg">
          Create Announcement
        </button>
      </div>

      {/* Updates List */}
      <div className="px-4 space-y-3">
        <h2 className="text-lg font-semibold">Recent Updates</h2>
        {updates.map(update => (
          <UpdateCard key={update.id} update={update} />
        ))}
      </div>

      {/* Announcements List */}
      <div className="px-4 mt-6 space-y-3">
        <h2 className="text-lg font-semibold">Active Announcements</h2>
        {announcements.map(announcement => (
          <AnnouncementCard key={announcement.id} announcement={announcement} />
        ))}
      </div>
    </div>
  );
};
```

### 2. Create Update Form

```typescript
const CreateUpdateModal = ({ onClose }: { onClose: () => void }) => {
  const [formData, setFormData] = useState({
    title: '',
    version: '',
    releaseDate: new Date(),
    features: [''],
    bugFixes: [''],
    releaseNotes: '',
    notifyUsers: true,
    sendEmail: true,
    sendPush: true,
  });

  const handleSubmit = async () => {
    // Validation
    if (!formData.title || !formData.version) {
      toast.error("Title and version required");
      return;
    }

    const { error } = await supabase
      .from('updates')
      .insert({
        title: formData.title,
        version: formData.version,
        release_date: formData.releaseDate,
        features: formData.features.filter(f => f),
        bug_fixes: formData.bugFixes.filter(b => b),
        release_notes: formData.releaseNotes,
        status: 'published',
        created_by: user.id,
      });

    if (error) {
      toast.error("Failed to create update");
      return;
    }

    // Queue notifications if enabled
    if (formData.notifyUsers) {
      await queueUpdateNotifications({
        updateId: error ? null : 'new-id',
        sendEmail: formData.sendEmail,
        sendPush: formData.sendPush,
      });
    }

    toast.success("Update published!");
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Update title"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        />

        <input
          type="text"
          placeholder="Version (e.g., 2.5.0)"
          value={formData.version}
          onChange={(e) => setFormData({...formData, version: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg"
        />

        <textarea
          placeholder="Release notes (markdown)"
          value={formData.releaseNotes}
          onChange={(e) => setFormData({...formData, releaseNotes: e.target.value})}
          className="w-full px-3 py-2 border rounded-lg h-32"
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.notifyUsers}
            onChange={(e) => setFormData({...formData, notifyUsers: e.target.checked})}
          />
          <label>Notify users</label>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-foreground text-background py-2 rounded-lg"
        >
          Publish Update
        </button>
      </div>
    </Modal>
  );
};
```

### 3. System Status Card

```typescript
const SystemStatusCard = ({ status }: { status: SystemStatus | null }) => {
  if (!status) return null;

  const getHealthColor = (healthy: boolean) => {
    return healthy ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="mx-4 mb-6 bg-secondary rounded-lg p-4">
      <h3 className="font-semibold mb-3">System Status</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Overall:</span>
          <span className={getHealthColor(status.healthy)}>
            {status.healthy ? '✅ Healthy' : '❌ Issues'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>API:</span>
          <span className={getHealthColor(status.api_healthy)}>
            {status.api_healthy ? '✅ Online' : '❌ Offline'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>WebSocket:</span>
          <span className={getHealthColor(status.websocket_connected)}>
            {status.websocket_connected ? '✅ Connected' : '❌ Disconnected'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Database:</span>
          <span className={getHealthColor(status.db_healthy)}>
            {status.db_healthy ? '✅ Online' : '❌ Offline'}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Last checked: {format(parseISO(status.last_check), 'HH:mm:ss')}
        </p>
      </div>
    </div>
  );
};
```

## Update Fields

| Field | Type | Required | Example |
|-------|------|----------|---------|
| title | text | ✅ | v2.5.0 Released |
| version | text | ✅ | 2.5.0 |
| release_date | timestamp | ✅ | 2025-01-13 |
| features | array | ✅ | ["Signal Templates", "Improved UI"] |
| bug_fixes | array | ✅ | ["Fixed price lag", "Fixed RLS error"] |
| release_notes | text | ✅ | Detailed release information |
| status | enum | ✅ | published, draft, archived |
| created_by | UUID | ✅ | admin_user_id |
| users_notified | integer | ❌ | 1234 |

## Related Files

- [src/pages/AdminUpdates.tsx](../../src/pages/AdminUpdates.tsx) - Admin updates page
- [Database migrations](../../supabase/migrations/) - Schema for updates/announcements

## Next: Back to Admin Flows

Go back to [Admin Flows Overview](./README.md)
