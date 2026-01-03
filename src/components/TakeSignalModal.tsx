import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Tables } from '@/types/database.types';

type TradingAccount = Tables<'trading_accounts'>;

interface Signal {
  id: string;
  currency_pair: string;
  direction: 'buy' | 'sell';
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
}

interface TakeSignalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signal: Signal | null;
  accounts: TradingAccount[];
  onTradeTaken: () => void;
}

export const TakeSignalModal = ({ open, onOpenChange, signal, accounts, onTradeTaken }: TakeSignalModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  
  const riskPercentNum = parseFloat(riskPercent) || 0;
  const riskAmount = selectedAccount ? (selectedAccount.current_balance * riskPercentNum) / 100 : 0;

  // Auto-select first account if only one exists
  useEffect(() => {
    if (accounts.length === 1 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !signal || !selectedAccountId) {
      toast.error('Please select an account');
      return;
    }

    if (riskPercentNum <= 0 || riskPercentNum > 100) {
      toast.error('Risk must be between 0.01% and 100%');
      return;
    }

    setLoading(true);

    try {
      // Check if already taken
      const { data: existingTrade } = await supabase
        .from('taken_trades')
        .select('id')
        .eq('user_id', user.id)
        .eq('signal_id', signal.id)
        .single();

      if (existingTrade) {
        toast.error('You have already taken this signal');
        setLoading(false);
        return;
      }

      // Insert the taken trade
      const { error: insertError } = await supabase
        .from('taken_trades')
        .insert({
          user_id: user.id,
          account_id: selectedAccountId,
          signal_id: signal.id,
          risk_percent: riskPercentNum,
          risk_amount: riskAmount,
          status: 'open',
        });

      if (insertError) throw insertError;

      toast.success(`Signal taken! Risking ${riskPercentNum}% (${selectedAccount!.currency} ${riskAmount.toFixed(2)})`);
      onTradeTaken();
      onOpenChange(false);
      
      // Reset form
      setRiskPercent('1');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to take signal');
    } finally {
      setLoading(false);
    }
  };

  if (!signal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {signal.direction === 'buy' ? (
              <TrendingUp className="w-5 h-5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            Take Signal: {signal.currency_pair}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-secondary rounded-lg p-3 mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Direction:</span>
              <span className={`ml-2 font-medium ${signal.direction === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                {signal.direction.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Entry:</span>
              <span className="ml-2 font-medium">{signal.entry_price}</span>
            </div>
            <div>
              <span className="text-muted-foreground">SL:</span>
              <span className="ml-2 font-medium text-red-400">{signal.stop_loss}</span>
            </div>
            <div>
              <span className="text-muted-foreground">TP1:</span>
              <span className="ml-2 font-medium text-emerald-400">{signal.take_profit_1}</span>
            </div>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-4">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              You need to create a trading account first.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account">Trading Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={loading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name} ({account.currency} {account.current_balance.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk">Risk Percentage (%)</Label>
              <Input
                id="risk"
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                placeholder="1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
                disabled={loading}
              />
            </div>

            {selectedAccount && riskPercentNum > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-300">
                  <strong>Risk Amount:</strong> {selectedAccount.currency} {riskAmount.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Current Balance:</strong> {selectedAccount.currency} {selectedAccount.current_balance.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Balance will only change when the trade closes
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !selectedAccountId}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Taking Signal...
                </>
              ) : (
                'Take Signal'
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
