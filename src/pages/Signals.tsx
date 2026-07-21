import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Radio,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { CreateSignalModal } from '@/components/CreateSignalModal';
import { PageHeader } from '@/components/PageHeader';
import { UpdateSignalModal } from '@/components/UpdateSignalModal';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdmin } from '@/hooks/use-admin';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { signalsApi } from '@/lib/api';
import { logger } from '@/lib/logger';

type SignalOrderType = 'buy' | 'sell' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
type SignalStatus = 'active' | 'hit_tp' | 'hit_sl' | 'cancelled';
type StatusFilter = 'all' | SignalStatus;

interface TradingSignal {
  id: string;
  currency_pair: string;
  order_type: SignalOrderType;
  direction?: 'buy' | 'sell';
  entry_price: number | string | null;
  stop_loss: number | string;
  take_profit_1: number | string;
  take_profit_2: number | string | null;
  take_profit_3: number | string | null;
  status: SignalStatus;
  created_at: string;
}

const SIGNALS_PER_PAGE = 8;
const FREE_SIGNALS_LIMIT = 3;

const ORDER_TYPE_LABELS: Record<SignalOrderType, string> = {
  buy: 'Buy',
  sell: 'Sell',
  buy_limit: 'Buy Limit',
  sell_limit: 'Sell Limit',
  buy_stop: 'Buy Stop',
  sell_stop: 'Sell Stop',
};

const STATUS_LABELS: Record<SignalStatus, string> = {
  active: 'Active',
  hit_tp: 'Hit TP',
  hit_sl: 'Hit SL',
  cancelled: 'Cancelled',
};

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'hit_tp', label: 'Hit TP' },
  { id: 'hit_sl', label: 'Hit SL' },
  { id: 'cancelled', label: 'Cancelled' },
];

const getOrderTone = (orderType: SignalOrderType) =>
  orderType.startsWith('sell')
    ? 'text-red-700 dark:text-red-400 bg-red-500/15'
    : 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/15';

const getStatusClass = (status: SignalStatus) => {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400';
    case 'hit_tp':
      return 'border-blue-500/30 bg-blue-500/20 text-blue-700 dark:text-blue-400';
    case 'hit_sl':
      return 'border-red-500/30 bg-red-500/20 text-red-700 dark:text-red-400';
    case 'cancelled':
      return 'border-muted bg-muted text-muted-foreground';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
};

const formatPrice = (price: number | string | null | undefined): string => {
  if (price === null || price === undefined || price === '') return '—';
  const numPrice = typeof price === 'string' ? Number.parseFloat(price) : price;
  if (!Number.isFinite(numPrice)) return '—';
  return numPrice.toLocaleString('en-US', {
    minimumFractionDigits: numPrice >= 100 ? 2 : 4,
    maximumFractionDigits: numPrice >= 100 ? 2 : 5,
  });
};

const getPrimaryTakeProfit = (signal: TradingSignal) =>
  signal.take_profit_1 ?? signal.take_profit_2 ?? signal.take_profit_3;

const buildCalculatorUrl = (signal: TradingSignal) => {
  const params = new URLSearchParams();
  params.set('fromSignal', 'true');
  params.set('symbol', signal.currency_pair);
  if (signal.entry_price !== null && signal.entry_price !== '') {
    params.set('entry', String(signal.entry_price));
  }
  params.set('stopLoss', String(signal.stop_loss));
  params.set('takeProfit', String(getPrimaryTakeProfit(signal) ?? ''));
  params.set('orderType', signal.order_type);

  return `/calculator?${params.toString()}`;
};

