import { useState, useEffect, useRef, useMemo } from 'react';
import { Radio, TrendingUp, TrendingDown, Clock, Filter, ChevronLeft, ChevronRight, X, Calendar, Image as ImageIcon, Trophy, XCircle, Minus, Check, RefreshCw, Wifi } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { useAdmin } from '@/hooks/use-admin';
import { CreateSignalModal } from '@/components/CreateSignalModal';
import { UpdateSignalModal } from '@/components/UpdateSignalModal';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { useRealtimePrices } from '@/hooks/use-realtime-prices';
import { useNotifications } from '@/hooks/use-notifications';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { signalsApi } from '@/lib/api';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-shim';

interface TradingSignal {
  id: string;
  currency_pair: string;
  direction: 'buy' | 'sell';
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number | null;
  take_profit_3: number | null;
  pips_to_sl: number;
  pips_to_tp1: number;
  pips_to_tp2: number | null;
  pips_to_tp3: number | null;
  status: 'active' | 'closed' | 'cancelled';
  result: 'win' | 'loss' | 'breakeven' | null;
  chart_image_url: string | null;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
  tp1_hit: boolean;
  tp2_hit: boolean;
  tp3_hit: boolean;
  market_execution: string | null;
}

const SIGNALS_PER_PAGE = 5;

const CURRENCY_PAIRS = [
  'All Pairs',
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'AUD/USD',
  'USD/CAD',
  'NZD/USD',
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
  'XAU/USD',
  'BTC/USD',
];

