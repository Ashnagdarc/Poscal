# Admin Platform Monitoring & Analytics Flow

## Overview
Admin monitoring dashboard for tracking system health, user metrics, and platform performance.

## Flow Diagram

```
Admin navigates to /admin/analytics
    ↓
Admin Analytics Dashboard loads
    ├─ Fetch real-time metrics
    ├─ Fetch user statistics
    ├─ Fetch trading statistics
    ├─ Fetch system performance data
    └─ Display dashboards
    ↓
Admin sees multiple sections:
├─ REAL-TIME METRICS
│  ├─ Active users online
│  ├─ Active WebSocket connections
│  ├─ API requests/sec
│  ├─ Database queries/sec
│  └─ Error rate %
│
├─ USER STATISTICS
│  ├─ Total users
│  ├─ New users (today/week/month)
│  ├─ Active users (24h/7d/30d)
│  ├─ User growth chart
│  ├─ Users by experience level
│  └─ Churn rate
│
├─ TRADING STATISTICS
│  ├─ Total trades
│  ├─ Trades today
│  ├─ Win rate (all users)
│  ├─ Average trade P&L
│  ├─ Total signals created
│  ├─ Popular currency pairs
│  ├─ Trading volume chart
│  └─ Most active traders
│
├─ PLATFORM PERFORMANCE
│  ├─ API response time (ms)
│  ├─ Database query time (ms)
│  ├─ WebSocket uptime %
│  ├─ Error rate
│  ├─ 99th percentile latency
│  └─ Performance trend graphs
│
└─ REVENUE ANALYTICS (if applicable)
   ├─ Subscription revenue
   ├─ Payment methods
   ├─ Refunds
   ├─ Chargeback rate
   └─ MRR trend
    ↓
OPTION 1: VIEW USER INSIGHTS
    ↓
    Admin clicks "User Insights"
        ↓
    Detailed user analytics dashboard:
    ├─ User acquisition funnel
    │  ├─ Signup page views
    │  ├─ Signup starts
    │  ├─ Completed signups
    │  ├─ Email verified
    │  └─ Conversion rate
    │
    ├─ User engagement
    │  ├─ DAU (Daily Active Users)
    │  ├─ MAU (Monthly Active Users)
    │  ├─ Feature usage:
    │  │  ├─ Signals: 456 users
    │  │  ├─ Journal: 789 users
    │  │  ├─ Calculator: 1,234 users
    │  │  └─ Settings: 567 users
    │  └─ Session duration (avg)
    │
    ├─ User retention
    │  ├─ Day 1 retention: 45%
    │  ├─ Day 7 retention: 28%
    │  ├─ Day 30 retention: 18%
    │  └─ Cohort analysis chart
    │
    └─ Geographic distribution
        ├─ Users by country
        ├─ Top regions
        └─ Map visualization
        ↓
OPTION 2: VIEW TRADING INSIGHTS
    ↓
    Admin clicks "Trading Insights"
        ↓
    Trading analytics dashboard:
    ├─ Trading volume
    │  ├─ Trades per day (chart)
    │  ├─ Signals per day (chart)
    │  ├─ Avg trades per user
    │  └─ Total P&L (all users)
    │
    ├─ Trading statistics
    │  ├─ Win rate (all trades)
    │  ├─ Average win ($)
    │  ├─ Average loss ($)
    │  ├─ Profit factor
    │  ├─ Most traded pair: EUR/USD
    │  └─ Least traded pair
    │
    ├─ Top traders
    │  ├─ Most profitable
    │  ├─ Highest win rate
    │  ├─ Most active
    │  └─ Leaderboard
    │
    └─ Risk metrics
        ├─ Avg risk per trade
        ├─ Max drawdown (users)
        └─ Risk/Reward ratios
        ↓
OPTION 3: VIEW SYSTEM HEALTH
    ↓
    Admin clicks "System Health"
        ↓
    System monitoring dashboard:
    ├─ Component status
    │  ├─ Frontend: ✅ Online
    │  ├─ API: ✅ Online
    │  ├─ Database: ✅ Online
    │  ├─ WebSocket: ✅ Connected
    │  ├─ Email: ✅ Working
    │  └─ Storage: ✅ Available
    │
    ├─ Performance metrics (real-time)
    │  ├─ API response time: 45ms (avg)
    │  ├─ Database query: 8ms (avg)
    │  ├─ WebSocket latency: 120ms (avg)
    │  ├─ Requests/sec: 156
    │  ├─ Database QPS: 450
    │  └─ Error rate: 0.02%
    │
    ├─ Resource usage
    │  ├─ CPU usage: 23%
    │  ├─ Memory usage: 47%
    │  ├─ Storage: 2.3GB / 10GB
    │  ├─ Bandwidth: 1.2Mbps
    │  └─ Concurrent connections: 342
    │
    └─ Alerts
        ├─ No critical alerts
        ├─ 1 warning: High error rate
        └─ View alert history
        ↓
OPTION 4: VIEW ERROR LOGS
    ↓
    Admin clicks "Error Logs"
        ↓
    Error monitoring dashboard:
    ├─ Error rate graph (time-based)
    ├─ Top errors:
    │  ├─ "Token expired" - 42 occurrences
    │  ├─ "Price update failed" - 18 occurrences
    │  ├─ "Database timeout" - 5 occurrences
    │  └─ Other errors: 12
    │
    ├─ Error filtering:
    │  ├─ By type (API, Database, Client, etc.)
    │  ├─ By severity
    │  ├─ By time range
    │  └─ By user
    │
    └─ View error details
        ├─ Stack trace
        ├─ User info
        ├─ Request details
        ├─ Browser/device
        └─ Timestamp
        ↓
OPTION 5: EXPORT ANALYTICS
    ↓
    Admin clicks "Export Report"
        ↓
    Report options:
    ├─ Date range selection
    ├─ Metrics to include
    ├─ Format selection (PDF/CSV/Excel)
    └─ Generate button
        ↓
    Click "Generate"
        ↓
    System generates report
        ↓
    Download PDF/Excel file
        ↓
    Can be shared with team/stakeholders
        ↓
OPTION 6: SET UP ALERTS
    ↓
    Admin clicks "Alert Settings"
        ↓
    Configure alert thresholds:
    ├─ Error rate > 1%: Alert
    ├─ API response > 500ms: Alert
    ├─ Database down: Critical Alert
    ├─ WebSocket disconnected: Critical Alert
    ├─ Storage > 80%: Warning
    └─ Save settings
        ↓
    Alerts configured
        ↓
    Admin notified when triggered:
    ├─ Email notification
    ├─ Slack notification (if connected)
    └─ In-app alert banner
```

