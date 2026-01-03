import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdmin } from '@/hooks/use-admin';
import { useAuth } from '@/contexts/AuthContext';
import { RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

interface FixResult {
  id: string;
  account_name: string;
  difference: number;
}

/**
 * Admin utility to retroactively fix closed signals that didn't update taken_trades
 * This handles the bug where signals were closed but taken_trades weren't processed
 */
export const FixTrades = () => {
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fixingBalance, setFixingBalance] = useState(false);
  const [fixingSignal, setFixingSignal] = useState(false);
  const [signalId, setSignalId] = useState('');
  const [results, setResults] = useState<FixResult[]>([]);

  const fixOpenTradesBalance = async () => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    setFixingBalance(true);
    try {
      // Get all accounts for current user
      const { data: accounts, error: accountError } = await supabase
        .from('trading_accounts')
        .select('*')
        .eq('user_id', user.id);

      logger.log('Query user ID:', user.id);
      logger.log('Found accounts:', accounts);
      logger.log('Account error:', accountError);

      if (accountError) {
        logger.error('Account fetch error:', accountError);
        throw accountError;
      }

      if (!accounts || accounts.length === 0) {
        toast.error('No accounts found! Please create a trading account first.');
        return;
      }

      // Fix logic: For each account, if initial_balance > current_balance, 
      // it means risk was deducted. We need to add it back.
      let fixedCount = 0;
      
      for (const account of accounts) {
        if (account.current_balance < account.initial_balance) {
          const difference = account.initial_balance - account.current_balance;
          
          logger.log(`Account ${account.account_name}: Initial=${account.initial_balance}, Current=${account.current_balance}, Diff=${difference}`);
          
          // Restore to initial balance
          const { error: updateError } = await supabase
            .from('trading_accounts')
            .update({
              current_balance: account.initial_balance,
              updated_at: new Date().toISOString()
            })
            .eq('id', account.id);

          if (updateError) {
            logger.error(`Failed to update account ${account.id}:`, updateError);
            toast.error(`Failed to fix ${account.account_name}`);
          } else {
            logger.log(`✅ Fixed account ${account.account_name}: +${difference.toFixed(2)}`);
            fixedCount++;
          }
        }
      }

      if (fixedCount > 0) {
        toast.success(`Fixed ${fixedCount} account(s)! Balance restored. Refreshing...`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.info('All accounts are already at correct balance!');
      }
    } catch (error) {
      logger.error('Error fixing balances:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fix balances');
    } finally {
      setFixingBalance(false);
    }
  };

  const fixSignalViaEdgeFunction = async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    if (!signalId.trim()) {
      toast.error('Please enter a signal ID');
      return;
    }

    setFixingSignal(true);
    try {
      const { data, error } = await supabase.functions.invoke('fix-trades', {
        body: { signalId: signalId.trim() }
      });

      logger.log('Edge function response:', data);

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setResults(data.results || []);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(data.error || 'Failed to fix trades');
      }
    } catch (error) {
      logger.error('Error calling edge function:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to call edge function');
    } finally {
      setFixingSignal(false);
    }
  };

  const fixOrphanedTrades = async () => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    setLoading(true);
    try {
      // Find closed signals with open taken_trades
      const { data: orphanedTrades, error: fetchError } = await supabase
        .from('taken_trades')
        .select(`
          id,
          user_id,
          account_id,
          signal_id,
          risk_amount,
          risk_percent,
          status,
          created_at,
          trading_signals!inner (
            id,
            currency_pair,
            direction,
            entry_price,
            stop_loss,
            take_profit_1,
            status,
            result
          ),
          trading_accounts!inner (
            id,
            current_balance
          )
        `)
        .eq('status', 'open')
        .eq('trading_signals.status', 'closed')
        .not('trading_signals.result', 'is', null);

      if (fetchError) throw fetchError;

      if (!orphanedTrades || orphanedTrades.length === 0) {
        toast.success('No orphaned trades found!');
        setResults([]);
        return;
      }

      logger.log(`Found ${orphanedTrades.length} orphaned trades to fix`);
      const fixed: FixResult[] = [];

      for (const trade of orphanedTrades) {
        const signal = (trade as unknown as { trading_signals: { result: string; }}).trading_signals;
        const account = (trade as unknown as { trading_accounts: { id: string; current_balance: number; }}).trading_accounts;
        const signalResult = signal.result;

        // Calculate P&L and balance adjustment
        let pnl = 0;
        let pnlPercent = 0;
        let balanceAdjustment = 0;

        if (signalResult === 'win') {
          pnl = trade.risk_amount;
          pnlPercent = trade.risk_percent;
          balanceAdjustment = trade.risk_amount; // Add profit
        } else if (signalResult === 'loss') {
          pnl = -trade.risk_amount;
          pnlPercent = -trade.risk_percent;
          balanceAdjustment = -trade.risk_amount; // Deduct risk
        } else if (signalResult === 'breakeven') {
          pnl = 0;
          pnlPercent = 0;
          balanceAdjustment = 0; // No change
        }

        // Update taken trade
        const { error: updateTradeError } = await supabase
          .from('taken_trades')
          .update({
            status: 'closed',
            result: signalResult,
            pnl,
            pnl_percent: pnlPercent,
            closed_at: new Date().toISOString(),
            journaled: true
          })
          .eq('id', trade.id);

        if (updateTradeError) {
          logger.error(`Failed to update trade ${trade.id}:`, updateTradeError);
          continue;
        }

        // Update account balance
        const newBalance = account.current_balance + balanceAdjustment;
        const { error: balanceError } = await supabase
          .from('trading_accounts')
          .update({
            current_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.account_id);

        if (balanceError) {
          logger.error(`Failed to update balance:`, balanceError);
        }

        // Create journal entry
        const exitPrice = signalResult === 'win' 
          ? signal.take_profit_1 
          : signalResult === 'loss' 
          ? signal.stop_loss 
          : signal.entry_price;

        const { error: journalError } = await supabase
          .from('trading_journal')
          .insert({
            user_id: trade.user_id,
            pair: signal.currency_pair,
            direction: signal.direction === 'buy' ? 'long' : 'short',
            entry_price: signal.entry_price,
            exit_price: exitPrice,
            stop_loss: signal.stop_loss,
            take_profit: signal.take_profit_1,
            risk_percent: trade.risk_percent,
            pnl,
            pnl_percent: pnlPercent,
            status: 'closed',
            notes: `Retroactively fixed: ${signal.currency_pair} ${signal.direction.toUpperCase()} - ${signalResult.toUpperCase()}`,
            entry_date: trade.created_at
          });

        if (journalError) {
          logger.error(`Failed to create journal entry:`, journalError);
        }

        fixed.push({
          signal: signal.currency_pair,
          result: signalResult,
          pnl,
          balanceAdjustment
        });
      }

      setResults(fixed);
      toast.success(`Fixed ${fixed.length} orphaned trades!`);
    } catch (error) {
      logger.error('Error fixing trades:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to fix trades');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-6 bg-secondary rounded-lg space-y-4">
      <div>
        <h3 className="text-lg font-bold mb-2">Fix Current Open Trades</h3>
        <p className="text-sm text-muted-foreground mb-4">
          If you have open trades with incorrectly reduced balance, this will restore the balance.
          Balance should only change when trades close, not when opened.
        </p>
        <Button onClick={fixOpenTradesBalance} disabled={fixingBalance} variant="default">
          <RefreshCw className={`w-4 h-4 mr-2 ${fixingBalance ? 'animate-spin' : ''}`} />
          {fixingBalance ? 'Fixing...' : 'Fix Open Trades Balance'}
        </Button>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-lg font-bold mb-2">Fix Orphaned Trades</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This will find and fix any closed signals that didn't update their taken_trades.
        </p>
        <Button onClick={fixOrphanedTrades} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Fixing...' : 'Fix Orphaned Trades'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-semibold">Fixed Trades:</h4>
          {results.map((r, i) => (
            <div key={i} className="text-sm bg-background p-2 rounded">
              {r.signal} - {r.result} | P&L: {r.pnl > 0 ? '+' : ''}{r.pnl.toFixed(2)} | 
              Balance: {r.balanceAdjustment > 0 ? '+' : ''}{r.balanceAdjustment.toFixed(2)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
