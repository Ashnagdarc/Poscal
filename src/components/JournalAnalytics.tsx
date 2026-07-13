import { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  Clock,
  Flame,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

interface Trade {
  id: string;
  pair: string;
  direction: 'buy' | 'sell';
  pnl: number | null;
  status: 'open' | 'closed' | 'cancelled';
  entry_date: string | null;
  created_at: string;
  journal_type?: 'structured' | 'notes';
  market_condition?: string | null;
  tags?: string | null;
  rich_content?: unknown;
  notes?: string | null;
}

interface JournalAnalyticsProps {
  trades: Trade[];
  onClose: () => void;
}

const formatMoney = (value: number) =>
  `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}`;

const formatPercent = (value: number) => `${value.toFixed(0)}%`;

export const JournalAnalytics = ({ trades, onClose }: JournalAnalyticsProps) => {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const filteredTrades = useMemo(() => {
    if (dateRange === 'all') {
      return trades;
    }

    const now = new Date();
    const startDate = new Date();
    if (dateRange === '7d') startDate.setDate(now.getDate() - 7);
    if (dateRange === '30d') startDate.setDate(now.getDate() - 30);
    if (dateRange === '90d') startDate.setDate(now.getDate() - 90);

    return trades.filter((trade) => new Date(trade.entry_date || trade.created_at) >= startDate);
  }, [dateRange, trades]);

  const closedTrades = filteredTrades.filter((trade) => trade.status === 'closed');
  const openTrades = filteredTrades.filter((trade) => trade.status === 'open');

  const summary = useMemo(() => {
    const wins = closedTrades.filter((trade) => (trade.pnl || 0) > 0);
    const losses = closedTrades.filter((trade) => (trade.pnl || 0) < 0);
    const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const avgWin = wins.length
      ? wins.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / wins.length
      : 0;
    const avgLoss = losses.length
      ? Math.abs(losses.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / losses.length)
      : 0;

    return {
      totalEntries: filteredTrades.length,
      closedCount: closedTrades.length,
      openCount: openTrades.length,
      wins: wins.length,
      losses: losses.length,
      totalPnl,
      avgWin,
      avgLoss,
      winRate: closedTrades.length ? (wins.length / closedTrades.length) * 100 : 0,
      profitFactor: avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0,
    };
  }, [closedTrades, filteredTrades, openTrades]);

  const topPairs = useMemo(() => {
    const pairMap: Record<string, { count: number; pnl: number }> = {};
    closedTrades.forEach((trade) => {
      if (!pairMap[trade.pair]) {
        pairMap[trade.pair] = { count: 0, pnl: 0 };
      }
      pairMap[trade.pair].count += 1;
      pairMap[trade.pair].pnl += trade.pnl || 0;
    });

    return Object.entries(pairMap)
      .map(([pair, data]) => ({ pair, ...data }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
  }, [closedTrades]);

  const topTags = useMemo(() => {
    const tagMap: Record<string, number> = {};
    filteredTrades.forEach((trade) => {
      if (!trade.tags) return;
      trade.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
    });

    return Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [filteredTrades]);

  const marketConditions = useMemo(() => {
    const conditionMap: Record<string, number> = {};
    filteredTrades.forEach((trade) => {
      if (!trade.market_condition) return;
      conditionMap[trade.market_condition] = (conditionMap[trade.market_condition] || 0) + 1;
    });

    return Object.entries(conditionMap)
      .map(([condition, count]) => ({
        condition: condition.charAt(0).toUpperCase() + condition.slice(1),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredTrades]);

  const streak = useMemo(() => {
    let currentType: 'win' | 'loss' | null = null;
    let currentCount = 0;
    let bestWin = 0;
    let bestLoss = 0;

    [...closedTrades]
      .sort(
        (a, b) =>
          new Date(a.entry_date || a.created_at).getTime() -
          new Date(b.entry_date || b.created_at).getTime(),
      )
      .forEach((trade) => {
        const nextType: 'win' | 'loss' = (trade.pnl || 0) > 0 ? 'win' : 'loss';
        if (currentType === nextType) {
          currentCount += 1;
        } else {
          currentType = nextType;
          currentCount = 1;
        }

        if (nextType === 'win') bestWin = Math.max(bestWin, currentCount);
        if (nextType === 'loss') bestLoss = Math.max(bestLoss, currentCount);
      });

    return { currentType, currentCount, bestWin, bestLoss };
  }, [closedTrades]);

  const notesCoverage = useMemo(() => {
    const withNotes = filteredTrades.filter((trade) => trade.notes?.trim()).length;
    const withRichContent = filteredTrades.filter((trade) => Boolean(trade.rich_content)).length;
    const notesOnly = filteredTrades.filter((trade) => trade.journal_type === 'notes').length;
    return { withNotes, withRichContent, notesOnly };
  }, [filteredTrades]);

  const insights = useMemo(() => {
    const items: string[] = [];
    if (topPairs[0]) {
      items.push(`${topPairs[0].pair} is your strongest closed pair in this range.`);
    }
    if (streak.currentType && streak.currentCount >= 2) {
      items.push(
        `Current ${streak.currentType} streak: ${streak.currentCount} ${
          streak.currentType === 'win' ? 'wins' : 'losses'
        }.`,
      );
    }
    if (summary.winRate >= 60 && summary.closedCount >= 3) {
      items.push(`Win rate is holding at ${formatPercent(summary.winRate)}.`);
    }
    if (notesCoverage.withNotes < filteredTrades.length && filteredTrades.length > 0) {
      items.push(`Some entries still need notes, which makes later review weaker.`);
    }
    return items;
  }, [filteredTrades.length, notesCoverage.withNotes, streak, summary.closedCount, summary.winRate, topPairs]);

  if (trades.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background animate-slide-up">
        <header className="flex items-center justify-between border-b border-border px-6 pb-4 pt-12">
          <h2 className="text-xl font-bold text-foreground">Insights</h2>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <X className="h-5 w-5 text-foreground" />
          </button>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 px-6 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground" />
          <div>
            <p className="mb-1 text-lg font-medium text-foreground">No Journal Entries Yet</p>
            <p className="text-sm text-muted-foreground">Add a few entries and this screen will turn into a review summary.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background animate-slide-up">
      <header className="flex items-center justify-between border-b border-border px-6 pb-4 pt-12">
        <h2 className="text-xl font-bold text-foreground">Insights</h2>
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
          <X className="h-5 w-5 text-foreground" />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-6 py-3">
        {(['7d', '30d', '90d', 'all'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              dateRange === range ? 'bg-foreground text-background' : 'bg-secondary text-foreground'
            }`}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      <main className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p className={`text-2xl font-bold ${summary.totalPnl >= 0 ? 'text-foreground' : 'text-destructive'}`}>
              {formatMoney(summary.totalPnl)}
            </p>
          </div>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold text-foreground">{summary.closedCount ? formatPercent(summary.winRate) : '—'}</p>
          </div>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Average Win</p>
            <p className="text-xl font-bold text-emerald-400">{summary.wins ? formatMoney(summary.avgWin) : '—'}</p>
          </div>
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-sm text-muted-foreground">Average Loss</p>
            <p className="text-xl font-bold text-red-400">{summary.losses ? formatMoney(summary.avgLoss) : '—'}</p>
          </div>
        </section>

        <section className="rounded-2xl bg-secondary p-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Trade Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Entries</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{summary.totalEntries}</p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Open Trades</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{summary.openCount}</p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Wins</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-emerald-400">
                <TrendingUp className="h-4 w-4" /> {summary.wins}
              </p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Losses</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-red-400">
                <TrendingDown className="h-4 w-4" /> {summary.losses}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Profit factor: {Number.isFinite(summary.profitFactor) ? summary.profitFactor.toFixed(2) : '∞'}
          </p>
        </section>

        <section className="rounded-2xl bg-secondary p-4">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Streaks</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Best Win Streak</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{streak.bestWin}</p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Worst Loss Streak</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{streak.bestLoss}</p>
            </div>
          </div>
        </section>

        {topPairs.length > 0 && (
          <section className="rounded-2xl bg-secondary p-4">
            <div className="mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Top Pairs</h3>
            </div>
            <div className="space-y-2">
              {topPairs.map((item) => (
                <div key={item.pair} className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{item.pair}</span>
                  <span className={item.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatMoney(item.pnl)} · {item.count} trades
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(topTags.length > 0 || marketConditions.length > 0) && (
          <section className="grid gap-4 md:grid-cols-2">
            {topTags.length > 0 && (
              <div className="rounded-2xl bg-secondary p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Top Tags</h3>
                </div>
                <div className="space-y-2">
                  {topTags.map(([tag, count]) => (
                    <div key={tag} className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm">
                      <span className="text-foreground">{tag}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {marketConditions.length > 0 && (
              <div className="rounded-2xl bg-secondary p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Market Conditions</h3>
                </div>
                <div className="space-y-2">
                  {marketConditions.map((item) => (
                    <div key={item.condition} className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm">
                      <span className="text-foreground">{item.condition}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-secondary p-4">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Journal Quality</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">With Notes</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{notesCoverage.withNotes}</p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Rich Entries</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{notesCoverage.withRichContent}</p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-muted-foreground">Notes Mode</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{notesCoverage.notesOnly}</p>
            </div>
          </div>
        </section>

        {insights.length > 0 && (
          <section className="rounded-2xl bg-secondary p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Review Notes</h3>
            </div>
            <div className="space-y-2">
              {insights.map((insight) => (
                <div key={insight} className="rounded-xl bg-background px-3 py-2 text-sm text-foreground">
                  {insight}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
