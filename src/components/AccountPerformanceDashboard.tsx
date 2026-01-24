import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, BarChart3, Activity, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { Tables } from '@/types/database.types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, parseISO } from 'date-fns';
import { signalsApi } from '@/lib/api';

type TradingAccount = Tables<'trading_accounts'>;
type TakenTrade = Tables<'taken_trades'>;

interface AccountStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakeven: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  equityCurve: { date: string; balance: number }[];
}

interface AccountPerformanceDashboardProps {
  account: TradingAccount;
}

export const AccountPerformanceDashboard = ({ account }: AccountPerformanceDashboardProps) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && account) {
      fetchStats();
    }
  }, [user, account]);

  const fetchStats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch all taken trades and filter client-side
      const allTaken = await signalsApi.getUserTakenTrades();
      const trades = (allTaken || [])
        .filter((t: any) => t.account_id === account.id && t.status === 'closed')
        .sort((a: any, b: any) => (a.closed_at ?? '').localeCompare(b.closed_at ?? ''));

      if (!trades || trades.length === 0) {
        setStats({
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          breakeven: 0,
          winRate: 0,
          profitFactor: 0,
          totalPnL: 0,
          avgWin: 0,
          avgLoss: 0,
          largestWin: 0,
          largestLoss: 0,
          equityCurve: [{ date: format(new Date(), 'MMM dd'), balance: account.initial_balance }],
        });
        setLoading(false);
        return;
      }

      // Calculate stats
      const winningTrades = trades.filter(t => t.result === 'win');
      const losingTrades = trades.filter(t => t.result === 'loss');
      const breakevenTrades = trades.filter(t => t.result === 'breakeven');

      const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

      // Build equity curve
      let runningBalance = account.initial_balance;
      const equityCurve = [{ date: 'Start', balance: account.initial_balance }];
      
      trades.forEach((trade, index) => {
        runningBalance += trade.pnl || 0;
        equityCurve.push({
          date: trade.closed_at ? format(parseISO(trade.closed_at), 'MMM dd') : `Trade ${index + 1}`,
          balance: Math.round(runningBalance * 100) / 100,
        });
      });

      const wins = winningTrades.map(t => t.pnl || 0);
      const losses = losingTrades.map(t => t.pnl || 0);

      setStats({
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        breakeven: breakevenTrades.length,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
        profitFactor: Math.round(profitFactor * 100) / 100,
        totalPnL: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
        avgWin: wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0,
        avgLoss: losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0,
        largestWin: wins.length > 0 ? Math.max(...wins) : 0,
        largestLoss: losses.length > 0 ? Math.min(...losses) : 0,
        equityCurve,
      });
    } catch (error) {
      logger.error('Error fetching account stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-secondary rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded mb-4" />
        <div className="h-40 bg-muted rounded" />
      </div>
    );
  }

  if (!stats) return null;

  const pnlColor = stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400';
  const chartColor = stats.totalPnL >= 0 ? '#34d399' : '#f87171';

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-3">
        {/* Win Rate */}
        <div className="bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Win Rate</span>
          </div>
          <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.winRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.winningTrades}W / {stats.losingTrades}L / {stats.breakeven}BE
          </p>
        </div>

        {/* Profit Factor */}
        <div className="bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Profit Factor</span>
          </div>
          <p className={`text-2xl font-bold ${stats.profitFactor >= 1.5 ? 'text-emerald-400' : stats.profitFactor >= 1 ? 'text-amber-400' : 'text-red-400'}`}>
            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.profitFactor >= 1.5 ? 'Excellent' : stats.profitFactor >= 1 ? 'Good' : 'Needs Work'}
          </p>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-secondary rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Equity Curve</span>
          </div>
          <span className={`text-sm font-bold ${pnlColor}`}>
            {stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)}
          </span>
        </div>
        
        {stats.equityCurve.length > 1 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.equityCurve}>
                <defs>
                  <linearGradient id={`colorBalance-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 100', 'dataMax + 100']}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--secondary))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={chartColor}
                  strokeWidth={2}
                  fill={`url(#colorBalance-${account.id})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            No closed trades yet
          </div>
        )}
      </div>

      {/* Detailed Stats */}
      <div className="bg-secondary rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Trade Statistics</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Avg Win</p>
            <p className="text-sm font-semibold text-emerald-400">
              +${stats.avgWin.toFixed(2)}
            </p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Avg Loss</p>
            <p className="text-sm font-semibold text-red-400">
              ${stats.avgLoss.toFixed(2)}
            </p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Largest Win</p>
            <p className="text-sm font-semibold text-emerald-400">
              +${stats.largestWin.toFixed(2)}
            </p>
          </div>
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Largest Loss</p>
            <p className="text-sm font-semibold text-red-400">
              ${stats.largestLoss.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
