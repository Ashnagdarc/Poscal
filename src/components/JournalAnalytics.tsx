import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, BookOpen, Calendar, Target, Tag } from 'lucide-react';

interface Trade {
  id: string;
  pair: string;
  direction: 'buy' | 'sell';
  pnl: number | null;
  status: 'open' | 'closed' | 'cancelled';
  entry_date: string | null;
  created_at: string;
  account_id: string | null;
  account_name?: string;
  journal_type?: 'structured' | 'notes';
  market_condition?: string | null;
  tags?: string | null;
  rich_content?: any;
  notes?: string | null;
}

interface JournalAnalyticsProps {
  trades: Trade[];
  onClose: () => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

export const JournalAnalytics = ({ trades, onClose }: JournalAnalyticsProps) => {
  const closedTrades = trades.filter(t => t.status === 'closed');
  const openTrades = trades.filter(t => t.status === 'open');
  
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

  // Journal-specific stats
  const journalStats = useMemo(() => {
    const totalLogs = trades.length;
    const structuredLogs = trades.filter(t => t.journal_type === 'structured' || !t.journal_type).length;
    const notesLogs = trades.filter(t => t.journal_type === 'notes').length;
    const withRichContent = trades.filter(t => t.rich_content).length;
    const withNotes = trades.filter(t => t.notes && t.notes.trim() !== '').length;
    const withTags = trades.filter(t => t.tags && t.tags.trim() !== '').length;
    
    // Activity by day of week
    const dayActivity: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    trades.forEach(t => {
      const date = new Date(t.entry_date || t.created_at);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      dayActivity[dayName]++;
    });
    
    return { 
      totalLogs, 
      structuredLogs, 
      notesLogs, 
      withRichContent, 
      withNotes,
      withTags,
      dayActivity: Object.entries(dayActivity).map(([day, count]) => ({ day, count }))
    };
  }, [trades]);

  // P&L by pair
  const pnlByPair = useMemo(() => {
    const pairMap: Record<string, number> = {};
    closedTrades.forEach(t => {
      if (!pairMap[t.pair]) pairMap[t.pair] = 0;
      pairMap[t.pair] += t.pnl || 0;
    });
    return Object.entries(pairMap).map(([pair, pnl]) => ({ pair, pnl })).sort((a, b) => b.pnl - a.pnl);
  }, [closedTrades]);

  // Direction breakdown (updated for buy/sell)
  const directionData = useMemo(() => {
    const buy = trades.filter(t => t.direction === 'buy').length;
    const sell = trades.filter(t => t.direction === 'sell').length;
    return [
      { name: 'Buy', value: buy },
      { name: 'Sell', value: sell },
    ].filter(d => d.value > 0);
  }, [trades]);

  // Trading activity over time (last 30 days)
  const activityTimeline = useMemo(() => {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const recentTrades = trades.filter(t => {
      const tradeDate = new Date(t.entry_date || t.created_at);
      return tradeDate >= last30Days;
    });
    
    const dateMap: Record<string, number> = {};
    recentTrades.forEach(t => {
      const date = new Date(t.entry_date || t.created_at);
      const key = date.toISOString().split('T')[0];
      dateMap[key] = (dateMap[key] || 0) + 1;
    });
    
    return Object.entries(dateMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ 
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 
        count 
      }));
  }, [trades]);

  // Tag analysis
  const tagData = useMemo(() => {
    const tagMap: Record<string, number> = {};
    trades.forEach(t => {
      if (t.tags) {
        const tags = t.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        tags.forEach(tag => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }, [trades]);

  // Market condition analysis
  const marketConditionData = useMemo(() => {
    const conditionMap: Record<string, number> = {};
    trades.forEach(t => {
      if (t.market_condition) {
        conditionMap[t.market_condition] = (conditionMap[t.market_condition] || 0) + 1;
      }
    });
    
    return Object.entries(conditionMap)
      .map(([condition, count]) => ({ 
        condition: condition.charAt(0).toUpperCase() + condition.slice(1), 
        count 
      }));
  }, [trades]);

  // Top traded pairs
  const topPairs = useMemo(() => {
    const pairMap: Record<string, number> = {};
    trades.forEach(t => {
      pairMap[t.pair] = (pairMap[t.pair] || 0) + 1;
    });
    
    return Object.entries(pairMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pair, count]) => ({ pair, count }));
  }, [trades]);

  // Monthly P&L
  const _monthlyPnl = useMemo(() => {
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

  if (trades.length === 0) {
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
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-4">
          <BookOpen className="w-16 h-16 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium text-foreground mb-1">No Journal Entries Yet</p>
            <p className="text-sm text-muted-foreground">Start adding journal entries to see detailed analytics</p>
          </div>
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

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pb-24">
        {/* Overview Stats */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Journal Overview</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary rounded-2xl p-4">
              <p className="text-sm text-muted-foreground">Total Entries</p>
              <p className="text-2xl font-bold text-foreground">{journalStats.totalLogs}</p>
            </div>
            <div className="bg-secondary rounded-2xl p-4">
              <p className="text-sm text-muted-foreground">Open Trades</p>
              <p className="text-2xl font-bold text-primary">{openTrades.length}</p>
            </div>
            <div className="bg-secondary rounded-2xl p-4">
              <p className="text-sm text-muted-foreground">Structured</p>
              <p className="text-2xl font-bold text-foreground">{journalStats.structuredLogs}</p>
            </div>
            <div className="bg-secondary rounded-2xl p-4">
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-2xl font-bold text-foreground">{journalStats.notesLogs}</p>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        {activityTimeline.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Activity (Last 30 Days)</p>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityTimeline}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Trading Performance (only show if there are closed trades) */}
        {closedTrades.length > 0 && (
          <>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Trading Performance</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary rounded-2xl p-4">
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold text-foreground">{stats.winRate.toFixed(1)}%</p>
                </div>
                <div className="bg-secondary rounded-2xl p-4">
                  <p className="text-sm text-muted-foreground">Total P&L</p>
                  <p className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}
                  </p>
                </div>
                <div className="bg-secondary rounded-2xl p-4">
                  <p className="text-sm text-muted-foreground">Avg Win</p>
                  <p className="text-2xl font-bold text-primary">+{stats.avgWin.toFixed(2)}</p>
                </div>
                <div className="bg-secondary rounded-2xl p-4">
                  <p className="text-sm text-muted-foreground">Avg Loss</p>
                  <p className="text-2xl font-bold text-destructive">-{stats.avgLoss.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Cumulative P&L Chart */}
            {cumulativePnl.length > 1 && (
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm font-semibold text-foreground mb-4">Equity Curve</p>
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
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Win/Loss Breakdown */}
            <div className="bg-secondary rounded-2xl p-4">
              <p className="text-sm font-semibold text-foreground mb-4">Results Breakdown</p>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Wins
                    </span>
                    <span className="text-sm font-bold text-foreground">{stats.wins}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all" 
                      style={{ width: `${stats.winRate}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-destructive flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Losses
                    </span>
                    <span className="text-sm font-bold text-destructive">{stats.losses}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-destructive rounded-full transition-all" 
                      style={{ width: `${100 - stats.winRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Top Traded Pairs */}
        {topPairs.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Most Traded Pairs</p>
            <div className="space-y-3">
              {topPairs.map((item, idx) => (
                <div key={item.pair} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      #{idx + 1}
                    </div>
                    <span className="text-sm font-medium text-foreground">{item.pair}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.count} trades</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direction Distribution */}
        {directionData.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Buy vs Sell</p>
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
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Market Condition Analysis */}
        {marketConditionData.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Market Conditions</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketConditionData}>
                  <XAxis dataKey="condition" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tag Cloud */}
        {tagData.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Popular Tags</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagData.map(({ tag, count }) => (
                <div 
                  key={tag} 
                  className="px-3 py-1.5 bg-primary/10 rounded-full flex items-center gap-2"
                >
                  <span className="text-xs font-medium text-primary">{tag}</span>
                  <span className="text-xs text-muted-foreground">×{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity by Day of Week */}
        {journalStats.dayActivity.some(d => d.count > 0) && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Activity by Day</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={journalStats.dayActivity}>
                  <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Content Stats */}
        <div className="bg-secondary rounded-2xl p-4">
          <p className="text-sm font-semibold text-foreground mb-4">Content Analysis</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">With Notes</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${(journalStats.withNotes / journalStats.totalLogs) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground min-w-[3ch]">{journalStats.withNotes}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Rich Content</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${(journalStats.withRichContent / journalStats.totalLogs) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground min-w-[3ch]">{journalStats.withRichContent}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tagged</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${(journalStats.withTags / journalStats.totalLogs) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-foreground min-w-[3ch]">{journalStats.withTags}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};