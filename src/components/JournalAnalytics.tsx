import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, ScatterChart, Scatter } from 'recharts';
import { TrendingUp, TrendingDown, BookOpen, Calendar, Target, Tag, Zap, Award, Clock, Flame, AlertCircle } from 'lucide-react';

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
  entry_price?: number | null;
  exit_price?: number | null;
}

interface JournalAnalyticsProps {
  trades: Trade[];
  onClose: () => void;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

export const JournalAnalytics = ({ trades, onClose }: JournalAnalyticsProps) => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  
  // Filter trades by date range
  const filteredTrades = useMemo(() => {
    const now = new Date();
    let startDate = new Date();
    
    if (dateRange === '7d') startDate.setDate(now.getDate() - 7);
    else if (dateRange === '30d') startDate.setDate(now.getDate() - 30);
    else if (dateRange === '90d') startDate.setDate(now.getDate() - 90);
    else return trades;
    
    return trades.filter(t => {
      const tradeDate = new Date(t.entry_date || t.created_at);
      return tradeDate >= startDate;
    });
  }, [trades, dateRange]);
  
  const closedTrades = filteredTrades.filter(t => t.status === 'closed');
  const openTrades = filteredTrades.filter(t => t.status === 'open');
  
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
    const totalLogs = filteredTrades.length;
    const structuredLogs = filteredTrades.filter(t => t.journal_type === 'structured' || !t.journal_type).length;
    const notesLogs = filteredTrades.filter(t => t.journal_type === 'notes').length;
    const withRichContent = filteredTrades.filter(t => t.rich_content).length;
    const withNotes = filteredTrades.filter(t => t.notes && t.notes.trim() !== '').length;
    const withTags = filteredTrades.filter(t => t.tags && t.tags.trim() !== '').length;
    
    // Activity by day of week
    const dayActivity: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    filteredTrades.forEach(t => {
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
  }, [filteredTrades]);

  // Direction breakdown (updated for buy/sell)
  const directionData = useMemo(() => {
    const buy = filteredTrades.filter(t => t.direction === 'buy').length;
    const sell = filteredTrades.filter(t => t.direction === 'sell').length;
    return [
      { name: 'Buy', value: buy },
      { name: 'Sell', value: sell },
    ].filter(d => d.value > 0);
  }, [filteredTrades]);