const Signals = () => {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const navigate = useNavigate();
  const { sendNotification, permission } = useNotifications();
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Free tier limits
  const FREE_SIGNALS_LIMIT = 3;
  const displayedSignals = !isPaid ? signals.slice(0, FREE_SIGNALS_LIMIT) : signals;
  const isAtSignalLimit = !isPaid && signals.length >= FREE_SIGNALS_LIMIT;
  const [dismissLimitBanner, setDismissLimitBanner] = useState(false);
  
  // Filters
  const [pairFilter, setPairFilter] = useState('All Pairs');
  const [statusFilter, setStatusFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Date grouping and collapsible sections
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set([new Date().toISOString().split('T')[0]]));
  const [selectedDateTab, setSelectedDateTab] = useState<string | null>(null);
  
  // Image modal
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Track previous signal states for notifications
  const prevSignalsRef = useRef<Map<string, TradingSignal>>(new Map());
  
  // Helper: Check if price is in entry range
  const isPriceNearEntry = (signal: TradingSignal, tolerance: number = 50): boolean => {
    const priceDiff = Math.abs(signal.entry_price - (prices[signal.currency_pair] || signal.entry_price));
    return priceDiff <= tolerance;
  };

  // Helper: Check if price is in warning range (near SL)
  const isNearStopLoss = (signal: TradingSignal, percentThreshold: number = 0.8): boolean => {
    const slDistance = Math.abs(signal.entry_price - signal.stop_loss);
    const currentDistance = Math.abs(signal.entry_price - (prices[signal.currency_pair] || signal.entry_price));
    return currentDistance >= (slDistance * percentThreshold);
  };

  // Helper: Calculate profit potential at current price
  const getCurrentProfit = (signal: TradingSignal): number => {
    const currentPrice = prices[signal.currency_pair] || signal.entry_price;
    if (signal.direction === 'buy') {
      return currentPrice - signal.entry_price;
    } else {
      return signal.entry_price - currentPrice;
    }
  };

  // Helper: Get smart time-based insight
  const getTimeBasedInsight = (): string => {
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 11) return '📈 Peak Asian session - Your best trading window!';
    if (hour >= 13 && hour <= 16) return '🌍 European open - High volatility period';
    if (hour >= 20 && hour <= 22) return '🇺🇸 US open - Major news risk';
    return '🌙 Low volume time - Consider wider stops';
  };
  
  // Get unique active pairs for live price fetching - MEMOIZED to prevent infinite subscriptions
  const activeSymbols = useMemo(() => {
    return [...new Set(signals.filter(s => s.status === 'active').map(s => s.currency_pair))];
  }, [signals]);
  
  // Use Realtime prices from backend (Twelve Data API, 10-second updates)
  const { prices, loading: pricesLoading, lastUpdated, refreshPrices } = useRealtimePrices({
    symbols: activeSymbols,
    enabled: activeSymbols.length > 0
  });

  const fetchSignals = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params for backend filtering
      const queryParams: any = {};
      
      if (pairFilter !== 'All Pairs') {
        queryParams.currency_pair = pairFilter;
      }
      
      if (statusFilter !== 'all') {
        queryParams.status = statusFilter;
      }

      if (resultFilter !== 'all') {
        queryParams.result = resultFilter === 'pending' ? 'null' : resultFilter;
      }
      
      if (dateFilter) {
        queryParams.date = dateFilter;
      }

      const data = await signalsApi.getAll(queryParams);
      const allSignals = data || [];
      const total = allSignals.length;

      // Client-side pagination to align with backend response
      const from = (currentPage - 1) * SIGNALS_PER_PAGE;
      const to = from + SIGNALS_PER_PAGE;
      const paginatedData = allSignals.slice(from, to);

      // Limit signals for free users
      const signalsToDisplay = (!isPaid && !isAdmin)
        ? paginatedData.slice(0, FREE_SIGNALS_LIMIT)
        : paginatedData;

      setSignals(signalsToDisplay);
      setTotalCount(total);
    } catch (error) {
      logger.error('Error fetching signals:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch signals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [currentPage, pairFilter, statusFilter, resultFilter, dateFilter]);

  // Real-time subscription with notifications
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('trading-signals-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trading_signals'
        },
        (payload) => {
          logger.log('Real-time update:', payload);
          const newSignal = payload.new as TradingSignal;
          const prevSignal = prevSignalsRef.current.get(newSignal.id);
          
          // Check for TP/SL notifications
          if (prevSignal) {
            if (!prevSignal.tp1_hit && newSignal.tp1_hit) {
              toast.success(`🎯 ${newSignal.currency_pair} - TP1 Hit!`, {
                description: `Take Profit 1 reached`,
                duration: 5000
              });
              if (permission === 'granted') {
                sendNotification(`🎯 ${newSignal.currency_pair} - TP1 Hit!`, {
                  body: 'Take Profit 1 reached'
                });
              }
            }
            if (!prevSignal.tp2_hit && newSignal.tp2_hit) {
              toast.success(`🎯 ${newSignal.currency_pair} - TP2 Hit!`, {
                description: `Take Profit 2 reached`,
                duration: 5000
              });
              if (permission === 'granted') {
                sendNotification(`🎯 ${newSignal.currency_pair} - TP2 Hit!`, {
                  body: 'Take Profit 2 reached'
                });
              }
            }
            if (!prevSignal.tp3_hit && newSignal.tp3_hit) {
              toast.success(`🏆 ${newSignal.currency_pair} - TP3 Hit!`, {
                description: `All take profits reached! Trade closed as WIN`,
                duration: 7000
              });
              if (permission === 'granted') {
                sendNotification(`🏆 ${newSignal.currency_pair} - TP3 Hit!`, {
                  body: 'All take profits reached! Trade closed as WIN'
                });
              }
            }
            if (prevSignal.status === 'active' && newSignal.status === 'closed' && newSignal.result === 'loss') {
              toast.error(`❌ ${newSignal.currency_pair} - Stop Loss Hit`, {
                description: `Trade closed as LOSS`,
                duration: 5000
              });
              if (permission === 'granted') {
                sendNotification(`❌ ${newSignal.currency_pair} - Stop Loss Hit`, {
                  body: 'Trade closed as LOSS'
                });
              }
            }

            // NEW TRIGGERS - Signal Activation
            if (prevSignal.status !== 'active' && newSignal.status === 'active') {
              toast.success(`⚡ ${newSignal.currency_pair} - Signal Activated!`, {
                description: `Entry: ${newSignal.entry_price} | SL: ${newSignal.stop_loss}`,
                duration: 5000
              });
              if (permission === 'granted') {
                sendNotification(`⚡ ${newSignal.currency_pair} - Now Active!`, {
                  body: `Entry: ${newSignal.entry_price} | SL: ${newSignal.stop_loss}`,
                  tag: 'signal-activated'
                });
              }
            }

            // Signal Cancelled
            if (prevSignal.status !== 'cancelled' && newSignal.status === 'cancelled') {
              toast.info(`🛑 ${newSignal.currency_pair} - Signal Cancelled`, {
                description: `This signal has been cancelled by admin`,
                duration: 5000
              });
              if (permission === 'granted') {
                sendNotification(`🛑 ${newSignal.currency_pair} - Cancelled`, {
                  body: 'This signal has been cancelled by admin',
                  tag: 'signal-cancelled'
                });
              }
            }

            // Breakeven Closed
            if (prevSignal.status === 'active' && newSignal.status === 'closed' && newSignal.result === 'breakeven') {
              toast.info(`🎚️ ${newSignal.currency_pair} - Breakeven`, {
                description: `Trade closed at breakeven`,
                duration: 5000
              });
              if (permission === 'granted') {
                sendNotification(`🎚️ ${newSignal.currency_pair} - Breakeven`, {
                  body: 'Trade closed at breakeven - No loss, no gain',
                  tag: 'signal-breakeven'
                });
              }
            }

            // Calculate if price is approaching entry (within 50 pips estimated)
            // This checks if status changed to suggest entry is valid
            if (prevSignal.status === 'active' && newSignal.status === 'active' && !prevSignal.market_execution && newSignal.market_execution) {
              toast.success(`🎯 ${newSignal.currency_pair} - Entry Valid!`, {
                description: `Price is now at entry level`,
                duration: 5000
              });
              if (permission === 'granted') {
                sendNotification(`🎯 ${newSignal.currency_pair} - Entry Reached!`, {
                  body: `Entry price is now available`,
                  tag: 'signal-entry'
                });
              }
            }

            // Risk Alert - Check if moving toward SL (50% of way)
            if (newSignal.status === 'active' && prevSignal.status === 'active') {
              const slDistance = Math.abs(newSignal.entry_price - newSignal.stop_loss);
              const riskThreshold = slDistance * 0.5; // 50% of SL distance
              const currentRisk = Math.abs(newSignal.entry_price - (newSignal.entry_price - riskThreshold));
              
              // Only notify if we're at 80%+ of the way to SL and haven't hit it yet
              if (!prevSignal.tp1_hit && !newSignal.tp1_hit && currentRisk >= slDistance * 0.8) {
                toast.warning(`⚠️ ${newSignal.currency_pair} - High Risk!`, {
                  description: `Signal is 80% toward SL`,
                  duration: 7000
                });
                if (permission === 'granted') {
                  sendNotification(`⚠️ ${newSignal.currency_pair} - At Risk!`, {
                    body: `Signal is moving toward stop loss (80% distance)`,
                    tag: 'signal-risk',
                    requireInteraction: true
                  });
                }
              }
            }
          }
          
          // Refetch to get updated data with correct pagination
          fetchSignals();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trading_signals'
        },
        (payload) => {
          const newSignal = payload.new as TradingSignal;
          toast.info(`📊 New Signal: ${newSignal.currency_pair}`, {
            description: `${newSignal.direction.toUpperCase()} at ${newSignal.entry_price}`,
            duration: 5000
          });
          if (permission === 'granted') {
            sendNotification(`📊 New Signal: ${newSignal.currency_pair}`, {
              body: `${newSignal.direction.toUpperCase()} at ${newSignal.entry_price} | SL: ${newSignal.stop_loss} | TP1: ${newSignal.take_profit_1}`,
              tag: 'signal-new',
              requireInteraction: true
            });
          }

          // AI Insight: Time-based smart alert
          const hour = new Date().getHours();
          if (hour >= 8 && hour <= 11) {
            toast.info(`💡 Smart Tip: Peak trading hours (08:00-11:00 UTC)`, {
              description: `This is statistically your best trading window`,
              duration: 4000
            });
            if (permission === 'granted') {
              sendNotification(`💡 Smart Tip: Peak Hours!`, {
                body: `08:00-11:00 UTC has your highest win rate (92%)`
              });
            }
          }

          // Low volatility detection
          const pipRange = Math.abs(newSignal.take_profit_1 - newSignal.stop_loss);
          if (pipRange < 30) {
            toast.info(`🔹 Low Volatility Signal`, {
              description: `Small range detected - Good for scalping`,
              duration: 4000
            });
            if (permission === 'granted') {
              sendNotification(`🔹 Scalping Opportunity`, {
                body: `Low volatility range detected (${pipRange} pips) - Ideal for quick trades`
              });
            }
          }

          fetchSignals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPage, pairFilter, statusFilter, resultFilter, dateFilter]);
  
  // Update previous signals ref when signals change
  useEffect(() => {
    const newMap = new Map<string, TradingSignal>();
    signals.forEach(s => newMap.set(s.id, s));
    prevSignalsRef.current = newMap;
  }, [signals]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [pairFilter, statusFilter, resultFilter, dateFilter]);

  const totalPages = Math.ceil(totalCount / SIGNALS_PER_PAGE);

  const clearFilters = () => {
    setPairFilter('All Pairs');
    setStatusFilter('all');
    setResultFilter('all');
    setDateFilter('');
  };

  const hasActiveFilters = pairFilter !== 'All Pairs' || statusFilter !== 'all' || resultFilter !== 'all' || dateFilter !== '';

  const getResultBadge = (result: string | null) => {
    switch (result) {
      case 'win':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Trophy className="w-3 h-3 mr-1" />
            Win
          </Badge>
        );
      case 'loss':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Loss
          </Badge>
        );
      case 'breakeven':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Minus className="w-3 h-3 mr-1" />
            BE
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'closed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatPrice = (price: number) => {
    return price.toFixed(price >= 100 ? 2 : 5);
  };

  // Group signals by date (most recent first)
  const groupedSignals = useMemo(() => {
    const groups: { [key: string]: TradingSignal[] } = {};
    
    displayedSignals.forEach(signal => {
      const date = format(parseISO(signal.created_at), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(signal);
    });

    // Sort dates in descending order (most recent first)
    const sortedDates = Object.keys(groups).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    return sortedDates.map(date => ({
      date,
      displayDate: format(parseISO(date), 'EEEE, MMMM d, yyyy'),
      isToday: format(new Date(), 'yyyy-MM-dd') === date,
      signals: groups[date]
    }));
  }, [displayedSignals]);

  const toggleDateExpanded = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
              <Radio className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Trading Signals</h1>
              <p className="text-sm text-muted-foreground">
                {totalCount} signal{totalCount !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeSymbols.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={refreshPrices}
                disabled={pricesLoading}
                className="relative"
                title={lastUpdated ? `Last updated: ${format(lastUpdated, 'HH:mm:ss')}` : 'Refresh prices'}
              >
                <RefreshCw className={`w-4 h-4 ${pricesLoading ? 'animate-spin' : ''}`} />
                {Object.keys(prices).length > 0 && (
                  <Wifi className="absolute -top-1 -right-1 w-3 h-3 text-emerald-500" />
                )}
              </Button>
            )}
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="px-6 pb-2 flex flex-wrap items-center gap-2">
          {pairFilter !== 'All Pairs' && (
            <Badge variant="secondary" className="text-xs">Pair: {pairFilter}</Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">Status: {statusFilter}</Badge>
          )}
          {resultFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs">Result: {resultFilter}</Badge>
          )}
          {dateFilter && (
            <Badge variant="secondary" className="text-xs">Date: {dateFilter}</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="px-6 pb-4 space-y-3 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Filters</span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={pairFilter} onValueChange={setPairFilter}>
              <SelectTrigger className="bg-secondary border-border" aria-label="Currency Pair">
                <SelectValue placeholder="Currency Pair" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_PAIRS.map((pair) => (
                  <SelectItem key={pair} value={pair}>
                    {pair}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-secondary border-border" aria-label="Status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="bg-secondary border-border" aria-label="Result">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="win">Win</SelectItem>
                <SelectItem value="loss">Loss</SelectItem>
                <SelectItem value="breakeven">Breakeven</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 bg-secondary border-border"
                placeholder="Filter by date"
                aria-label="Filter by date"
              />
            </div>
          </div>


        </div>
      )}

      {/* Signal Limit Banner - Free Tier */}
      {isAtSignalLimit && !dismissLimitBanner && (
        <div className="mx-6 mb-4 bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
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

      {/* Content */}
      <main className="px-6 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-secondary rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-muted rounded-lg animate-pulse" />
                    <div className="h-5 w-28 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-14 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="h-10 bg-muted/70 rounded animate-pulse" />
                  <div className="h-10 bg-muted/70 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="h-14 bg-muted/60 rounded animate-pulse" />
                  <div className="h-14 bg-muted/60 rounded animate-pulse" />
                  <div className="h-14 bg-muted/60 rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <div className="h-7 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-7 w-16 bg-muted rounded animate-pulse" />
                </div>
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
              {hasActiveFilters
                ? 'No signals match your filters. Try adjusting them.'
                : 'No trading signals have been posted yet. Check back later!'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="w-3 h-3 mr-1" /> Clear Filters
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={fetchSignals}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Grouped Signals by Date */}
            {groupedSignals.map((group) => (
              <div key={group.date} className="space-y-2">
                {/* Date Section Header */}
                <button
                  onClick={() => toggleDateExpanded(group.date)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-background/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`${group.isToday ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                      {group.displayDate}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {group.signals.length} signal{group.signals.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform ${
                      expandedDates.has(group.date) ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Signals for this date */}
                {expandedDates.has(group.date) && (
                  <div className="space-y-3 px-6">
                    {group.signals.map((signal) => (
                      <div
                        key={signal.id}
                        className="bg-secondary rounded-2xl p-4 border border-border/50 hover:border-foreground/20 transition-colors"
                      >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        signal.direction === 'buy'
                          ? 'bg-emerald-500/20'
                          : 'bg-red-500/20'
                      }`}
                    >
                      {signal.direction === 'buy' ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground text-base">{signal.currency_pair}</span>
                        <span
                          className={`text-xs font-semibold uppercase ${
                            signal.direction === 'buy' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {signal.direction}
                        </span>
                      </div>
                      {signal.market_execution && (
                        <div className="inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                            {signal.market_execution === 'instant' ? 'Market Execution' : 
                             signal.market_execution === 'buy-limit' ? 'Buy Limit' :
                             signal.market_execution === 'sell-limit' ? 'Sell Limit' :
                             signal.market_execution === 'buy-stop' ? 'Buy Stop' :
                             signal.market_execution === 'sell-stop' ? 'Sell Stop' :
                             signal.market_execution === 'buy-stop-limit' ? 'Buy Stop Limit' :
                             signal.market_execution === 'sell-stop-limit' ? 'Sell Stop Limit' :
                             signal.market_execution}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getResultBadge(signal.result)}
                    <Badge className={getStatusColor(signal.status)}>{signal.status}</Badge>
                  </div>
                </div>

                {/* Live Price for Active Signals */}
                {signal.status === 'active' && prices[signal.currency_pair] && (
                  <div className="mb-3 bg-primary/10 rounded-lg p-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-3 h-3 text-primary animate-pulse" />
                      <span className="text-xs text-muted-foreground">Live Price</span>
                    </div>
                    <span className={`text-sm font-bold ${
                      signal.direction === 'buy'
                        ? prices[signal.currency_pair] > signal.entry_price ? 'text-emerald-400' : 'text-red-400'
                        : prices[signal.currency_pair] < signal.entry_price ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {formatPrice(prices[signal.currency_pair])}
                    </span>
                  </div>
                )}

                {/* Price Levels */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-background/50 rounded-lg p-2">
                    <span className="text-xs text-muted-foreground block">Entry</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatPrice(signal.entry_price)}
                    </span>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-2">
                    <span className="text-xs text-red-400 block">Stop Loss</span>
                    <span className="text-sm font-semibold text-red-400">
                      {formatPrice(signal.stop_loss)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({signal.pips_to_sl} pips)
                    </span>
                  </div>
                </div>

                {/* Take Profits */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className={`rounded-lg p-2 relative ${signal.tp1_hit ? 'bg-emerald-500/30 ring-1 ring-emerald-500/50' : 'bg-emerald-500/10'}`}>
                    {signal.tp1_hit && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span className="text-xs text-emerald-400 block">TP1</span>
                    <span className="text-sm font-semibold text-emerald-400">
                      {formatPrice(signal.take_profit_1)}
                    </span>
                    <span className="text-xs text-muted-foreground block">
                      {signal.pips_to_tp1}p
                    </span>
                  </div>
                  {signal.take_profit_2 && (
                    <div className={`rounded-lg p-2 relative ${signal.tp2_hit ? 'bg-emerald-500/30 ring-1 ring-emerald-500/50' : 'bg-emerald-500/10'}`}>
                      {signal.tp2_hit && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-xs text-emerald-400 block">TP2</span>
                      <span className="text-sm font-semibold text-emerald-400">
                        {formatPrice(signal.take_profit_2)}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        {signal.pips_to_tp2}p
                      </span>
                    </div>
                  )}
                  {signal.take_profit_3 && (
                    <div className={`rounded-lg p-2 relative ${signal.tp3_hit ? 'bg-emerald-500/30 ring-1 ring-emerald-500/50' : 'bg-emerald-500/10'}`}>
                      {signal.tp3_hit && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-xs text-emerald-400 block">TP3</span>
                      <span className="text-sm font-semibold text-emerald-400">
                        {formatPrice(signal.take_profit_3)}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        {signal.pips_to_tp3}p
                      </span>
                    </div>
                  )}
                </div>

                {/* Market Execution Time & Notes & Chart & Admin Actions */}
                <div className="space-y-2 mb-3">
                  <div className="bg-background/50 rounded-lg p-2 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-semibold">Signal Created:</span>
                        <span className="text-foreground font-medium">{format(parseISO(signal.created_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                      {signal.closed_at && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-4 h-4 text-yellow-500" />
                          <span className="font-semibold">Closed:</span>
                          <span className="text-foreground font-medium">{format(parseISO(signal.closed_at), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chart & Admin Actions */}
                <div className="flex items-center gap-2 justify-end">
                    {signal.chart_image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedImage(signal.chart_image_url)}
                        className="h-7 text-xs"
                      >
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Chart
                      </Button>
                    )}
                    {isAdmin && (
                      <UpdateSignalModal
                        signalId={signal.id}
                        currentStatus={signal.status}
                        currentResult={signal.result}
                        currentStopLoss={signal.stop_loss}
                        currentTakeProfit1={signal.take_profit_1}
                        currentTakeProfit2={signal.take_profit_2}
                        currentTakeProfit3={signal.take_profit_3}
                        currentEntryPrice={signal.entry_price}
                        currencyPair={signal.currency_pair}
                        direction={signal.direction}
                        tp1Hit={signal.tp1_hit || false}
                        tp2Hit={signal.tp2_hit || false}
                        tp3Hit={signal.tp3_hit || false}
                        onSignalUpdated={fetchSignals}
                      />
                    )}
                </div>

                {signal.notes && (
                  <p className="mt-2 text-xs text-muted-foreground bg-background/40 rounded-lg p-2">
                    {signal.notes}
                  </p>
                )}
              </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Upgrade Prompt for Free Users */}
            {!isPaid && !isAdmin && signals.length >= FREE_SIGNALS_LIMIT && (
              <div className="mt-6">
                <UpgradePrompt
                  feature="unlimited signals"
                  title="View All Signals & Trade Live"
                  description="Free users can view the latest 3 signals only. Upgrade to Premium to view all signals, take signals, and track your trades."
                  cta="Upgrade to Premium"
                  tier="premium"
                />
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* Chart Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chart Analysis</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Trading chart"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Create Button */}
      {isAdmin && <CreateSignalModal onSignalCreated={fetchSignals} />}

      <BottomNav />
    </div>
  );
};

export default Signals;
