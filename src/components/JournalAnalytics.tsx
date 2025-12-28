import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface Trade {
  id: string;
  pair: string;
  direction: 'long' | 'short';
  pnl: number | null;
  status: 'open' | 'closed' | 'cancelled';
  entry_date: string | null;
  created_at: string;
}

interface JournalAnalyticsProps {
  trades: Trade[];
  onClose: () => void;
}

const COLORS = ['hsl(var(--foreground))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))'];

export const JournalAnalytics = ({ trades, onClose }: JournalAnalyticsProps) => {
  const closedTrades = trades.filter(t => t.status === 'closed');
  
  const stats = useMemo(() => {
    const wins = closedTrades.filter(t => t.pnl && t.pnl > 0);
    const losses = closedTrades.filter(t => t.pnl && t.pnl < 0);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    
    return { wins: wins.length, losses: losses.length, totalPnl, avgWin, avgLoss, profitFactor, winRate };
  }, [closedTrades]);

  // P&L by pair
  const pnlByPair = useMemo(() => {
    const pairMap: Record<string, number> = {};
    closedTrades.forEach(t => {
      if (!pairMap[t.pair]) pairMap[t.pair] = 0;
      pairMap[t.pair] += t.pnl || 0;
    });
    return Object.entries(pairMap).map(([pair, pnl]) => ({ pair, pnl })).sort((a, b) => b.pnl - a.pnl);
  }, [closedTrades]);

  // Direction breakdown
  const directionData = useMemo(() => {
    const long = closedTrades.filter(t => t.direction === 'long').length;
    const short = closedTrades.filter(t => t.direction === 'short').length;
    return [
      { name: 'Long', value: long },
      { name: 'Short', value: short },
    ].filter(d => d.value > 0);
  }, [closedTrades]);

  // Monthly P&L
  const monthlyPnl = useMemo(() => {
    const monthMap: Record<string, number> = {};
    closedTrades.forEach(t => {
      const date = new Date(t.entry_date || t.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap[key]) monthMap[key] = 0;
      monthMap[key] += t.pnl || 0;
    });
    return Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, pnl]) => ({ month, pnl }));
  }, [closedTrades]);

  // Cumulative P&L
  const cumulativePnl = useMemo(() => {
    let cumulative = 0;
    return closedTrades
      .sort((a, b) => new Date(a.entry_date || a.created_at).getTime() - new Date(b.entry_date || b.created_at).getTime())
      .map((t, i) => {
        cumulative += t.pnl || 0;
        return { trade: i + 1, pnl: cumulative };
      });
  }, [closedTrades]);

  if (closedTrades.length === 0) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
        <header className="pt-12 pb-4 px-6 flex items-center justify-between border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Analytics</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center"
          >
            <span className="text-foreground text-xl">×</span>
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Close some trades to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up overflow-hidden">
      <header className="pt-12 pb-4 px-6 flex items-center justify-between border-b border-border">
        <h2 className="text-xl font-bold text-foreground">Analytics</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center"
        >
          <span className="text-foreground text-xl">×</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold text-foreground">{stats.winRate.toFixed(1)}%</p>
          </div>
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Profit Factor</p>
            <p className="text-2xl font-bold text-foreground">
              {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
            </p>
          </div>
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Avg Win</p>
            <p className="text-2xl font-bold text-foreground">+{stats.avgWin.toFixed(2)}</p>
          </div>
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground">Avg Loss</p>
            <p className="text-2xl font-bold text-destructive">-{stats.avgLoss.toFixed(2)}</p>
          </div>
        </div>

        {/* Cumulative P&L Chart */}
        {cumulativePnl.length > 1 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground mb-4">Equity Curve</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativePnl}>
                  <XAxis dataKey="trade" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pnl" 
                    stroke="hsl(var(--foreground))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* P&L by Pair */}
        {pnlByPair.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground mb-4">P&L by Pair</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlByPair} layout="vertical">
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis dataKey="pair" type="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={60} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="pnl" 
                    fill="hsl(var(--foreground))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Direction Breakdown */}
        {directionData.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm text-muted-foreground mb-4">Trade Direction</p>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={directionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {directionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Win/Loss Breakdown */}
        <div className="bg-secondary rounded-2xl p-4">
          <p className="text-sm text-muted-foreground mb-4">Results</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-foreground">Wins</span>
                <span className="text-sm font-bold text-foreground">{stats.wins}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-foreground rounded-full" 
                  style={{ width: `${stats.winRate}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-destructive">Losses</span>
                <span className="text-sm font-bold text-destructive">{stats.losses}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-destructive rounded-full" 
                  style={{ width: `${100 - stats.winRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};