const Signals = () => {
  const { isAdmin } = useAdmin();
  const { isPaid } = useSubscription();
  const navigate = useNavigate();
  const [allSignals, setAllSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    () => new Set([new Date().toISOString().split('T')[0]]),
  );
  const [dismissLimitBanner, setDismissLimitBanner] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await signalsApi.getAll({
        status: statusFilter,
        date: dateFilter,
      });
      setAllSignals(data || []);
    } catch (err) {
      logger.error('Error fetching signals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch signals');
      setAllSignals([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    void fetchSignals();
  }, [fetchSignals]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateFilter]);

  const stats = useMemo(() => ({
    total: allSignals.length,
    active: allSignals.filter((signal) => signal.status === 'active').length,
    hitTp: allSignals.filter((signal) => signal.status === 'hit_tp').length,
    hitSl: allSignals.filter((signal) => signal.status === 'hit_sl').length,
  }), [allSignals]);

  const visibleSignals = useMemo(() => {
    const limited = !isPaid && !isAdmin
      ? allSignals.slice(0, FREE_SIGNALS_LIMIT)
      : allSignals;
    const from = (currentPage - 1) * SIGNALS_PER_PAGE;
    return limited.slice(from, from + SIGNALS_PER_PAGE);
  }, [allSignals, isPaid, isAdmin, currentPage]);

  const visibleTotal = !isPaid && !isAdmin
    ? Math.min(allSignals.length, FREE_SIGNALS_LIMIT)
    : allSignals.length;

  const totalPages = Math.max(1, Math.ceil(visibleTotal / SIGNALS_PER_PAGE));
  const isAtSignalLimit = !isPaid && !isAdmin && allSignals.length >= FREE_SIGNALS_LIMIT;
  const hasDateFilter = dateFilter !== '';

  const headerSubtitle = stats.active > 0
    ? `${stats.active} active · ${stats.total} total`
    : `${stats.total} signal${stats.total !== 1 ? 's' : ''}`;

  const groupedSignals = useMemo(() => {
    const groups: Record<string, TradingSignal[]> = {};

    visibleSignals.forEach((signal) => {
      const date = format(parseISO(signal.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(signal);
    });

    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((date) => ({
        date,
        displayDate: format(parseISO(date), 'EEEE, MMM d'),
        isToday: format(new Date(), 'yyyy-MM-dd') === date,
        signals: groups[date],
      }));
  }, [visibleSignals]);

  const clearDateFilter = () => setDateFilter('');

  const toggleDateExpanded = (date: string) => {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const applyToCalculator = (signal: TradingSignal) => {
    navigate(buildCalculatorUrl(signal));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <PageHeader
        title="Signals"
        subtitle={loading ? 'Loading signals…' : headerSubtitle}
        icon={<Radio className="h-5 w-5" />}
        className="px-4 sm:px-6"
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => void fetchSignals()}
              disabled={loading}
              aria-label="Refresh signals"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {isAdmin ? (
              <CreateSignalModal
                onSignalCreated={fetchSignals}
                trigger={
                  <Button size="icon" aria-label="Create signal" className="hidden h-10 w-10 sm:inline-flex">
                    <Plus className="h-4 w-4" />
                  </Button>
                }
              />
            ) : null}
          </>
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 sm:px-6 md:max-w-3xl">
        {!loading && stats.total > 0 ? (
          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-secondary px-3 py-3 text-center">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-400">{stats.active}</p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3 text-center">
              <p className="text-xs text-muted-foreground">Hit TP</p>
              <p className="mt-0.5 text-xl font-bold text-blue-400">{stats.hitTp}</p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3 text-center">
              <p className="text-xs text-muted-foreground">Hit SL</p>
              <p className="mt-0.5 text-xl font-bold text-red-400">{stats.hitSl}</p>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl bg-secondary p-2">
          <div className="flex gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition-all active:scale-[0.98] sm:px-4 sm:text-sm ${
                  statusFilter === filter.id
                    ? 'bg-background text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-secondary p-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="h-10 rounded-xl border-border bg-background pl-10"
              aria-label="Filter by date"
            />
          </div>
          {hasDateFilter ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <Badge variant="secondary" className="text-xs">
                Showing {dateFilter}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-7 text-xs">
                <X className="mr-1 h-3 w-3" />
                Clear date
              </Button>
            </div>
          ) : null}
        </section>

        {isAtSignalLimit && !dismissLimitBanner ? (
          <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                <Radio className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Signal limit reached</p>
                <p className="text-xs text-muted-foreground">
                  Upgrade to see all {allSignals.length} signals
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissLimitBanner(true)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="space-y-3 rounded-2xl bg-secondary p-4">
                <Skeleton className="h-6 w-40" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchSignals()} className="mt-4">
              Try again
            </Button>
          </div>
        ) : allSignals.length === 0 ? (
          <div className="rounded-2xl bg-secondary p-8 text-center">
            <Radio className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <h2 className="text-lg font-semibold text-foreground">No signals found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter !== 'all' || hasDateFilter
                ? 'Try a different filter or date.'
                : 'New trading signals will show up here.'}
            </p>
            {statusFilter !== 'all' || hasDateFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  clearDateFilter();
                }}
                className="mt-4"
              >
                Reset filters
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {groupedSignals.map((group) => (
              <section key={group.date} className="overflow-hidden rounded-2xl bg-secondary">
                <button
                  type="button"
                  onClick={() => toggleDateExpanded(group.date)}
                  className="flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-background/40"
                >
                  <div className="flex items-center gap-2 text-left">
                    <span
                      className={`text-sm font-semibold ${
                        group.isToday ? 'text-brand' : 'text-foreground'
                      }`}
                    >
                      {group.isToday ? 'Today' : group.displayDate}
                    </span>
                    {group.isToday ? (
                      <span className="text-sm text-muted-foreground">· {group.displayDate}</span>
                    ) : null}
                    <Badge variant="outline" className="text-[10px]">
                      {group.signals.length}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedDates.has(group.date) ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedDates.has(group.date) ? (
                  <div className="space-y-3 border-t border-border/50 p-3 pt-0">
                    {group.signals.map((signal) => (
                      <article
                        key={signal.id}
                        className="rounded-2xl border border-border/40 bg-background p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getOrderTone(signal.order_type)}`}
                            >
                              {signal.order_type.startsWith('sell') ? (
                                <TrendingDown className="h-5 w-5" />
                              ) : (
                                <TrendingUp className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-lg font-bold text-foreground">
                                {signal.currency_pair}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {ORDER_TYPE_LABELS[signal.order_type]}
                                {' · '}
                                {formatDistanceToNow(parseISO(signal.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <Badge className={`shrink-0 ${getStatusClass(signal.status)}`}>
                            {STATUS_LABELS[signal.status]}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <div className="rounded-xl bg-secondary px-3 py-2.5">
                            <p className="text-[11px] text-muted-foreground">Entry</p>
                            <p className="mt-0.5 text-sm font-semibold text-foreground">
                              {formatPrice(signal.entry_price)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-secondary px-3 py-2.5">
                            <p className="text-[11px] text-muted-foreground">Stop Loss</p>
                            <p className="mt-0.5 text-sm font-semibold text-red-400">
                              {formatPrice(signal.stop_loss)}
                            </p>
                          </div>
                          <div className="col-span-2 rounded-xl bg-secondary px-3 py-2.5 sm:col-span-1">
                            <p className="text-[11px] text-muted-foreground">Take Profit</p>
                            <p className="mt-0.5 text-sm font-semibold text-brand">
                              {formatPrice(signal.take_profit_1)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <Button
                            onClick={() => applyToCalculator(signal)}
                            className="h-11 flex-1 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
                          >
                            Apply to Calculator
                          </Button>
                          {isAdmin ? (
                            <div onClick={(event) => event.stopPropagation()}>
                              <UpdateSignalModal
                                signalId={signal.id}
                                symbol={signal.currency_pair}
                                orderType={signal.order_type}
                                status={signal.status}
                                entryPrice={signal.entry_price}
                                stopLoss={signal.stop_loss}
                                takeProfit1={signal.take_profit_1}
                                onSignalUpdated={fetchSignals}
                              />
                            </div>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}

            {!isPaid && !isAdmin && allSignals.length >= FREE_SIGNALS_LIMIT ? (
              <UpgradePrompt
                feature="unlimited signals"
                title="View all signals"
                description="Free users can view the latest 3 signals only. Upgrade to Premium to view all signals."
                cta="Upgrade to Premium"
                tier="premium"
              />
            ) : null}

            {totalPages > 1 ? (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </main>

      {isAdmin ? (
        <CreateSignalModal
          onSignalCreated={fetchSignals}
          trigger={
            <Button
              size="icon"
              aria-label="Create signal"
              className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 rounded-full shadow-lg sm:hidden"
            >
              <Plus className="h-6 w-6" />
            </Button>
          }
        />
      ) : null}
    </div>
  );
};

export default Signals;
