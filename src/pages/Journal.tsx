import { useState, useEffect, useMemo } from "react";
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
  Edit2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { BottomNav } from "@/components/BottomNav";
import { JournalAnalytics } from "@/components/JournalAnalytics";
import { CSVImport } from "@/components/CSVImport";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PnLInputModal } from "@/components/PnLInputModal";
import { Skeleton } from "@/components/ui/skeleton";
import { validateTrades, MAX_TRADES_PER_IMPORT, type ValidatedTrade } from "@/lib/tradeValidation";

interface Trade {
  id: string;
  pair: string;
  direction: 'long' | 'short';
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
}

const Journal = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedScreenshots, setSelectedScreenshots] = useState<File[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit mode
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  
  // Dialogs
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; tradeId: string | null }>({ isOpen: false, tradeId: null });
  const [closeTradeModal, setCloseTradeModal] = useState<{ isOpen: boolean; trade: Trade | null }>({ isOpen: false, trade: null });

  // New trade form
  const [newTrade, setNewTrade] = useState({
    pair: "EUR/USD",
    direction: "long" as 'long' | 'short',
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    position_size: "",
    risk_percent: "",
    notes: "",
  });

  useEffect(() => {
    if (user) {
      fetchTrades();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const fetchTrades = async () => {
    if (!user) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('trading_journal')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching trades:', error);
      toast.error("Failed to load trades");
    } else {
      setTrades(data || []);
    }
    setIsLoading(false);
  };

  const uploadScreenshots = async (tradeId: string): Promise<string[]> => {
    if (!user || selectedScreenshots.length === 0) return [];
    
    const urls: string[] = [];
    
    for (const file of selectedScreenshots) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${tradeId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('trade-screenshots')
        .upload(fileName, file);
      
      if (!error) {
        const { data } = supabase.storage
          .from('trade-screenshots')
          .getPublicUrl(fileName);
        urls.push(data.publicUrl);
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

    if (!newTrade.pair) {
      toast.error("Please enter a currency pair");
      return;
    }

    const { data, error } = await supabase
      .from('trading_journal')
      .insert({
        user_id: user.id,
        pair: newTrade.pair,
        direction: newTrade.direction,
        entry_price: newTrade.entry_price ? parseFloat(newTrade.entry_price) : null,
        stop_loss: newTrade.stop_loss ? parseFloat(newTrade.stop_loss) : null,
        take_profit: newTrade.take_profit ? parseFloat(newTrade.take_profit) : null,
        position_size: newTrade.position_size ? parseFloat(newTrade.position_size) : null,
        risk_percent: newTrade.risk_percent ? parseFloat(newTrade.risk_percent) : null,
        notes: newTrade.notes || null,
        status: 'open',
        entry_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error('Error adding trade:', error);
      toast.error("Failed to add trade");
    } else {
      if (selectedScreenshots.length > 0 && data) {
        await uploadScreenshots(data.id);
      }
      
      toast.success("Trade added");
      setShowAddTrade(false);
      resetForm();
      fetchTrades();
    }
  };

  const handleEditTrade = async () => {
    if (!user || !editingTrade) return;

    const { error } = await supabase
      .from('trading_journal')
      .update({
        pair: newTrade.pair,
        direction: newTrade.direction,
        entry_price: newTrade.entry_price ? parseFloat(newTrade.entry_price) : null,
        stop_loss: newTrade.stop_loss ? parseFloat(newTrade.stop_loss) : null,
        take_profit: newTrade.take_profit ? parseFloat(newTrade.take_profit) : null,
        position_size: newTrade.position_size ? parseFloat(newTrade.position_size) : null,
        risk_percent: newTrade.risk_percent ? parseFloat(newTrade.risk_percent) : null,
        notes: newTrade.notes || null,
      })
      .eq('id', editingTrade.id)
      .eq('user_id', user.id);

    if (error) {
      toast.error("Failed to update trade");
    } else {
      toast.success("Trade updated");
      setShowAddTrade(false);
      setEditingTrade(null);
      resetForm();
      fetchTrades();
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
    });
    setSelectedScreenshots([]);
  };

  const openEditModal = (trade: Trade) => {
    setEditingTrade(trade);
    setNewTrade({
      pair: trade.pair,
      direction: trade.direction,
      entry_price: trade.entry_price?.toString() || "",
      stop_loss: trade.stop_loss?.toString() || "",
      take_profit: trade.take_profit?.toString() || "",
      position_size: trade.position_size?.toString() || "",
      risk_percent: trade.risk_percent?.toString() || "",
      notes: trade.notes || "",
    });
    setShowAddTrade(true);
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
    
    const { error } = await supabase
      .from('trading_journal')
      .update({ 
        status: 'closed', 
        pnl,
        exit_date: new Date().toISOString() 
      })
      .eq('id', tradeId)
      .eq('user_id', user.id);

    if (error) {
      toast.error("Failed to close trade");
    } else {
      toast.success("Trade closed");
      fetchTrades();
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('trading_journal')
      .delete()
      .eq('id', tradeId)
      .eq('user_id', user.id);

    if (error) {
      toast.error("Failed to delete trade");
    } else {
      toast.success("Trade deleted");
      fetchTrades();
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
      const matchesFilter = filter === 'all' || trade.status === filter;
      const matchesSearch = searchQuery === "" || 
        trade.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [trades, filter, searchQuery]);

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
      <header className="pt-12 pb-6 px-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trading Journal</h1>
            <p className="text-muted-foreground">Track your trades</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <Download className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={() => setShowCSVImport(true)}
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <Upload className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={() => setShowAnalytics(true)}
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            >
              <BarChart3 className="w-5 h-5 text-foreground" />
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search trades..."
            className="w-full h-12 pl-12 pr-4 bg-secondary text-foreground rounded-xl outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
      </div>

      {/* Filter */}
      <div className="px-6 mb-4">
        <div className="flex gap-2">
          {(['all', 'open', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filter === f 
                  ? 'bg-foreground text-background' 
                  : 'bg-secondary text-foreground'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

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
                    onClick={() => setCloseTradeModal({ isOpen: true, trade })}
                    className="flex-1 h-10 bg-background text-foreground text-sm font-medium rounded-xl flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Close Trade
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, tradeId: trade.id })}
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

      {/* Add Trade FAB */}
      <button
        onClick={() => {
          setEditingTrade(null);
          resetForm();
          setShowAddTrade(true);
        }}
        className="fixed bottom-28 right-6 w-14 h-14 bg-foreground text-background rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add/Edit Trade Modal */}
      {showAddTrade && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
          <header className="pt-12 pb-4 px-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">
              {editingTrade ? 'Edit Trade' : 'New Trade'}
            </h2>
            <button
              onClick={() => {
                setShowAddTrade(false);
                setEditingTrade(null);
                setSelectedScreenshots([]);
              }}
              className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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

            <div>
              <label className="block text-sm text-muted-foreground mb-2">Notes</label>
              <textarea
                value={newTrade.notes}
                onChange={(e) => setNewTrade({ ...newTrade, notes: e.target.value })}
                className="w-full h-24 px-4 py-3 bg-secondary text-foreground rounded-xl outline-none resize-none"
                placeholder="Trade setup notes..."
              />
            </div>

            {/* Screenshots Section */}
            {!editingTrade && (
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
              onClick={editingTrade ? handleEditTrade : handleAddTrade}
              className="w-full h-14 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              {editingTrade ? 'Update Trade' : 'Add Trade'}
            </button>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && (
        <JournalAnalytics trades={trades} onClose={() => setShowAnalytics(false)} />
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <CSVImport onImport={handleImportTrades} onClose={() => setShowCSVImport(false)} />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, tradeId: null })}
        onConfirm={() => {
          if (deleteConfirm.tradeId) {
            handleDeleteTrade(deleteConfirm.tradeId);
          }
        }}
        title="Delete Trade"
        description="Are you sure you want to delete this trade? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />

      {/* P&L Input Modal */}
      <PnLInputModal
        isOpen={closeTradeModal.isOpen}
        onClose={() => setCloseTradeModal({ isOpen: false, trade: null })}
        onConfirm={(pnl) => {
          if (closeTradeModal.trade) {
            handleCloseTrade(closeTradeModal.trade.id, pnl);
          }
          setCloseTradeModal({ isOpen: false, trade: null });
        }}
        pair={closeTradeModal.trade?.pair || ""}
      />

      <BottomNav />
    </div>
  );
};

export default Journal;