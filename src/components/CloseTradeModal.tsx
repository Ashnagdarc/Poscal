import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { calculatePips, calculatePnL, calculatePositionSize } from '@/lib/forexCalculations';
import { Tables } from '@/types/database.types';
import { signalsApi, accountsApi, tradesApi } from '@/lib/api';

type TakenTrade = Tables<'taken_trades'>;

interface CloseTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: TakenTrade;
  signal: {
    currency_pair: string;
    direction: 'buy' | 'sell';
    entry_price: number;
    stop_loss: number;
    take_profit_1: number;
    pips_to_sl: number;
  };
  onTradeClosed: () => void;
}

export const CloseTradeModal = ({
  open,
  onOpenChange,
  trade,
  signal,
  onTradeClosed,
}: CloseTradeModalProps) => {
  const [exitPrice, setExitPrice] = useState('');
  const [loading, setLoading] = useState(false);

  // Calculate preview P&L
  const getPreviewPnL = () => {
    if (!exitPrice || isNaN(parseFloat(exitPrice))) return null;
    
    const exit = parseFloat(exitPrice);
    const direction = signal.direction === 'buy' ? 'long' : 'short';
    
    // Calculate position size based on risk
    const positionSize = calculatePositionSize(
      trade.risk_amount,
      signal.pips_to_sl,
      signal.currency_pair,
      'USD',
      signal.entry_price
    );
    
    const pnl = calculatePnL(
      signal.entry_price,
      exit,
      positionSize,
      signal.currency_pair,
      direction
    );
    
    const pnlPercent = (pnl / trade.risk_amount) * trade.risk_percent;
    
    return { pnl, pnlPercent, positionSize };
  };

  const preview = getPreviewPnL();

  const handleClose = async () => {
    if (!exitPrice || isNaN(parseFloat(exitPrice))) {
      toast.error('Please enter a valid exit price');
      return;
    }

    setLoading(true);
    const exit = parseFloat(exitPrice);
    const direction = signal.direction === 'buy' ? 'long' : 'short';

    try {
      // Calculate position size
      const positionSize = calculatePositionSize(
        trade.risk_amount,
        signal.pips_to_sl,
        signal.currency_pair,
        'USD',
        signal.entry_price
      );

      // Calculate P&L
      const pnl = calculatePnL(
        signal.entry_price,
        exit,
        positionSize,
        signal.currency_pair,
        direction
      );
      
      const pnlPercent = (pnl / trade.risk_amount) * trade.risk_percent;
      
      // Determine result
      let result = 'breakeven';
      if (pnl > 0) result = 'win';
      else if (pnl < 0) result = 'loss';

      // Update the taken trade via API
      await signalsApi.updateTakenTrade(trade.id, 'closed', pnl);

      // Update account balance via API
      // For simplicity, client calculates new balance; alternatively, backend can derive it
      const newBalance = (trade as any).current_balance ? (trade as any).current_balance + pnl : undefined;
      if (newBalance !== undefined) {
        await accountsApi.updateBalance(trade.account_id, newBalance);
      }

      // Create journal entry via API
      await tradesApi.create({
        user_id: trade.user_id,
        pair: signal.currency_pair,
        direction,
        entry_price: signal.entry_price,
        exit_price: exit,
        stop_loss: signal.stop_loss,
        take_profit: signal.take_profit_1,
        position_size: positionSize,
        risk_percent: trade.risk_percent,
        pnl,
        pnl_percent: pnlPercent,
        status: 'closed',
        notes: `Manual close: ${signal.currency_pair} ${signal.direction.toUpperCase()} - ${result.toUpperCase()}`,
        entry_date: trade.created_at,
        exit_date: new Date().toISOString(),
      });

      toast.success(`Trade closed with ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} P&L`);
      onOpenChange(false);
      onTradeClosed();
    } catch (error) {
      logger.error('Error closing trade:', error);
      toast.error('Failed to close trade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="w-5 h-5" />
            Close Trade
          </DialogTitle>
          <DialogDescription>
            Enter your exit price to calculate and record the P&L.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Trade Info */}
          <div className="bg-secondary rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pair</span>
              <span className="font-medium">{signal.currency_pair}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Direction</span>
              <span className={`font-medium ${signal.direction === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                {signal.direction.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Entry Price</span>
              <span className="font-medium">{signal.entry_price}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Risk</span>
              <span className="font-medium">${trade.risk_amount.toFixed(2)} ({trade.risk_percent}%)</span>
            </div>
          </div>

          {/* Exit Price Input */}
          <div className="space-y-2">
            <Label>Exit Price</Label>
            <Input
              type="number"
              step="any"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder="Enter exit price"
            />
          </div>

          {/* P&L Preview */}
          {preview && (
            <div className={`rounded-lg p-3 ${preview.pnl >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className="text-xs text-muted-foreground mb-1">Estimated P&L</p>
              <p className={`text-xl font-bold ${preview.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {preview.pnl >= 0 ? '+' : ''}${preview.pnl.toFixed(2)}
                <span className="text-sm ml-2">
                  ({preview.pnlPercent >= 0 ? '+' : ''}{preview.pnlPercent.toFixed(2)}%)
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Position size: {preview.positionSize.toFixed(2)} lots
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleClose}
              disabled={loading || !exitPrice}
            >
              {loading ? 'Closing...' : 'Close Trade'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
