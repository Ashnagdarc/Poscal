import { useState, useEffect, useMemo, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  X,
  Check,
  Trash2,
  BarChart3,
  Upload,
  Image as ImageIcon,
  Search,
  Download,
  Edit2,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { logger } from "@/lib/logger";
import { BottomNav } from "@/components/BottomNav";
import { JournalAnalytics } from "@/components/JournalAnalytics";
import { CSVImport } from "@/components/CSVImport";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { PnLInputModal } from "@/components/PnLInputModal";
import { RichNoteEditor } from "@/components/RichNoteEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { validateTrades, MAX_TRADES_PER_IMPORT, type ValidatedTrade } from "@/lib/tradeValidation";
import { filtersReducer, initialFiltersState, modalReducer, initialModalState } from "@/lib/journalReducers";
import { NewTradeFormSchema } from "@/lib/formValidation";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { tradesApi } from "@/lib/api";

interface Trade {
  id: string;
  pair: string;
  direction: 'buy' | 'sell';
  entry_price: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  position_size: number | null;
  risk_percent: number | null;
  pnl: number | null;
  pnl_percent: number | null;
  status: 'open' | 'closed' | 'cancelled';
  notes: string | null;
  entry_date: string | null;
  created_at: string;
  screenshot_urls?: string[];
  journal_type?: 'structured' | 'notes';
  rich_content?: any;
  images?: Array<{ url: string; caption?: string }>;
  links?: Array<{ url: string; title?: string }>;
}

const Journal = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPaid, subscriptionTier } = useSubscription();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedScreenshots, setSelectedScreenshots] = useState<File[]>([]);
  const [showLimitBanner, setShowLimitBanner] = useState(true);
  
  // Free tier limits
  const FREE_TRADE_LIMIT = 5;
  const tradeCount = trades.length;
  const isAtTradeLimit = !isPaid && tradeCount >= FREE_TRADE_LIMIT;
  const canAddTrade = isPaid || tradeCount < FREE_TRADE_LIMIT;
  
  // Use reducers for filters and modals (performance optimization)
  const [filters, dispatchFilters] = useReducer(filtersReducer, initialFiltersState);
  const [modals, dispatchModals] = useReducer(modalReducer, initialModalState);

  // Journal view toggle
  const [journalView, setJournalView] = useState<'structured' | 'notes'>('structured');

  // New trade form
  const [newTrade, setNewTrade] = useState({
    pair: "EUR/USD",
    direction: "buy" as 'buy' | 'sell',
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    position_size: "",
    risk_percent: "",
    notes: "",
    journal_type: "structured" as 'structured' | 'notes',
    rich_content: null,
    images: [],
    links: [],
  });

  useEffect(() => {
    if (user) {
      fetchTrades();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  // Keyboard shortcuts
  useKeyboardShortcut([
    {
      key: 'n',
      ctrl: true,
      handler: () => {
        dispatchModals({ type: 'SET_EDITING_TRADE', payload: null });
        resetForm();
        dispatchModals({ type: 'OPEN_ADD_TRADE' });
      }
    },
    {
      key: 'Escape',
      handler: () => {
        if (modals.showAddTrade) {
          dispatchModals({ type: 'CLOSE_ADD_TRADE' });
        }
      }
    }
  ], true);

  // Focus trap for modal
  const modalRef = useFocusTrap(modals.showAddTrade);

  const fetchTrades = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await tradesApi.getAll();
      setTrades(data || []);
    } catch (error) {
      logger.error('Error fetching trades:', error);
      toast.error("Failed to load trades");
    }
    setIsLoading(false);
  };

  const uploadScreenshots = async (tradeId: string): Promise<string[]> => {
    if (!user || selectedScreenshots.length === 0) return [];
    
    const urls: string[] = [];
    
    for (const file of selectedScreenshots) {
      try {
        const resp = await uploadsApi.uploadTradeScreenshot(tradeId, file);
        if (resp?.url) urls.push(resp.url);
      } catch (err) {
        logger.error('Screenshot upload failed', err);
      }
    }
    
    return urls;
  };

  const handleAddTrade = async () => {
    if (!user) {
      toast.error("Please sign in to add trades");
      navigate("/signin");
      return;
    }

    // Check trade limit for free users
    if (!canAddTrade) {
      dispatchModals({ type: 'SHOW_UPGRADE_MODAL' });
      return;
    }

    // For Notes view, set default values for required structured fields
    const tradeToValidate = journalView === 'notes' ? {
      ...newTrade,
      pair: newTrade.pair || 'JOURNAL',
      direction: newTrade.direction || 'long',
      entry_price: newTrade.entry_price || '0.1',
      stop_loss: newTrade.stop_loss || undefined,
      take_profit: newTrade.take_profit || undefined,
      position_size: newTrade.position_size || '1',
      risk_percent: newTrade.risk_percent || undefined,
    } : newTrade;

    // Validate form data
    const validation = NewTradeFormSchema.safeParse(tradeToValidate);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    try {
      const tradeData = {
        user_id: user.id,
        account_id: tradeToValidate.account_id || undefined,
        symbol: tradeToValidate.pair || undefined,
        direction: tradeToValidate.direction || undefined,
        entry_price: tradeToValidate.entry_price ? parseFloat(tradeToValidate.entry_price) : undefined,
        stop_loss: tradeToValidate.stop_loss ? parseFloat(tradeToValidate.stop_loss) : undefined,
        take_profit: tradeToValidate.take_profit ? parseFloat(tradeToValidate.take_profit) : undefined,
        position_size: tradeToValidate.position_size ? parseFloat(tradeToValidate.position_size) : undefined,
        notes: tradeToValidate.notes || null,
        journal_type: journalView,
        rich_content: tradeToValidate.rich_content,
        images: tradeToValidate.images,
        links: tradeToValidate.links,
        status: 'open',
        trade_date: new Date().toISOString(),
      };

      const data = await tradesApi.create(tradeData);
      
      if (selectedScreenshots.length > 0 && data) {
        await uploadScreenshots(data.id);
      }
      
      toast.success("Trade added");
      dispatchModals({ type: 'CLOSE_ADD_TRADE' });
      resetForm();
      fetchTrades();
    } catch (error) {
      logger.error('Error adding trade:', error);
      toast.error("Failed to add trade");
    }
  };

  const handleEditTrade = async () => {
    if (!user || !modals.editingTrade) return;

    // For Notes view, set default values for required structured fields
    const tradeToValidate = journalView === 'notes' ? {
      ...newTrade,
      pair: newTrade.pair || 'JOURNAL',
      direction: newTrade.direction || 'long',
      entry_price: newTrade.entry_price || '0.1',
      stop_loss: newTrade.stop_loss || undefined,
      take_profit: newTrade.take_profit || undefined,
      position_size: newTrade.position_size || '1',
      risk_percent: newTrade.risk_percent || undefined,
    } : newTrade;

    // Validate form data
    const validation = NewTradeFormSchema.safeParse(tradeToValidate);
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    try {
      const updates = {
        symbol: tradeToValidate.pair || undefined,
        direction: tradeToValidate.direction || undefined,
        entry_price: tradeToValidate.entry_price ? parseFloat(tradeToValidate.entry_price) : undefined,
        stop_loss: tradeToValidate.stop_loss ? parseFloat(tradeToValidate.stop_loss) : undefined,
        take_profit: tradeToValidate.take_profit ? parseFloat(tradeToValidate.take_profit) : undefined,
        position_size: tradeToValidate.position_size ? parseFloat(tradeToValidate.position_size) : undefined,
        notes: tradeToValidate.notes || null,
        journal_type: journalView,
        rich_content: tradeToValidate.rich_content,
        images: tradeToValidate.images,
        links: tradeToValidate.links,
      };

      await tradesApi.update(modals.editingTrade.id, updates);
      toast.success("Trade updated");
      dispatchModals({ type: 'CLOSE_ADD_TRADE' });
      dispatchModals({ type: 'SET_EDITING_TRADE', payload: null });
      resetForm();
      fetchTrades();
    } catch (error) {
      toast.error("Failed to update trade");
    }
  };

  const resetForm = () => {
    setNewTrade({
      pair: "EUR/USD",
      direction: "long",
      entry_price: "",
      stop_loss: "",
      take_profit: "",
      position_size: "",
      risk_percent: "",
      notes: "",
      journal_type: journalView,
      rich_content: null,
      images: [],
      links: [],
    });
    setSelectedScreenshots([]);
  };

  const openEditModal = (trade: Trade) => {
    dispatchModals({ type: 'SET_EDITING_TRADE', payload: trade });
    const tradeJournalType = (trade.journal_type || 'structured') as 'structured' | 'notes';
    setJournalView(tradeJournalType);
    setNewTrade({
      pair: trade.pair,
      direction: trade.direction,
      entry_price: trade.entry_price?.toString() || "",
      stop_loss: trade.stop_loss?.toString() || "",
      take_profit: trade.take_profit?.toString() || "",
      position_size: trade.position_size?.toString() || "",
      risk_percent: trade.risk_percent?.toString() || "",
      notes: trade.notes || "",
      journal_type: tradeJournalType,
      rich_content: trade.rich_content || null,
      images: trade.images || [],
      links: trade.links || [],
    });
    dispatchModals({ type: 'OPEN_ADD_TRADE' });
  };

  const handleImportTrades = async (parsedTrades: unknown[]) => {
    if (!user) return;
    
    // Check import limit
    if (parsedTrades.length > MAX_TRADES_PER_IMPORT) {
      toast.error(`Cannot import more than ${MAX_TRADES_PER_IMPORT} trades at once`);
      throw new Error(`Import limit exceeded`);
    }

    // Validate all trades
    const { validTrades, errors, totalRejected } = validateTrades(parsedTrades);
    
    if (validTrades.length === 0) {
      toast.error("No valid trades to import");
      if (errors.length > 0) {
        logger.error("Validation errors:", errors);
      }
      throw new Error("Validation failed");
    }

    if (totalRejected > 0) {
      toast.warning(`${totalRejected} trades were skipped due to validation errors`);
    }
    
    const tradesToInsert = validTrades.map(t => ({
      user_id: user.id,
      pair: t.pair,
      direction: t.direction,
      entry_price: t.entry_price ?? null,
      exit_price: t.exit_price ?? null,
      stop_loss: t.stop_loss ?? null,
      take_profit: t.take_profit ?? null,
      position_size: t.position_size ?? null,
      risk_percent: t.risk_percent ?? null,
      pnl: t.pnl ?? null,
      status: t.status,
      notes: t.notes ?? null,
      entry_date: t.entry_date ? new Date(t.entry_date).toISOString() : new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('trading_journal')
      .insert(tradesToInsert);

    if (error) {
      throw error;
    }
    
    fetchTrades();
  };

  const handleCloseTrade = async (tradeId: string, pnl: number) => {
    if (!user) return;
    
    try {
      await tradesApi.update(tradeId, { 
        status: 'closed', 
        pnl,
        exit_date: new Date().toISOString() 
      });
      toast.success("Trade closed");
      fetchTrades();
    } catch (error) {
      toast.error("Failed to close trade");
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!user) return;
    
    try {
      await tradesApi.delete(tradeId);
      toast.success("Trade deleted");
      fetchTrades();
    } catch (error) {
      toast.error("Failed to delete trade");
    }
  };

  const handleExportCSV = () => {
    if (trades.length === 0) {
      toast.error("No trades to export");
      return;
    }

    const headers = ['Pair', 'Direction', 'Entry Price', 'Exit Price', 'Stop Loss', 'Take Profit', 'Position Size', 'Risk %', 'P&L', 'Status', 'Entry Date', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...trades.map(t => [
        t.pair,
        t.direction,
        t.entry_price || '',
        t.exit_price || '',
        t.stop_loss || '',
        t.take_profit || '',
        t.position_size || '',
        t.risk_percent || '',
        t.pnl || '',
        t.status,
        t.entry_date || t.created_at,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Journal exported");
  };

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validFiles = Array.from(files).filter(f => {
        if (!f.type.startsWith('image/')) {
          toast.error(`${f.name} is not an image`);
          return false;
        }
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`${f.name} is too large (max 5MB)`);
          return false;
        }
        return true;
      });
      setSelectedScreenshots(prev => [...prev, ...validFiles]);
    }
  };

  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      const matchesFilter = filters.filter === 'all' || trade.status === filters.filter;
      const matchesSearch = filters.searchQuery === "" || 
        trade.pair.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        trade.notes?.toLowerCase().includes(filters.searchQuery.toLowerCase());
      
      // Date filters
      const tradeDate = new Date(trade.entry_date || trade.created_at);
      const matchesMonth = filters.selectedMonth === 'all' || 
        (tradeDate.getMonth() + 1).toString() === filters.selectedMonth;
      const matchesYear = filters.selectedYear === 'all' || 
        tradeDate.getFullYear().toString() === filters.selectedYear;
      
      return matchesFilter && matchesSearch && matchesMonth && matchesYear;
    });
  }, [trades, filters]);
  
  // Get unique months and years from trades
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    trades.forEach(trade => {
      const date = new Date(trade.entry_date || trade.created_at);
      months.add((date.getMonth() + 1).toString());
    });
    return Array.from(months).sort((a, b) => parseInt(a) - parseInt(b));
  }, [trades]);
  
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    trades.forEach(trade => {
      const date = new Date(trade.entry_date || trade.created_at);
      years.add(date.getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [trades]);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const hasActiveFilters = filters.selectedMonth !== 'all' || filters.selectedYear !== 'all';
  
  const clearFilters = () => {
    dispatchFilters({ type: 'RESET_FILTERS' });
  };

  // Only count closed trades for win rate
  const closedTrades = trades.filter(t => t.status === 'closed');
  const stats = {
    totalTrades: trades.length,
    openTrades: trades.filter(t => t.status === 'open').length,
    winningTrades: closedTrades.filter(t => t.pnl && t.pnl > 0).length,
    totalPnl: closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    winRate: closedTrades.length > 0 
      ? Math.round((closedTrades.filter(t => t.pnl && t.pnl > 0).length / closedTrades.length) * 100)
      : 0,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Trading Journal</h2>
          <p className="text-muted-foreground mb-6">Sign in to track your trades</p>
          <button
            onClick={() => navigate("/signin")}
            className="h-12 px-8 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            Sign In
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Trading Journal</h1>
            <p className="text-sm text-muted-foreground">Track and analyze your trades</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              aria-label="Export trades to CSV"
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <Download className="w-5 h-5 text-foreground" aria-hidden="true" />
            </button>
            <button
              onClick={() => dispatchModals({ type: 'OPEN_CSV_IMPORT' })}
              aria-label="Import trades from CSV"
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <Upload className="w-5 h-5 text-foreground" aria-hidden="true" />
            </button>
            <button
              onClick={() => dispatchModals({ type: 'OPEN_ANALYTICS' })}
              aria-label="View analytics"
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <BarChart3 className="w-5 h-5 text-foreground" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="px-6 mb-4 animate-slide-up">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Total Trades</p>
            <p className="text-2xl font-bold text-foreground">{stats.totalTrades}</p>
          </div>
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Open Trades</p>
            <p className="text-2xl font-bold text-foreground">{stats.openTrades}</p>
          </div>
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold text-foreground">
              {closedTrades.length > 0 ? `${stats.winRate}%` : "—"}
            </p>
          </div>
          <div className={`rounded-2xl p-4 ${stats.totalPnl >= 0 ? 'bg-secondary' : 'bg-destructive/10'}`}>
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-foreground' : 'text-destructive'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 mb-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={filters.searchQuery}
            onChange={(e) => dispatchFilters({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
            placeholder="Search trades..."
            aria-label="Search trades"
            className="w-full h-12 pl-12 pr-4 bg-secondary text-foreground rounded-xl outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
      </div>

      {/* Filter */}
      <div className="px-6 mb-4">
        <div className="flex gap-2 items-center">
          <div className="flex gap-2 flex-1" role="group" aria-label="Filter trades by status">
            {(['all', 'open', 'closed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => dispatchFilters({ type: 'SET_FILTER', payload: f })}
                aria-pressed={filters.filter === f}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  filters.filter === f 
                    ? 'bg-foreground text-background' 
                    : 'bg-secondary text-foreground'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => dispatchFilters({ type: 'TOGGLE_FILTERS' })}
            aria-label="Toggle filters"
            aria-expanded={filters.showFilters}
            aria-pressed={hasActiveFilters}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 relative ${
              hasActiveFilters
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-foreground'
            }`}
          >
            <Filter className="w-4 h-4" aria-hidden="true" />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
            )}
          </button>
        </div>
      </div>
      
      {/* Advanced Filters */}
      {filters.showFilters && (
        <div className="px-6 mb-4 space-y-3 animate-slide-up">
          <div className="bg-secondary rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {/* Month Filter */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Month</label>
              <select
                value={filters.selectedMonth}
                onChange={(e) => dispatchFilters({ type: 'SET_MONTH', payload: e.target.value })}
                className="w-full h-10 px-3 bg-background text-foreground rounded-lg outline-none text-sm"
              >
                <option value="all">All Months</option>
                {availableMonths.map(month => (
                  <option key={month} value={month}>
                    {monthNames[parseInt(month) - 1]}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Year Filter */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Year</label>
              <select
                value={filters.selectedYear}
                onChange={(e) => dispatchFilters({ type: 'SET_YEAR', payload: e.target.value })}
                className="w-full h-10 px-3 bg-background text-foreground rounded-lg outline-none text-sm"
              >
                <option value="all">All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Trades List */}
      <main className="flex-1 px-6 space-y-3 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-secondary rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No trades yet</p>
            <p className="text-sm text-muted-foreground mt-1">Tap + to add your first trade</p>
          </div>
        ) : (
          filteredTrades.map((trade) => (
            <div
              key={trade.id}
              className="bg-secondary rounded-2xl p-4 animate-fade-in"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {trade.direction === 'long' ? (
                    <TrendingUp className="w-5 h-5 text-foreground" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                  <span className="font-bold text-foreground">{trade.pair}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    trade.status === 'open' 
                      ? 'bg-foreground/10 text-foreground' 
                      : trade.status === 'closed'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {trade.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {formatDate(trade.entry_date || trade.created_at)}
                    </span>
                  </div>
                  {trade.status === 'open' && (
                    <button
                      onClick={() => openEditModal(trade)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                {trade.entry_price && (
                  <div>
                    <p className="text-muted-foreground">Entry</p>
                    <p className="font-medium text-foreground">{trade.entry_price}</p>
                  </div>
                )}
                {trade.stop_loss && (
                  <div>
                    <p className="text-muted-foreground">SL</p>
                    <p className="font-medium text-foreground">{trade.stop_loss}</p>
                  </div>
                )}
                {trade.take_profit && (
                  <div>
                    <p className="text-muted-foreground">TP</p>
                    <p className="font-medium text-foreground">{trade.take_profit}</p>
                  </div>
                )}
              </div>

              {trade.notes && (
                <p className="text-sm text-muted-foreground mb-3">{trade.notes}</p>
              )}

              {trade.status === 'open' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => dispatchModals({ type: 'OPEN_CLOSE_TRADE', payload: trade })}
                    className="flex-1 h-10 bg-background text-foreground text-sm font-medium rounded-xl flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Close Trade
                  </button>
                  <button
                    onClick={() => dispatchModals({ type: 'OPEN_DELETE_CONFIRM', payload: trade.id })}
                    className="h-10 w-10 bg-destructive/10 text-destructive rounded-xl flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {trade.status === 'closed' && trade.pnl !== null && (
                <div className={`text-center py-2 rounded-xl ${
                  trade.pnl >= 0 ? 'bg-foreground/5' : 'bg-destructive/10'
                }`}>
                  <span className={`font-bold ${
                    trade.pnl >= 0 ? 'text-foreground' : 'text-destructive'
                  }`}>
                    P&L: {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* Trade Limit Banner for Free Users */}
      {!isPaid && showLimitBanner && (
        <div className="fixed bottom-24 left-0 right-0 px-6 z-40">
          <div className="bg-secondary/80 backdrop-blur-sm border border-border rounded-lg p-3 text-center flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground flex-1">
              {tradeCount}/{FREE_TRADE_LIMIT} trades used. 
              {isAtTradeLimit ? (
                <span className="text-orange-500 font-semibold"> Upgrade for unlimited trades!</span>
              ) : (
                <span> {FREE_TRADE_LIMIT - tradeCount} remaining</span>
              )}
            </p>
            <button
              onClick={() => setShowLimitBanner(false)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss limit banner"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Add Trade FAB */}
      <button
        onClick={() => {
          if (!canAddTrade) {
            dispatchModals({ type: 'SHOW_UPGRADE_MODAL' });
            return;
          }
          dispatchModals({ type: 'SET_EDITING_TRADE', payload: null });
          resetForm();
          dispatchModals({ type: 'OPEN_ADD_TRADE' });
        }}
        aria-label="Add new trade (Ctrl+N)"
        title="Add new trade (Ctrl+N)"
        disabled={isAtTradeLimit}
        className={`fixed bottom-28 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
          isAtTradeLimit 
            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' 
            : 'bg-foreground text-background active:scale-95'
        }`}
      >
        <Plus className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Upgrade Modal - When User Tries to Add Trade at Limit */}
      {modals.showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-secondary rounded-2xl max-w-sm w-full p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-2">Trade Limit Reached</h2>
            <p className="text-muted-foreground mb-6">
              You've used all {FREE_TRADE_LIMIT} free trades. Upgrade to Premium for unlimited journal entries and advanced analytics.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => dispatchModals({ type: 'CLOSE_UPGRADE_MODAL' })}
                className="flex-1 px-4 py-2 rounded-lg bg-background text-foreground font-medium hover:bg-background/80 transition-colors"
              >
                Maybe Later
              </button>
              <button
                onClick={() => navigate('/upgrade')}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Prompt for Free Users at Limit */}
      {isAtTradeLimit && (
        <div className="fixed inset-x-0 bottom-44 px-6 z-40">
          <UpgradePrompt
            feature="unlimited journal entries"
            title="Trade Limit Reached"
            description={`You've used all ${FREE_TRADE_LIMIT} free trades. Upgrade to Premium for unlimited journal entries and advanced analytics.`}
            cta="Upgrade to Premium"
            tier="premium"
          />
        </div>
      )}

      {/* Add/Edit Trade Modal */}
      {modals.showAddTrade && (
        <div 
          ref={modalRef}
          className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trade-modal-title"
        >
          <header className="pt-12 pb-4 px-6 flex items-center justify-between">
            <h2 id="trade-modal-title" className="text-xl font-bold text-foreground">
              {modals.editingTrade ? 'Edit Trade' : 'New Trade'}
            </h2>
            <button
              onClick={() => {
                dispatchModals({ type: 'CLOSE_ADD_TRADE' });
                dispatchModals({ type: 'SET_EDITING_TRADE', payload: null });
                setSelectedScreenshots([]);
              }}
              aria-label="Close dialog (Esc)"
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center"
            >
              <X className="w-5 h-5 text-foreground" aria-hidden="true" />
            </button>
          </header>

          {/* Journal Type Toggle */}
          <div className="px-6 pb-4 flex gap-2">
            <button
              onClick={() => {
                setJournalView('structured');
                setNewTrade({ ...newTrade, journal_type: 'structured' });
              }}
              className={`flex-1 h-10 rounded-lg font-medium transition-colors ${
                journalView === 'structured'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Structured
            </button>
            <button
              onClick={() => {
                setJournalView('notes');
                setNewTrade({ ...newTrade, journal_type: 'notes' });
              }}
              className={`flex-1 h-10 rounded-lg font-medium transition-colors ${
                journalView === 'notes'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Notes
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {journalView === 'structured' && (
              <>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Currency Pair</label>
                  <input
                    type="text"
                    value={newTrade.pair}
                    onChange={(e) => setNewTrade({ ...newTrade, pair: e.target.value.toUpperCase() })}
                    className="w-full h-12 px-4 bg-secondary text-foreground rounded-xl outline-none"
                    placeholder="EUR/USD"
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Direction</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewTrade({ ...newTrade, direction: 'long' })}
                      className={`flex-1 h-12 rounded-xl font-medium flex items-center justify-center gap-2 ${
                        newTrade.direction === 'long' 
                          ? 'bg-foreground text-background' 
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      <TrendingUp className="w-5 h-5" />
                      Long
                    </button>
                    <button
                      onClick={() => setNewTrade({ ...newTrade, direction: 'short' })}
                      className={`flex-1 h-12 rounded-xl font-medium flex items-center justify-center gap-2 ${
                        newTrade.direction === 'short' 
                          ? 'bg-destructive text-background' 
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      <TrendingDown className="w-5 h-5" />
                      Short
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Entry Price</label>
                    <input
                      type="number"
                      value={newTrade.entry_price}
                      onChange={(e) => setNewTrade({ ...newTrade, entry_price: e.target.value })}
                      className="w-full h-12 px-4 bg-secondary text-foreground rounded-xl outline-none"
                      placeholder="1.0850"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Position Size</label>
                    <input
                      type="number"
                      value={newTrade.position_size}
                      onChange={(e) => setNewTrade({ ...newTrade, position_size: e.target.value })}
                      className="w-full h-12 px-4 bg-secondary text-foreground rounded-xl outline-none"
                      placeholder="0.10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Stop Loss</label>
                    <input
                      type="number"
                      value={newTrade.stop_loss}
                      onChange={(e) => setNewTrade({ ...newTrade, stop_loss: e.target.value })}
                      className="w-full h-12 px-4 bg-secondary text-foreground rounded-xl outline-none"
                      placeholder="1.0800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Take Profit</label>
                    <input
                      type="number"
                      value={newTrade.take_profit}
                      onChange={(e) => setNewTrade({ ...newTrade, take_profit: e.target.value })}
                      className="w-full h-12 px-4 bg-secondary text-foreground rounded-xl outline-none"
                      placeholder="1.0950"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">Risk %</label>
                  <input
                    type="number"
                    value={newTrade.risk_percent}
                    onChange={(e) => setNewTrade({ ...newTrade, risk_percent: e.target.value })}
                    className="w-full h-12 px-4 bg-secondary text-foreground rounded-xl outline-none"
                    placeholder="1"
                  />
                </div>
              </>
            )}

            {journalView === 'structured' && (
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Notes</label>
                <textarea
                  value={newTrade.notes}
                  onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                  className="w-full h-24 px-4 py-3 bg-secondary text-foreground rounded-xl outline-none resize-none"
                  placeholder="Trade setup notes..."
                />
              </div>
            )}

            {journalView === 'notes' && (
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Journal Entry</label>
                <RichNoteEditor
                  content={newTrade.rich_content}
                  onChange={(content) => setNewTrade({ ...newTrade, rich_content: content })}
                  placeholder="Write your trade journal entry..."
                />
              </div>
            )}

            {/* Screenshots Section - Only for Notes View */}
            {!modals.editingTrade && journalView === 'notes' && (
              <div>
                <label className="block text-sm text-muted-foreground mb-2">Screenshots</label>
                <div className="space-y-2">
                  {selectedScreenshots.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {selectedScreenshots.map((file, i) => (
                        <div key={i} className="relative aspect-video bg-secondary rounded-xl overflow-hidden">
                          <img 
                            src={URL.createObjectURL(file)} 
                            alt={`Preview ${i + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => setSelectedScreenshots(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 w-6 h-6 bg-destructive text-background rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="block border border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-foreground/50 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleScreenshotSelect}
                      className="hidden"
                    />
                    <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Tap to add screenshots</p>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 pb-8">
            <button
              onClick={modals.editingTrade ? handleEditTrade : handleAddTrade}
              className="w-full h-14 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              {modals.editingTrade ? 'Update Trade' : 'Add Trade'}
            </button>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {modals.showAnalytics && (
        <JournalAnalytics trades={filteredTrades} onClose={() => dispatchModals({ type: 'CLOSE_ANALYTICS' })} />
      )}

      {/* CSV Import Modal */}
      {modals.showCSVImport && (
        <CSVImport onImport={handleImportTrades} onClose={() => dispatchModals({ type: 'CLOSE_CSV_IMPORT' })} />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={modals.deleteConfirm.isOpen}
        onClose={() => dispatchModals({ type: 'CLOSE_DELETE_CONFIRM' })}
        onConfirm={() => {
          if (modals.deleteConfirm.tradeId) {
            handleDeleteTrade(modals.deleteConfirm.tradeId);
          }
        }}
        title="Delete Trade"
        description="Are you sure you want to delete this trade? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />

      {/* P&L Input Modal */}
      <PnLInputModal
        isOpen={modals.closeTradeModal.isOpen}
        onClose={() => dispatchModals({ type: 'CLOSE_CLOSE_TRADE' })}
        onConfirm={(pnl) => {
          if (modals.closeTradeModal.trade) {
            handleCloseTrade(modals.closeTradeModal.trade.id, pnl);
          }
          dispatchModals({ type: 'CLOSE_CLOSE_TRADE' });
        }}
        pair={modals.closeTradeModal.trade?.pair || ""}
      />

      <BottomNav />
    </div>
  );
};

export default Journal;