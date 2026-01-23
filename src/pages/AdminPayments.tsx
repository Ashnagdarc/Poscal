import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Wallet, BarChart3, Calendar, FileDown, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/BottomNav';
import { useAdmin } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  tier?: string;
  paystack_reference?: string;
  subscription_start?: string;
  subscription_end?: string;
  created_at?: string;
  profile?: {
    email?: string | null;
    full_name?: string | null;
  } | null;
}

interface StatsResponse {
  success: boolean;
  data?: {
    range: { startDate: string; endDate: string };
    totals: { totalRevenue: number; paidUsersCount: number; freeUsersCount: number; totalUsersCount: number };
    monthlyBreakdown: Record<string, number>;
    recentPayments: Payment[];
    pagination: { page: number; pageSize: number; total: number };
  };
  message?: string;
}

const dateToISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();

const AdminPayments = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();

  const [rangePreset, setRangePreset] = useState<'30d' | '90d' | 'month'>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'success' | 'failed' | 'pending' | 'all'>('success');
  const [tierFilter, setTierFilter] = useState<'all' | 'premium' | 'pro'>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState<'created_at' | 'amount' | 'status'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const computeRange = () => {
    const now = new Date();
    if (rangePreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: dateToISO(start), endDate: dateToISO(end) };
    }
    const days = rangePreset === '90d' ? 90 : 30;
    const start = new Date();
    start.setDate(now.getDate() - days);
    return { startDate: dateToISO(start), endDate: dateToISO(now) };
  };

  const currentRange = useMemo(() => {
    if (customStart && customEnd) return { startDate: new Date(customStart).toISOString(), endDate: new Date(customEnd).toISOString() };
    return computeRange();
  }, [rangePreset, customStart, customEnd]);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  const { data, isLoading, refetch } = useQuery<StatsResponse>({
    queryKey: ['payment-stats', currentRange, statusFilter, tierFilter, page, pageSize, sortBy, sortDir],
    queryFn: async () => {
      const url = `${apiBaseUrl}/api/payment-stats?startDate=${encodeURIComponent(currentRange.startDate)}&endDate=${encodeURIComponent(currentRange.endDate)}&status=${statusFilter}&tier=${tierFilter}&page=${page}&pageSize=${pageSize}&sortBy=${sortBy}&sortDir=${sortDir}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to fetch stats');
      return r.json();
    },
  });

  const totals = data?.data?.totals;
  const monthly = data?.data?.monthlyBreakdown || {};
  const recentPayments = data?.data?.recentPayments || [];
  const pagination = data?.data?.pagination;

  const monthlyEntries = useMemo(() => {
    return Object.entries(monthly)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => new Date(`${a.month}-01`).getTime() - new Date(`${b.month}-01`).getTime());
  }, [monthly]);

  const maxMonthlyValue = monthlyEntries.reduce((max, m) => Math.max(max, m.value), 0) || 1;

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  const exportCSV = () => {
    if (!recentPayments.length) {
      toast.info('No payments to export');
      return;
    }
    const headers = ['Date','User ID','Tier','Amount','Currency','Status','Reference'];
    const rows = recentPayments.map(p => [
      p.created_at || p.subscription_start || '',
      p.user_id,
      p.tier || '',
      (p.amount ?? 0).toString(),
      p.currency || '',
      p.status || '',
      p.paystack_reference || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 bg-secondary/80 rounded-xl flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Payments</h1>
              <p className="text-sm text-muted-foreground">Admins only</p>
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Access denied</p>
              <p className="text-sm text-muted-foreground">You need admin privileges to view payment stats.</p>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-secondary/80 rounded-xl flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Payments Dashboard</h1>
            <p className="text-sm text-muted-foreground">Revenue, subscriptions, and recent payments</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 animate-slide-up">
        {/* Filters */}
        <section className="bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border/50 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Date Range</span>
            </div>
            <Select value={rangePreset} onValueChange={(v) => { setRangePreset(v as any); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-40" />
              <span className="text-muted-foreground">to</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-40" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v as any); setPage(1); }}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setPage(1); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); setPage(1); }}>
              {sortDir === 'asc' ? 'Asc ↑' : 'Desc ↓'}
            </Button>
            <Button variant="default" onClick={() => refetch()} disabled={isLoading}>
              Refresh
            </Button>
            <Button variant="outline" onClick={exportCSV}>
              <FileDown className="w-4 h-4 mr-2" /> Export CSV
            </Button>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">₦{(totals?.totalRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Paid Users</span>
            </div>
            <p className="text-2xl font-bold">{totals?.paidUsersCount ?? 0}</p>
          </div>
          <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Free Users</span>
            </div>
            <p className="text-2xl font-bold">{totals?.freeUsersCount ?? 0}</p>
          </div>
          <div className="bg-secondary/50 rounded-2xl border border-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Users</span>
            </div>
            <p className="text-2xl font-bold">{totals?.totalUsersCount ?? 0}</p>
          </div>
        </section>

        {/* Monthly Breakdown */}
        <section className="bg-secondary/50 rounded-2xl border border-border/50 p-4">
          <h2 className="text-sm font-semibold mb-2">Monthly Revenue</h2>
          <div className="flex items-end gap-3 h-48 overflow-x-auto pb-3">
            {monthlyEntries.map(({ month, value }) => {
              const height = Math.max(8, (value / maxMonthlyValue) * 100);
              return (
                <div key={month} className="flex flex-col items-center gap-2 min-w-[72px]">
                  <div
                    className="w-full rounded-md bg-gradient-to-t from-primary/20 via-primary/40 to-primary"
                    style={{ height: `${height}%` }}
                    title={`₦${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  />
                  <span className="text-xs text-muted-foreground">{month}</span>
                  <span className="text-xs font-semibold">₦{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              );
            })}
            {!monthlyEntries.length && (
              <p className="text-sm text-muted-foreground">No monthly data</p>
            )}
          </div>
        </section>

        {/* Recent Payments */}
        <section className="bg-secondary/50 rounded-2xl border border-border/50 p-4">
          <h2 className="text-sm font-semibold mb-3">Recent Payments</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 pr-4">User</th>
                  <th className="text-left py-2 pr-4">Email</th>
                  <th className="text-left py-2 pr-4">Tier</th>
                  <th className="text-left py-2 pr-4">Amount</th>
                  <th className="text-left py-2 pr-4">Currency</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  <th className="text-left py-2 pr-4">Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id} className="border-t border-border/50">
                    <td className="py-2 pr-4">{(p.created_at || p.subscription_start || '').replace('T', ' ').slice(0,19)}</td>
                    <td className="py-2 pr-4">{p.profile?.full_name || p.user_id}</td>
                    <td className="py-2 pr-4">{p.profile?.email || '-'}</td>
                    <td className="py-2 pr-4">{p.tier || '-'}</td>
                    <td className="py-2 pr-4">₦{(p.amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="py-2 pr-4">{p.currency}</td>
                    <td className="py-2 pr-4">{p.status}</td>
                    <td className="py-2 pr-4">{p.paystack_reference || '-'}</td>
                  </tr>
                ))}
                {!recentPayments.length && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">No payments found for this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default AdminPayments;