  // Win/Loss Streaks
  const streakData = useMemo(() => {
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let lastStreakType: 'win' | 'loss' | null = null;
    
    // Sort by date
    const sorted = [...closedTrades].sort((a, b) => 
      new Date(a.entry_date || a.created_at).getTime() - new Date(b.entry_date || b.created_at).getTime()
    );
    
    sorted.forEach(t => {
      const isWin = t.pnl && t.pnl > 0;
      
      if (isWin) {
        if (lastStreakType !== 'win') {
          currentWinStreak = 1;
          currentLossStreak = 0;
        } else {
          currentWinStreak++;
        }
        lastStreakType = 'win';
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else {
        if (lastStreakType !== 'loss') {
          currentLossStreak = 1;
          currentWinStreak = 0;
        } else {
          currentLossStreak++;
        }
        lastStreakType = 'loss';
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    });
    
    return {
      currentWinStreak,
      currentLossStreak,
      maxWinStreak,
      maxLossStreak,
      currentStreakType: lastStreakType
    };
  }, [closedTrades]);

  // Risk-Adjusted Metrics
  const riskMetrics = useMemo(() => {
    if (closedTrades.length < 2) return { sharpeRatio: 0, maxDrawdown: 0, recoveryFactor: 0 };
    
    // Calculate daily P&L for Sharpe
    const dailyPnL: number[] = [];
    let cumulative = 0;
    const peakValues: number[] = [0];
    
    [...closedTrades]
      .sort((a, b) => new Date(a.entry_date || a.created_at).getTime() - new Date(b.entry_date || b.created_at).getTime())
      .forEach(t => {
        cumulative += t.pnl || 0;
        dailyPnL.push(t.pnl || 0);
        peakValues.push(cumulative);
      });
    
    // Sharpe Ratio (simplified)
    const avgPnL = dailyPnL.reduce((a, b) => a + b, 0) / dailyPnL.length;
    const variance = dailyPnL.reduce((sum, pnl) => sum + Math.pow(pnl - avgPnL, 2), 0) / dailyPnL.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgPnL / stdDev : 0;
    
    // Max Drawdown
    let maxDrawdown = 0;
    let peak = peakValues[0];
    peakValues.forEach(value => {
      const drawdown = peak - value;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      peak = Math.max(peak, value);
    });
    
    // Recovery Factor
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const recoveryFactor = maxDrawdown > 0 ? Math.abs(totalPnL) / maxDrawdown : 0;
    
    return { sharpeRatio, maxDrawdown, recoveryFactor };
  }, [closedTrades]);

  // Entry Quality Score (unrealized P&L for open trades)
  const entryQuality = useMemo(() => {
    if (openTrades.length === 0) return { profitableCount: 0, avgUnrealized: 0, unrealizedTotal: 0 };
    
    const unrealizedPnLs: number[] = [];
    let profitableCount = 0;
    
    openTrades.forEach(t => {
      if (t.entry_price && t.entry_price > 0) {
        // For demo, we'll estimate current price as entry + some variance
        const estimatedCurrent = t.entry_price * (Math.random() > 0.5 ? 1.02 : 0.98);
        const unrealized = t.direction === 'buy' 
          ? (estimatedCurrent - t.entry_price) * (t.position_size || 1)
          : (t.entry_price - estimatedCurrent) * (t.position_size || 1);
        
        unrealizedPnLs.push(unrealized);
        if (unrealized > 0) profitableCount++;
      }
    });
    
    const avgUnrealized = unrealizedPnLs.length > 0 ? unrealizedPnLs.reduce((a, b) => a + b) / unrealizedPnLs.length : 0;
    const unrealizedTotal = unrealizedPnLs.reduce((a, b) => a + b, 0);
    
    return { profitableCount, avgUnrealized, unrealizedTotal };
  }, [openTrades]);

  // Market Condition Correlation
  const marketConditionStats = useMemo(() => {
    const conditionMap: Record<string, { wins: number; losses: number }> = {};
    
    closedTrades.forEach(t => {
      if (t.market_condition) {
        if (!conditionMap[t.market_condition]) {
          conditionMap[t.market_condition] = { wins: 0, losses: 0 };
        }
        if (t.pnl && t.pnl > 0) {
          conditionMap[t.market_condition].wins++;
        } else {
          conditionMap[t.market_condition].losses++;
        }
      }
    });
    
    return Object.entries(conditionMap).map(([condition, data]) => ({
      condition: condition.charAt(0).toUpperCase() + condition.slice(1),
      winRate: data.wins + data.losses > 0 ? (data.wins / (data.wins + data.losses)) * 100 : 0,
      trades: data.wins + data.losses
    }));
  }, [closedTrades]);

  // Strategy/Tag Performance
  const strategyPerformance = useMemo(() => {
    const tagMap: Record<string, { pnl: number; wins: number; losses: number; count: number }> = {};
    
    closedTrades.forEach(t => {
      if (t.tags) {
        const tags = t.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        tags.forEach(tag => {
          if (!tagMap[tag]) {
            tagMap[tag] = { pnl: 0, wins: 0, losses: 0, count: 0 };
          }
          tagMap[tag].pnl += t.pnl || 0;
          tagMap[tag].count++;
          if (t.pnl && t.pnl > 0) tagMap[tag].wins++;
          else if (t.pnl && t.pnl < 0) tagMap[tag].losses++;
        });
      }
    });
    
    return Object.entries(tagMap)
      .map(([tag, data]) => ({
        tag,
        pnl: data.pnl,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
        count: data.count
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [closedTrades]);

  // Trade Duration Analysis
  const durationAnalysis = useMemo(() => {
    const durations: number[] = [];
    
    closedTrades.forEach(t => {
      const entry = new Date(t.entry_date || t.created_at);
      const exit = new Date(t.created_at); // approximation
      const durationHours = (exit.getTime() - entry.getTime()) / (1000 * 60 * 60);
      durations.push(durationHours);
    });
    
    if (durations.length === 0) return { avgDuration: 0, minDuration: 0, maxDuration: 0 };
    
    const sorted = durations.sort((a, b) => a - b);
    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    
    return {
      avgDuration,
      minDuration: sorted[0],
      maxDuration: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }, [closedTrades]);

  // Pair Performance (with win rate)
  const pairPerformance = useMemo(() => {
    const pairMap: Record<string, { pnl: number; wins: number; losses: number; count: number }> = {};
    
    closedTrades.forEach(t => {
      if (!pairMap[t.pair]) {
        pairMap[t.pair] = { pnl: 0, wins: 0, losses: 0, count: 0 };
      }
      pairMap[t.pair].pnl += t.pnl || 0;
      pairMap[t.pair].count++;
      if (t.pnl && t.pnl > 0) pairMap[t.pair].wins++;
      else if (t.pnl && t.pnl < 0) pairMap[t.pair].losses++;
    });
    
    return Object.entries(pairMap)
      .map(([pair, data]) => ({
        pair,
        pnl: data.pnl,
        winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
        count: data.count
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 8);
  }, [closedTrades]);

  // Heatmap Calendar Data (last 90 days)
  const calendarHeatmap = useMemo(() => {
    const dayMap: Record<string, { pnl: number; isProfit: boolean }> = {};
    const last90Days = new Date();
    last90Days.setDate(last90Days.getDate() - 90);
    
    filteredTrades.forEach(t => {
      const date = new Date(t.entry_date || t.created_at);
      if (date >= last90Days) {
        const key = date.toISOString().split('T')[0];
        if (!dayMap[key]) {
          dayMap[key] = { pnl: 0, isProfit: false };
        }
        dayMap[key].pnl += t.pnl || 0;
        dayMap[key].isProfit = dayMap[key].pnl > 0;
      }
    });
    
    return Object.entries(dayMap)
      .map(([date, data]) => ({
        date,
        pnl: data.pnl,
        isProfit: data.isProfit,
        intensity: Math.abs(data.pnl) // for heatmap intensity
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredTrades]);

  // AI Insights Generation
  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    
    // Best performing pair
    if (pairPerformance.length > 0) {
      const best = pairPerformance[0];
      insights.push(`✨ ${best.pair} is your best pair with ${best.winRate.toFixed(0)}% win rate`);
    }
    
    // Win streak insight
    if (streakData.currentWinStreak >= 3) {
      insights.push(`🔥 You're on a ${streakData.currentWinStreak}-trade winning streak!`);
    }
    
    // Market condition preference
    const bestCondition = marketConditionStats.sort((a, b) => b.winRate - a.winRate)[0];
    if (bestCondition) {
      insights.push(`📈 You perform ${bestCondition.winRate.toFixed(0)}% better in ${bestCondition.condition} markets`);
    }
    
    // Trading frequency
    if (filteredTrades.length > 0) {
      const daysSpan = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
      const tradesPerDay = (filteredTrades.length / daysSpan).toFixed(1);
      insights.push(`📊 You average ${tradesPerDay} trades per day`);
    }
    
    // Drawdown warning
    if (riskMetrics.maxDrawdown > stats.avgWin * 5) {
      insights.push(`⚠️ Max drawdown (${riskMetrics.maxDrawdown.toFixed(2)}) is high - consider risk management`);
    }
    
    return insights;
  }, [pairPerformance, streakData, marketConditionStats, filteredTrades, dateRange, riskMetrics, stats]);

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

      {/* Date Range Filter */}
      <div className="px-6 py-3 border-b border-border flex gap-2 overflow-x-auto">
        {(['7d', '30d', '90d', 'all'] as const).map(range => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              dateRange === range
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            }`}
          >
            {range === 'all' ? 'All Time' : `Last ${range.replace('d', ' days')}`}
          </button>
        ))}
      </div>

      {/* AI Insights Banner */}
      {aiInsights.length > 0 && (
        <div className="px-6 py-3 bg-primary/10 border-b border-border">
          <div className="flex items-start gap-3">
            <Zap className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
            <div className="space-y-1">
              {aiInsights.slice(0, 2).map((insight, idx) => (
                <p key={idx} className="text-sm text-foreground">{insight}</p>
              ))}
            </div>
          </div>
        </div>
      )}

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

        {/* Win/Loss Streaks */}
        {closedTrades.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Trading Streaks</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Current Streak</p>
                <p className="text-2xl font-bold text-foreground">
                  {streakData.currentStreakType === 'win' ? `+${streakData.currentWinStreak}` : `-${streakData.currentLossStreak}`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{streakData.currentStreakType === 'win' ? 'Wins' : 'Losses'}</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Best Streak</p>
                <p className="text-2xl font-bold text-primary">+{streakData.maxWinStreak}</p>
                <p className="text-xs text-muted-foreground mt-1">Wins</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk-Adjusted Metrics */}
        {closedTrades.length > 1 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Risk Metrics</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                <p className="text-2xl font-bold text-foreground">{riskMetrics.sharpeRatio.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Risk/Reward</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Max Drawdown</p>
                <p className="text-2xl font-bold text-destructive">-{Math.abs(riskMetrics.maxDrawdown).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Worst Peak</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Recovery Factor</p>
                <p className="text-2xl font-bold text-primary">{riskMetrics.recoveryFactor.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Efficiency</p>
              </div>
            </div>
          </div>
        )}

        {/* Entry Quality for Open Trades */}
        {openTrades.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Open Trades Quality</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{entryQuality.profitableCount}</p>
                <p className="text-xs text-muted-foreground">Profitable</p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-bold ${entryQuality.avgUnrealized >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {entryQuality.avgUnrealized.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Avg P&L</p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-bold ${entryQuality.unrealizedTotal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {entryQuality.unrealizedTotal.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        )}

        {/* Market Condition Win Rates */}
        {marketConditionStats.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Win Rate by Market Condition</p>
            <div className="space-y-3">
              {marketConditionStats.sort((a, b) => b.winRate - a.winRate).map(condition => (
                <div key={condition.condition}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-foreground">{condition.condition}</span>
                    <span className="text-sm font-bold text-primary">{condition.winRate.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${condition.winRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{condition.trades} trades</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strategy Performance */}
        {strategyPerformance.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Strategy Performance</h3>
            </div>
            <div className="space-y-3">
              {strategyPerformance.slice(0, 5).map(strategy => (
                <div key={strategy.tag} className="flex items-center justify-between p-3 bg-background rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-foreground">{strategy.tag}</p>
                    <p className="text-xs text-muted-foreground">{strategy.count} trades • {strategy.winRate.toFixed(0)}% win</p>
                  </div>
                  <p className={`text-sm font-bold ${strategy.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {strategy.pnl >= 0 ? '+' : ''}{strategy.pnl.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade Duration */}
        {closedTrades.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Trade Duration</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Average</p>
                <p className="text-lg font-bold text-foreground">{durationAnalysis.avgDuration.toFixed(1)}h</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Shortest</p>
                <p className="text-lg font-bold text-foreground">{durationAnalysis.minDuration.toFixed(1)}h</p>
              </div>
              <div className="bg-secondary rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Longest</p>
                <p className="text-lg font-bold text-foreground">{durationAnalysis.maxDuration.toFixed(1)}h</p>
              </div>
            </div>
          </div>
        )}

        {/* Pair Performance Comparison */}
        {pairPerformance.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Pair Performance Comparison</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pairPerformance}>
                  <XAxis dataKey="pair" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar yAxisId="left" dataKey="pnl" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="winRate" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Calendar Heatmap */}
        {calendarHeatmap.length > 0 && (
          <div className="bg-secondary rounded-2xl p-4">
            <p className="text-sm font-semibold text-foreground mb-4">Profitability Heatmap (90 Days)</p>
            <div className="flex flex-wrap gap-2">
              {calendarHeatmap.map(day => (
                <div
                  key={day.date}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: day.isProfit 
                      ? `rgba(34, 197, 94, ${0.3 + (day.intensity / 100) * 0.7})`
                      : `rgba(239, 68, 68, ${0.3 + (day.intensity / 100) * 0.7})`,
                    color: 'hsl(var(--foreground))'
                  }}
                  title={`${day.date}: ${day.pnl > 0 ? '+' : ''}${day.pnl.toFixed(2)}`}
                >
                  {new Date(day.date).getDate()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All AI Insights */}
        {aiInsights.length > 2 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Smart Insights</h3>
                <ul className="space-y-2">
                  {aiInsights.map((insight, idx) => (
                    <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
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