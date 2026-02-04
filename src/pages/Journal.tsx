import { useState, useEffect, useMemo, useReducer, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
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
import { useNotifications } from "@/hooks/use-notifications";
import { logger } from "@/lib/logger";
import { BottomNav } from "@/components/BottomNav";
import { JournalAnalytics } from "@/components/JournalAnalytics";
import { CSVImport } from "@/components/CSVImport";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { PnLInputModal } from "@/components/PnLInputModal";
import { RichNoteEditor } from "@/components/RichNoteEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateTrades, MAX_TRADES_PER_IMPORT, type ValidatedTrade } from "@/lib/tradeValidation";
import { filtersReducer, initialFiltersState, modalReducer, initialModalState } from "@/lib/journalReducers";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { tradesApi, uploadsApi } from "@/lib/api";

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
  const { sendNotification, permission } = useNotifications();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedScreenshots, setSelectedScreenshots] = useState<File[]>([]);
  const [showLimitBanner, setShowLimitBanner] = useState(true);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const [swipeState, setSwipeState] = useState<{
    tradeId: string | null;
    offset: number;
    dragging: boolean;
    moved: boolean;
    actionSide: "left" | "right" | null;
  }>({
    tradeId: null,
    offset: 0,
    dragging: false,
    moved: false,
    actionSide: null,
  });
  
  // Free tier limits
  const FREE_TRADE_LIMIT = 5;
  const tradeCount = trades.length;
  const isAtTradeLimit = !isPaid && tradeCount >= FREE_TRADE_LIMIT;
  const canAddTrade = isPaid || tradeCount < FREE_TRADE_LIMIT;
  
  // Use reducers for filters and modals (performance optimization)
  const [filters, dispatchFilters] = useReducer(filtersReducer, initialFiltersState);
  const [modals, dispatchModals] = useReducer(modalReducer, initialModalState);

  // Notes-only journal form
  const [newTrade, setNewTrade] = useState({
    notes: "",
    journal_type: "notes" as 'notes',
    rich_content: null,
    images: [],
    links: [],
    market_condition: "" as 'bullish' | 'bearish' | 'sideways' | '',
    sentiment: "" as 'bullish' | 'neutral' | 'bearish' | '',
    tags: "" as string,
  });

  // Helper to convert TipTap JSON to HTML
  const convertRichContentToHTML = (content: any): string => {
    if (!content) return '';
    try {
      return generateHTML(content, [
        StarterKit,
        Link,
        Image,
      ]);
    } catch (error) {
      console.error('Error converting rich content:', error);
      return '';
    }
  };

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

  const normalizeTrade = (trade: any): Trade => {
    const entryDate = trade.entry_date || trade.trade_date || trade.created_at || null;
    return {
      ...trade,
      pair: trade.pair || trade.symbol || 'JOURNAL',
      entry_date: entryDate ? new Date(entryDate).toISOString() : null,
    } as Trade;
  };

  const fetchTrades = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await tradesApi.getAll();
      const normalized = (data || []).map(normalizeTrade);
      setTrades(normalized);
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

  const hasMeaningfulJournalContent = (content: any, fallbackText: string) => {
    const html = convertRichContentToHTML(content);
    const plainText = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    return plainText.length > 0 || /<img\b/i.test(html) || fallbackText.trim().length > 0;
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

    if (!hasMeaningfulJournalContent(newTrade.rich_content, newTrade.notes)) {
      toast.error("Please add a journal note before saving");
      return;
    }

    try {
      const tradeData = {
        user_id: user.id,
        symbol: 'JOURNAL',
        direction: 'buy',
        notes: newTrade.notes || null,
        journal_type: 'notes',
        rich_content: newTrade.rich_content || null,
        images: (newTrade.images && newTrade.images.length > 0) ? newTrade.images : null,
        links: (newTrade.links && newTrade.links.length > 0) ? newTrade.links : null,
        market_condition: newTrade.market_condition || null,
        tags: newTrade.tags || null,
        status: 'open',
        trade_date: new Date().toISOString().split('T')[0],
      };

      const data = await tradesApi.create(tradeData);
      
      if (selectedScreenshots.length > 0 && data) {
        await uploadScreenshots(data.id);
      }
      
      toast.success("Trade added");
      
      // Send push notification for new log entry
      sendNotification('📝 Journal Entry Added', {
        body: 'New journal note added successfully',
        tag: 'journal-add',
        icon: '/pwa-192x192.png'
      });
      
      // Check if free tier user just hit their limit
      const newTradeCount = tradeCount + 1;
      if (!isPaid && newTradeCount >= FREE_TRADE_LIMIT) {
        sendNotification('⚠️ Journal Limit Reached', {
          body: `You've reached your ${FREE_TRADE_LIMIT} free journal entries. Upgrade to add unlimited entries!`,
          tag: 'journal-limit',
          icon: '/pwa-192x192.png',
          requireInteraction: true
        });
      }
      
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

    if (!hasMeaningfulJournalContent(newTrade.rich_content, newTrade.notes)) {
      toast.error("Please add a journal note before saving");
      return;
    }

    try {
      const updates = {
        symbol: 'JOURNAL',
        direction: 'buy',
        notes: newTrade.notes || null,
        journal_type: 'notes',
        rich_content: newTrade.rich_content || null,
        images: (newTrade.images && newTrade.images.length > 0) ? newTrade.images : null,
        links: (newTrade.links && newTrade.links.length > 0) ? newTrade.links : null,
        market_condition: newTrade.market_condition || null,
        tags: newTrade.tags || null,
      };

      await tradesApi.update(modals.editingTrade.id, updates);
      toast.success("Trade updated");
      
      // Send push notification for updated log entry
      sendNotification('✏️ Journal Entry Updated', {
        body: 'Journal note updated successfully',
        tag: 'journal-update',
        icon: '/pwa-192x192.png'
      });
      
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
      notes: "",
      journal_type: "notes",
      rich_content: null,
      images: [],
      links: [],
      market_condition: "",
      sentiment: "",
      tags: "",
    });
    setSelectedScreenshots([]);
  };

  const openEditModal = (trade: Trade) => {
    dispatchModals({ type: 'SET_EDITING_TRADE', payload: trade });
    setNewTrade({
      notes: trade.notes || "",
      journal_type: "notes",
      rich_content: trade.rich_content || null,
      images: trade.images || [],
      links: trade.links || [],
      market_condition: trade.market_condition || "",
      sentiment: "",
      tags: trade.tags || "",
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
      
      // Send push notification for deleted log entry
      sendNotification('🗑️ Journal Entry Deleted', {
        body: 'Journal entry has been permanently deleted',
        tag: 'journal-delete',
        icon: '/pwa-192x192.png'
      });
      
      fetchTrades();
    } catch (error) {
      toast.error("Failed to delete trade");
    }
  };

  const handleArchiveTrade = async (tradeId: string) => {
    if (!user) return;

    try {
      await tradesApi.update(tradeId, {
        status: "cancelled",
      });
      toast.success("Journal entry archived");
      fetchTrades();
    } catch (error) {
      toast.error("Failed to archive journal entry");
    }
  };

  const SWIPE_ACTION_THRESHOLD = 82;
  const SWIPE_MAX_DISTANCE = 108;

  const startSwipe = (tradeId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    swipeStartXRef.current = e.clientX;
    swipeStartYRef.current = e.clientY;
    setSwipeState({
      tradeId,
      offset: 0,
      dragging: true,
      moved: false,
      actionSide: null,
    });
  };

  const moveSwipe = (tradeId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeState.dragging || swipeState.tradeId !== tradeId || swipeStartXRef.current === null || swipeStartYRef.current === null) {
      return;
    }

    const deltaX = e.clientX - swipeStartXRef.current;
    const deltaY = e.clientY - swipeStartYRef.current;

    // Keep vertical page scrolling smooth; only lock into horizontal when intent is clear.
    if (!swipeState.moved && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      setSwipeState({
        tradeId: null,
        offset: 0,
        dragging: false,
        moved: false,
      });
      return;
    }

    const clamped = Math.max(-SWIPE_MAX_DISTANCE, Math.min(SWIPE_MAX_DISTANCE, deltaX));
    const actionSide =
      clamped <= -SWIPE_ACTION_THRESHOLD ? "left" : clamped >= SWIPE_ACTION_THRESHOLD ? "right" : null;
    setSwipeState((prev) => ({
      ...prev,
      offset: clamped,
      moved: prev.moved || Math.abs(clamped) > 8,
      actionSide,
    }));
  };

  const endSwipe = async (trade: Trade) => {
    if (!swipeState.dragging || swipeState.tradeId !== trade.id) return;

    const offset = swipeState.offset;
    const moved = swipeState.moved;

    setSwipeState({
      tradeId: null,
      offset: 0,
      dragging: false,
      moved: false,
      actionSide: null,
    });
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;

    if (offset <= -SWIPE_ACTION_THRESHOLD) {
      dispatchModals({ type: "OPEN_DELETE_CONFIRM", payload: trade.id });
      return;
    }

    if (offset >= SWIPE_ACTION_THRESHOLD) {
      await handleArchiveTrade(trade.id);
      return;
    }

    if (!moved) {
      dispatchModals({ type: "OPEN_VIEW_TRADE", payload: trade });
    }
  };

  const cancelSwipe = () => {
    setSwipeState({
      tradeId: null,
      offset: 0,
      dragging: false,
      moved: false,
      actionSide: null,
    });
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
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
            <div key={trade.id} className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-between px-4 bg-[#111317]">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide transition-all duration-150 ${
                    swipeState.tradeId === trade.id && swipeState.actionSide === "right"
                      ? "text-emerald-300 scale-110"
                      : "text-emerald-400/85"
                  }`}
                >
                  Archive
                </span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide transition-all duration-150 ${
                    swipeState.tradeId === trade.id && swipeState.actionSide === "left"
                      ? "text-red-300 scale-110"
                      : "text-red-400/85"
                  }`}
                >
                  Delete
                </span>
              </div>

              <div
                className={`bg-secondary rounded-2xl p-4 animate-fade-in cursor-pointer hover:bg-secondary/80 ${
                  swipeState.dragging && swipeState.tradeId === trade.id
                    ? ""
                    : "transition-transform duration-200 ease-out"
                } ${
                  swipeState.tradeId === trade.id && swipeState.actionSide === "left"
                    ? "ring-1 ring-red-400/60 shadow-[0_0_0_1px_rgba(248,113,113,0.25),0_12px_24px_-16px_rgba(248,113,113,0.65)]"
                    : ""
                } ${
                  swipeState.tradeId === trade.id && swipeState.actionSide === "right"
                    ? "ring-1 ring-emerald-400/60 shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_12px_24px_-16px_rgba(52,211,153,0.65)]"
                    : ""
                }`}
                style={{
                  transform: `translateX(${swipeState.tradeId === trade.id ? swipeState.offset : 0}px)`,
                  touchAction: "pan-y",
                }}
                onPointerDown={(e) => startSwipe(trade.id, e)}
                onPointerMove={(e) => moveSwipe(trade.id, e)}
                onPointerUp={() => endSwipe(trade)}
                onPointerCancel={cancelSwipe}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {trade.direction === 'buy' ? (
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
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(trade.entry_date || trade.created_at)}</span>
                  </div>
                </div>

                {/* Preview Content */}
                {trade.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{trade.notes}</p>
                )}
                
                {trade.journal_type === 'notes' && trade.rich_content && (
                  <p className="text-sm text-muted-foreground italic">Rich journal entry...</p>
                )}

                {/* Entry Price Preview */}
                {trade.entry_price && (
                  <div className="mt-2 text-xs">
                    <span className="text-muted-foreground">Entry: </span>
                    <span className="font-medium text-foreground">{trade.entry_price}</span>
                  </div>
                )}
              </div>
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

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#121417] p-4">
                <div>
                  <label className="block text-sm text-muted-foreground/90 mb-2">Journal Entry</label>
                  <RichNoteEditor
                    content={newTrade.rich_content}
                    onChange={(content) => setNewTrade({ ...newTrade, rich_content: content })}
                    placeholder="Write your trade journal entry..."
                  />
                </div>

                {/* Metadata for Notes */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Market Condition */}
                  <div>
                    <label className="block text-sm text-muted-foreground/90 mb-2">Market Condition</label>
                    <Select
                      value={newTrade.market_condition || ""}
                      onValueChange={(value) => setNewTrade({ ...newTrade, market_condition: value as any })}
                    >
                      <SelectTrigger className="w-full h-11 px-3 bg-[#171a1f] text-foreground rounded-2xl border border-white/10 focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/25 transition-all">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bullish">Bullish</SelectItem>
                        <SelectItem value="bearish">Bearish</SelectItem>
                        <SelectItem value="sideways">Sideways</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sentiment */}
                  <div>
                    <label className="block text-sm text-muted-foreground/90 mb-2">Sentiment</label>
                    <Select
                      value={newTrade.sentiment || ""}
                      onValueChange={(value) => setNewTrade({ ...newTrade, sentiment: value as any })}
                    >
                      <SelectTrigger className="w-full h-11 px-3 bg-[#171a1f] text-foreground rounded-2xl border border-white/10 focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/25 transition-all">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bullish">Bullish</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="bearish">Bearish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tags */}
                  <div className="col-span-2">
                    <label className="block text-sm text-muted-foreground/90 mb-2">Tags</label>
                    <input
                      type="text"
                      value={newTrade.tags}
                      onChange={(e) => setNewTrade({ ...newTrade, tags: e.target.value })}
                      placeholder="e.g. breakout, support"
                      className="w-full h-11 px-3 bg-[#171a1f] text-foreground rounded-2xl outline-none border border-white/10 focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/25 transition-all placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>
            </div>

            {/* Screenshots Section */}
            {!modals.editingTrade && (
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
                  <label className="block border border-dashed border-white/15 rounded-2xl p-6 text-center cursor-pointer hover:border-white/35 transition-colors bg-[#111317]">
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
              className="w-full h-14 bg-[#F2F2F7] text-[#111111] font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.5)]"
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

      {/* View Trade Modal */}
      {modals.viewTradeModal.isOpen && modals.viewTradeModal.trade && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => dispatchModals({ type: 'CLOSE_VIEW_TRADE' })}
                className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-foreground">Journal Entry</h2>
              <button
                onClick={() => {
                  openEditModal(modals.viewTradeModal.trade!);
                  dispatchModals({ type: 'CLOSE_VIEW_TRADE' });
                }}
                className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 max-w-2xl mx-auto">
              {/* Trade Info Card */}
              <div className="bg-secondary rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  {modals.viewTradeModal.trade.direction === 'buy' ? (
                    <TrendingUp className="w-6 h-6 text-foreground" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-destructive" />
                  )}
                  <span className="text-xl font-bold text-foreground">
                    {modals.viewTradeModal.trade.pair}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    modals.viewTradeModal.trade.status === 'open' 
                      ? 'bg-foreground/10 text-foreground' 
                      : modals.viewTradeModal.trade.status === 'closed'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-destructive/10 text-destructive'
                  }`}>
                    {modals.viewTradeModal.trade.status}
                  </span>
                </div>

                {/* Trade Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {modals.viewTradeModal.trade.entry_price && (
                    <div>
                      <p className="text-muted-foreground mb-1">Entry Price</p>
                      <p className="font-medium text-foreground">{modals.viewTradeModal.trade.entry_price}</p>
                    </div>
                  )}
                  {modals.viewTradeModal.trade.position_size && (
                    <div>
                      <p className="text-muted-foreground mb-1">Position Size</p>
                      <p className="font-medium text-foreground">{modals.viewTradeModal.trade.position_size}</p>
                    </div>
                  )}
                  {modals.viewTradeModal.trade.stop_loss && (
                    <div>
                      <p className="text-muted-foreground mb-1">Stop Loss</p>
                      <p className="font-medium text-foreground">{modals.viewTradeModal.trade.stop_loss}</p>
                    </div>
                  )}
                  {modals.viewTradeModal.trade.take_profit && (
                    <div>
                      <p className="text-muted-foreground mb-1">Take Profit</p>
                      <p className="font-medium text-foreground">{modals.viewTradeModal.trade.take_profit}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground mb-1">Date</p>
                    <p className="font-medium text-foreground">
                      {formatDate(modals.viewTradeModal.trade.entry_date || modals.viewTradeModal.trade.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Type</p>
                    <p className="font-medium text-foreground capitalize">
                      {modals.viewTradeModal.trade.journal_type || 'structured'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes/Rich Content */}
              {modals.viewTradeModal.trade.notes && (
                <div className="bg-secondary rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {modals.viewTradeModal.trade.notes}
                  </p>
                </div>
              )}

              {modals.viewTradeModal.trade.rich_content && (
                <div className="bg-secondary rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Journal Entry</h3>
                  <div className="prose prose-invert max-w-none text-foreground
                    prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground
                    prose-em:text-foreground prose-a:text-primary prose-code:text-foreground
                    prose-li:text-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-l-primary
                    prose-img:rounded-lg">
                    <div dangerouslySetInnerHTML={{ 
                      __html: convertRichContentToHTML(modals.viewTradeModal.trade.rich_content)
                    }} />
                  </div>
                </div>
              )}

              {/* Metadata */}
              {(modals.viewTradeModal.trade.market_condition || modals.viewTradeModal.trade.tags) && (
                <div className="bg-secondary rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Metadata</h3>
                  <div className="space-y-2 text-sm">
                    {modals.viewTradeModal.trade.market_condition && (
                      <div>
                        <span className="text-muted-foreground">Market Condition: </span>
                        <span className="text-foreground capitalize">{modals.viewTradeModal.trade.market_condition}</span>
                      </div>
                    )}
                    {modals.viewTradeModal.trade.tags && (
                      <div>
                        <span className="text-muted-foreground">Tags: </span>
                        <span className="text-foreground">{modals.viewTradeModal.trade.tags}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* P&L for closed trades */}
              {modals.viewTradeModal.trade.status === 'closed' && modals.viewTradeModal.trade.pnl !== null && (
                <div className={`rounded-2xl p-4 text-center ${
                  modals.viewTradeModal.trade.pnl >= 0 ? 'bg-foreground/5' : 'bg-destructive/10'
                }`}>
                  <p className="text-sm text-muted-foreground mb-1">Profit & Loss</p>
                  <p className={`text-2xl font-bold ${
                    modals.viewTradeModal.trade.pnl >= 0 ? 'text-foreground' : 'text-destructive'
                  }`}>
                    {modals.viewTradeModal.trade.pnl >= 0 ? '+' : ''}{modals.viewTradeModal.trade.pnl.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Journal;
