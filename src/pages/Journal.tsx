import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  X,
  Check,
  Trash2,
  Edit2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

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
}

const Journal = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

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
      console.error('Error fetching trades:', error);
      toast.error("Failed to load trades");
    } else {
      setTrades(data || []);
    }
    setIsLoading(false);
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

    const { error } = await supabase
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
      });

    if (error) {
      console.error('Error adding trade:', error);
      toast.error("Failed to add trade");
    } else {
      toast.success("Trade added");
      setShowAddTrade(false);
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
      fetchTrades();
    }
  };

  const handleCloseTrade = async (tradeId: string, pnl: number) => {
    const { error } = await supabase
      .from('trading_journal')
      .update({ 
        status: 'closed', 
        pnl,
        exit_date: new Date().toISOString() 
      })
      .eq('id', tradeId);

    if (error) {
      toast.error("Failed to close trade");
    } else {
      toast.success("Trade closed");
      fetchTrades();
    }
  };

  const handleDeleteTrade = async (tradeId: string) => {
    const { error } = await supabase
      .from('trading_journal')
      .delete()
      .eq('id', tradeId);

    if (error) {
      toast.error("Failed to delete trade");
    } else {
      toast.success("Trade deleted");
      fetchTrades();
    }
  };

  const filteredTrades = trades.filter(trade => {
    if (filter === 'all') return true;
    return trade.status === filter;
  });

  const stats = {
    totalTrades: trades.length,
    openTrades: trades.filter(t => t.status === 'open').length,
    winningTrades: trades.filter(t => t.pnl && t.pnl > 0).length,
    totalPnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
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
        <h1 className="text-2xl font-bold text-foreground">Trading Journal</h1>
        <p className="text-muted-foreground">Track your trades</p>
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
              {stats.totalTrades > 0 
                ? `${Math.round((stats.winningTrades / stats.totalTrades) * 100)}%`
                : "—"}
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
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
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
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {formatDate(trade.entry_date || trade.created_at)}
                  </span>
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
                    onClick={() => handleCloseTrade(trade.id, 0)}
                    className="flex-1 h-10 bg-background text-foreground text-sm font-medium rounded-xl flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Close Trade
                  </button>
                  <button
                    onClick={() => handleDeleteTrade(trade.id)}
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
        onClick={() => setShowAddTrade(true)}
        className="fixed bottom-28 right-6 w-14 h-14 bg-foreground text-background rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Trade Modal */}
      {showAddTrade && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
          <header className="pt-12 pb-4 px-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">New Trade</h2>
            <button
              onClick={() => setShowAddTrade(false)}
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
          </div>

          <div className="px-6 pb-8">
            <button
              onClick={handleAddTrade}
              className="w-full h-14 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              Add Trade
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Journal;