## Step-by-Step Process

### 1. Load Analytics Dashboard

**File:** `src/pages/AdminAnalytics.tsx` (or in AccountPerformanceDashboard for admins)

```typescript
const AdminAnalytics = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [tradingStats, setTradingStats] = useState<TradingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      // Get real-time metrics
      const { data: metricsData } = await supabase
        .from('system_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      // Get user statistics
      const { data: users } = await supabase
        .from('users')
        .select('id, created_at, last_login_at')
        .eq('deleted_at', null);

      // Get trading statistics
      const { data: trades } = await supabase
        .from('trades')
        .select('profit_loss, status');

      // Calculate statistics
      const userStats = calculateUserStats(users);
      const tradingStats = calculateTradingStats(trades);

      setMetrics(metricsData);
      setUserStats(userStats);
      setTradingStats(tradingStats);
      setLoading(false);
    };

    loadAnalytics();

    // Subscribe to real-time metric updates
    const metricsChannel = supabase
      .channel('metrics')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_metrics',
        },
        (payload) => {
          setMetrics(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(metricsChannel);
    };
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="pb-24">
      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 gap-3 px-4 mb-6">
        <MetricCard 
          label="Active Users" 
          value={metrics?.active_users} 
          icon="👥"
        />
        <MetricCard 
          label="API Health" 
          value={metrics?.api_health === 'ok' ? '✅' : '❌'} 
          icon="🔌"
        />
      </div>

      {/* User Stats */}
      <div className="px-4 mb-6">
        <h3 className="font-semibold mb-3">User Statistics</h3>
        <UserStatsChart stats={userStats} />
      </div>

      {/* Trading Stats */}
      <div className="px-4 mb-6">
        <h3 className="font-semibold mb-3">Trading Statistics</h3>
        <TradingStatsChart stats={tradingStats} />
      </div>

      {/* System Health */}
      <div className="px-4">
        <h3 className="font-semibold mb-3">System Health</h3>
        <SystemHealthChart metrics={metrics} />
      </div>
    </div>
  );
};
```

### 2. Calculate User Statistics

```typescript
const calculateUserStats = (users: User[]) => {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const sevenDays = 7 * oneDay;
  const thirtyDays = 30 * oneDay;

  const newUsersToday = users.filter(
    u => new Date(u.created_at).getTime() > now.getTime() - oneDay
  ).length;

  const newUsersWeek = users.filter(
    u => new Date(u.created_at).getTime() > now.getTime() - sevenDays
  ).length;

  const activeToday = users.filter(
    u => new Date(u.last_login_at || 0).getTime() > now.getTime() - oneDay
  ).length;

  return {
    totalUsers: users.length,
    newUsersToday,
    newUsersWeek,
    activeToday,
    activeLastMonth: users.filter(
      u => new Date(u.last_login_at || 0).getTime() > now.getTime() - thirtyDays
    ).length,
  };
};

const calculateTradingStats = (trades: Trade[]) => {
  const closedTrades = trades.filter(t => t.status === 'closed');
  const wins = closedTrades.filter(t => t.profit_loss > 0);
  const losses = closedTrades.filter(t => t.profit_loss < 0);

  const totalProfit = wins.reduce((sum, t) => sum + t.profit_loss, 0);
  const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit_loss, 0));

  return {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length > 0 
      ? ((wins.length / closedTrades.length) * 100).toFixed(2)
      : 0,
    totalProfit,
    totalLoss,
    profitFactor: totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : '∞',
  };
};
```

### 3. Metric Card Component

```typescript
const MetricCard = ({ label, value, icon }: MetricCardProps) => {
  return (
    <div className="bg-secondary rounded-lg p-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
};
```

## Key Metrics to Track

| Metric | Type | Target | Action if Low |
|--------|------|--------|---|
| DAU (Daily Active Users) | User | Growing | Marketing push |
| MAU (Monthly Active Users) | User | Growing | Feature improvements |
| Day 1 Retention | % | > 40% | Improve onboarding |
| Day 7 Retention | % | > 25% | Feature development |
| Win Rate (Trading) | % | > 50% | Trading education |
| API Uptime | % | > 99.9% | Infrastructure review |
| Error Rate | % | < 0.1% | Debug & fix |
| Response Time | ms | < 200ms | Optimization |

## Related Files

- [src/pages/AdminAnalytics.tsx](../../src/pages/AdminAnalytics.tsx) - Analytics page
- [src/components/AccountPerformanceDashboard.tsx](../../src/components/AccountPerformanceDashboard.tsx) - Dashboard component
- [Database schema](../../supabase/migrations/) - Metrics tables

## Next: Back to Admin Flows

Go back to [Admin Flows Overview](./README.md)
