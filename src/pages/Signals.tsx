import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Filter, Plus, Radio, RefreshCw, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CreateSignalModal } from '@/components/CreateSignalModal';
import { PageHeader } from '@/components/PageHeader';
import { UpdateSignalModal } from '@/components/UpdateSignalModal';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdmin } from '@/hooks/use-admin';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { signalsApi } from '@/lib/api';
import { logger } from '@/lib/logger';

type SignalOrderType = 'buy' | 'sell' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
type SignalStatus = 'active' | 'hit_tp' | 'hit_sl' | 'cancelled';

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

const SIGNALS_PER_PAGE = 5;
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
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const formatPrice = (price: number | string | null | undefined): string => {
  if (price === null || price === undefined || price === '') return '-';
  const numPrice = typeof price === 'string' ? Number.parseFloat(price) : price;
  if (!Number.isFinite(numPrice)) return '-';
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
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([new Date().toISOString().split('T')[0]]));
  const [dismissLimitBanner, setDismissLimitBanner] = useState(false);

  const displayedSignals = !isPaid && !isAdmin ? signals.slice(0, FREE_SIGNALS_LIMIT) : signals;
  const isAtSignalLimit = !isPaid && !isAdmin && signals.length >= FREE_SIGNALS_LIMIT;
  const hasActiveFilters = statusFilter !== 'all' || dateFilter !== '';

  const fetchSignals = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await signalsApi.getAll({
        status: statusFilter,
        date: dateFilter,
      });
      const allSignals = data || [];
      const from = (currentPage - 1) * SIGNALS_PER_PAGE;
      const to = from + SIGNALS_PER_PAGE;
      setSignals(allSignals.slice(from, to));
      setTotalCount(allSignals.length);
    } catch (err) {
      logger.error('Error fetching signals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch signals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [currentPage, statusFilter, dateFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateFilter]);

  const totalPages = Math.ceil(totalCount / SIGNALS_PER_PAGE);

  const groupedSignals = useMemo(() => {
    const groups: Record<string, TradingSignal[]> = {};

    displayedSignals.forEach((signal) => {
      const date = format(parseISO(signal.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(signal);
    });

    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((date) => ({
        date,
        displayDate: format(parseISO(date), 'EEEE, MMMM d, yyyy'),
        isToday: format(new Date(), 'yyyy-MM-dd') === date,
        signals: groups[date],
      }));
  }, [displayedSignals]);

  const clearFilters = () => {
    setStatusFilter('all');
    setDateFilter('');
  };

  const toggleDateExpanded = (date: string) => {
    const next = new Set(expandedDates);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setExpandedDates(next);
  };

  const applyToCalculator = (signal: TradingSignal) => {
    navigate(buildCalculatorUrl(signal));
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-28">
      <PageHeader
        title="Signals"
        subtitle={`${totalCount} signal${totalCount !== 1 ? 's' : ''} available`}
        icon={<Radio className="h-5 w-5" />}
        className="px-4 sm:px-6"
        actions={
          <>
            {isAdmin && (
              <CreateSignalModal
                onSignalCreated={fetchSignals}
                trigger={
                  <Button size="icon" aria-label="Create signal" className="hidden h-10 w-10 sm:inline-flex">
                    <Plus className="h-4 w-4" />
                  </Button>
                }
              />
            )}
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="relative h-10 w-10"
            >
              <Filter className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand" />
              )}
            </Button>
          </>
        }
      />

      {hasActiveFilters && (
        <div className="px-4 pb-2 sm:px-6 flex flex-wrap items-center gap-2">
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">Status: {STATUS_LABELS[statusFilter as SignalStatus] ?? statusFilter}</Badge>
          )}
          {dateFilter && (
            <Badge variant="secondary" className="text-xs">Date: {dateFilter}</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {showFilters && (
        <div className="px-4 pb-4 sm:px-6 space-y-3 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-secondary border-border" aria-label="Status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="hit_tp">Hit TP</SelectItem>
                <SelectItem value="hit_sl">Hit SL</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 bg-secondary border-border"
                aria-label="Filter by date"
              />
            </div>
          </div>
        </div>
      )}

      {isAtSignalLimit && !dismissLimitBanner && (
        <div className="mx-4 mb-4 sm:mx-6 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Signal Limit Reached</p>
              <p className="text-xs text-muted-foreground">Upgrade to see all {totalCount} signals</p>
            </div>
          </div>
          <button
            onClick={() => setDismissLimitBanner(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="px-4 sm:px-6 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-secondary rounded-2xl p-4">
                <div className="h-6 w-40 bg-muted rounded animate-pulse mb-4" />
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="h-16 bg-muted/70 rounded animate-pulse" />
                  <div className="h-16 bg-muted/70 rounded animate-pulse" />
                </div>
                <div className="h-12 bg-muted/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSignals} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : signals.length === 0 ? (
          <div className="bg-secondary rounded-2xl p-6 text-center">
            <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">No Signals Found</h2>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? 'No signals match your filters.' : 'No trading signals have been posted yet.'}
            </p>
            <Button variant="outline" size="sm" onClick={hasActiveFilters ? clearFilters : fetchSignals} className="mt-4">
              {hasActiveFilters ? <X className="w-3 h-3 mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
              {hasActiveFilters ? 'Clear Filters' : 'Refresh'}
            </Button>
          </div>
        ) : (
          <>
            {groupedSignals.map((group) => (
              <div key={group.date} className="space-y-2">
                <button
                  onClick={() => toggleDateExpanded(group.date)}
                  className="w-full py-3 flex items-center justify-between hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    <span className={`${group.isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {group.displayDate}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {group.signals.length}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      expandedDates.has(group.date) ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedDates.has(group.date) && (
                  <div className="space-y-3">
                    {group.signals.map((signal) => (
                      <div
                        key={signal.id}
                        className="min-w-0 space-y-3 rounded-2xl border border-border/40 bg-secondary/60 p-4 transition-colors hover:bg-secondary"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${getOrderTone(signal.order_type)}`}>
                              {signal.order_type.startsWith('sell') ? (
                                <TrendingDown className="h-5 w-5" />
                              ) : (
                                <TrendingUp className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-lg font-semibold leading-tight text-foreground">{signal.currency_pair}</p>
                              <p className="text-sm text-muted-foreground">{ORDER_TYPE_LABELS[signal.order_type]}</p>
                            </div>
                          </div>
                          <Badge className={`${getStatusClass(signal.status)} shrink-0`}>{STATUS_LABELS[signal.status]}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {signal.entry_price !== null && signal.entry_price !== '' && (
                            <span className="text-muted-foreground">
                              Entry <span className="font-semibold text-foreground">{formatPrice(signal.entry_price)}</span>
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            SL <span className="font-semibold text-destructive">{formatPrice(signal.stop_loss)}</span>
                          </span>
                          <span className="text-muted-foreground">
                            TP <span className="font-semibold text-brand">{formatPrice(signal.take_profit_1)}</span>
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => applyToCalculator(signal)}
                            className="h-11 flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
                          >
                            Apply to Calculator
                          </Button>
                          {isAdmin && (
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
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!isPaid && !isAdmin && signals.length >= FREE_SIGNALS_LIMIT && (
              <div className="mt-6">
                <UpgradePrompt
                  feature="unlimited signals"
                  title="View All Signals"
                  description="Free users can view the latest 3 signals only. Upgrade to Premium to view all signals."
                  cta="Upgrade to Premium"
                  tier="premium"
                />
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
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
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {isAdmin && (
        <CreateSignalModal
          onSignalCreated={fetchSignals}
          trigger={
            <Button
              size="icon"
              aria-label="Create signal"
              className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 rounded-full shadow-lg sm:hidden"
            >
              <Plus className="w-6 h-6" />
            </Button>
          }
        />
      )}
    </div>
  );
};

export default Signals;
