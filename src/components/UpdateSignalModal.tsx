import { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { calculatePositionSize, calculatePnL, calculatePips } from '@/lib/forexCalculations';

interface UpdateSignalModalProps {
  signalId: string;
  currentStatus: string;
  currentResult: string | null;
  currentStopLoss: number;
  currentTakeProfit1: number;
  currentTakeProfit2: number | null;
  currentTakeProfit3: number | null;
  currentEntryPrice: number;
  currencyPair: string;
  direction: 'buy' | 'sell';
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  onSignalUpdated: () => void;
}

export const UpdateSignalModal = ({ 
  signalId, 
  currentStatus, 
  currentResult,
  currentStopLoss,
  currentTakeProfit1,
  currentTakeProfit2,
  currentTakeProfit3,
  currentEntryPrice,
  currencyPair,
  direction,
  tp1Hit,
  tp2Hit,
  tp3Hit,
  onSignalUpdated 
}: UpdateSignalModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [result, setResult] = useState(currentResult || 'pending');
  
  // Price levels
  const [stopLoss, setStopLoss] = useState(currentStopLoss.toString());
  const [takeProfit1, setTakeProfit1] = useState(currentTakeProfit1.toString());
  const [takeProfit2, setTakeProfit2] = useState(currentTakeProfit2?.toString() || '');
  const [takeProfit3, setTakeProfit3] = useState(currentTakeProfit3?.toString() || '');
  
  // TP hit toggles
  const [tp1HitState, setTp1HitState] = useState(tp1Hit);
  const [tp2HitState, setTp2HitState] = useState(tp2Hit);
  const [tp3HitState, setTp3HitState] = useState(tp3Hit);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setResult(currentResult || 'pending');
      setStopLoss(currentStopLoss.toString());
      setTakeProfit1(currentTakeProfit1.toString());
      setTakeProfit2(currentTakeProfit2?.toString() || '');
      setTakeProfit3(currentTakeProfit3?.toString() || '');
      setTp1HitState(tp1Hit);
      setTp2HitState(tp2Hit);
      setTp3HitState(tp3Hit);
    }
  }, [open, currentStatus, currentResult, currentStopLoss, currentTakeProfit1, currentTakeProfit2, currentTakeProfit3, tp1Hit, tp2Hit, tp3Hit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const sl = parseFloat(stopLoss);
      const tp1 = parseFloat(takeProfit1);
      const tp2 = takeProfit2 ? parseFloat(takeProfit2) : null;
      const tp3 = takeProfit3 ? parseFloat(takeProfit3) : null;

      if (isNaN(sl) || isNaN(tp1)) {
        throw new Error('Invalid price values');
      }

      const updateData: Record<string, string | number | boolean | null | undefined> = {
        status,
        result: result === 'pending' ? null : result,
        stop_loss: sl,
        take_profit_1: tp1,
        take_profit_2: tp2,
        take_profit_3: tp3,
        pips_to_sl: calculatePips(currentEntryPrice, sl, currencyPair),
        pips_to_tp1: calculatePips(currentEntryPrice, tp1, currencyPair),
        pips_to_tp2: tp2 ? calculatePips(currentEntryPrice, tp2, currencyPair) : null,
        pips_to_tp3: tp3 ? calculatePips(currentEntryPrice, tp3, currencyPair) : null,
        tp1_hit: tp1HitState,
        tp2_hit: tp2HitState,
        tp3_hit: tp3HitState,
      };

      if (status === 'closed' && currentStatus !== 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('trading_signals')
        .update(updateData)
        .eq('id', signalId);

      if (error) throw error;

      // If signal is being closed, update all taken trades
      if (status === 'closed' && currentStatus !== 'closed' && updateData.result) {
        await handleCloseTakenTrades(signalId, String(updateData.result));
      }

      toast.success('Signal updated successfully!');
      setOpen(false);
      onSignalUpdated();
    } catch (error) {
      logger.error('Error updating signal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update signal');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseTakenTrades = async (signalId: string, signalResult: string) => {
    try {
      console.log(`🔄 Starting to close taken trades for signal ${signalId} with result: ${signalResult}`);
      
      // Fetch all open taken trades for this signal
      const { data: takenTrades, error: fetchError } = await supabase
        .from('taken_trades')
        .select('*')
        .eq('signal_id', signalId)
        .eq('status', 'open');

      if (fetchError) {
        console.error('Error fetching taken trades:', fetchError);
        throw fetchError;
      }
      
      if (!takenTrades || takenTrades.length === 0) {
        console.log('No open taken trades found for this signal');
        return;
      }

      console.log(`📊 Found ${takenTrades.length} taken trades to process`);

      // Process each taken trade
      for (const trade of takenTrades) {
        console.log(`Processing trade ${trade.id} with risk: ${trade.risk_amount}`);
        
        // Calculate P&L based on result and risk amount
        // Calculate P&L and position size using proper forex calculations
        const { data: signalData } = await supabase
          .from('trading_signals')
          .select('pips_to_sl, pips_to_tp1, entry_price')
          .eq('id', signalId)
          .single();
        
        if (!signalData) {
          console.error('Could not fetch signal data');
          continue;
        }
        
        // Calculate position size in lots
        const positionSize = calculatePositionSize(
          trade.risk_amount,
          signalData.pips_to_sl,
          currencyPair,
          'USD',
          signalData.entry_price
        );
        
        console.log(`📊 Position size: ${positionSize} lots for ${currencyPair}`);
        
        let pnl = 0;
        let pnlPercent = 0;
        let balanceAdjustment = 0;
        let exitPrice = currentEntryPrice;
        
        if (signalResult === 'win') {
          exitPrice = currentTakeProfit1;
          pnl = calculatePnL(
            currentEntryPrice,
            currentTakeProfit1,
            positionSize,
            currencyPair,
            direction === 'buy' ? 'long' : 'short'
          );
          // Calculate pnl_percent based on account balance impact
          pnlPercent = trade.risk_percent * (pnl / trade.risk_amount);
          balanceAdjustment = pnl;
        } else if (signalResult === 'loss') {
          exitPrice = currentStopLoss;
          pnl = -trade.risk_amount; // Loss is the risk amount
          pnlPercent = -trade.risk_percent;
          balanceAdjustment = pnl;
        } else if (signalResult === 'breakeven') {
          exitPrice = currentEntryPrice;
          pnl = 0;
          pnlPercent = 0;
          balanceAdjustment = 0;
        }

        console.log(`💰 P&L: ${pnl}, Balance adjustment: ${balanceAdjustment}`);

        // Update the taken trade
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
          console.error(`❌ Failed to update taken trade ${trade.id}:`, updateTradeError);
          continue;
        }
        
        console.log(`✅ Updated taken trade ${trade.id}`);

        // Fetch current account balance
        const { data: accountData, error: accountFetchError } = await supabase
          .from('trading_accounts')
          .select('current_balance')
          .eq('id', trade.account_id)
          .single();

        if (accountFetchError || !accountData) {
          console.error(`❌ Failed to fetch account ${trade.account_id}:`, accountFetchError);
          continue;
        }

        // Update account balance
        const newBalance = accountData.current_balance + balanceAdjustment;
        console.log(`📈 Updating account balance: ${accountData.current_balance} + ${balanceAdjustment} = ${newBalance}`);
        
        const { error: balanceError } = await supabase
          .from('trading_accounts')
          .update({ 
            current_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.account_id);

        if (balanceError) {
          console.error(`❌ Failed to update account balance ${trade.account_id}:`, balanceError);
          continue;
        }
        
        console.log(`✅ Updated account balance`);

        // Create journal entry
        console.log(`📝 Creating journal entry with position size: ${positionSize.toFixed(2)} lots`);
        
        const { error: journalError } = await supabase
          .from('trading_journal')
          .insert({
            user_id: trade.user_id,
            pair: currencyPair,
            direction: direction === 'buy' ? 'long' : 'short',
            entry_price: currentEntryPrice,
            exit_price: exitPrice,
            stop_loss: currentStopLoss,
            take_profit: currentTakeProfit1,
            position_size: positionSize,
            risk_percent: trade.risk_percent,
            pnl,
            pnl_percent: pnlPercent,
            status: 'closed',
            notes: `Auto-closed from signal: ${currencyPair} ${direction.toUpperCase()} - ${signalResult.toUpperCase()}`,
            entry_date: trade.created_at
          });

        if (journalError) {
          console.error(`❌ Failed to create journal entry for trade ${trade.id}:`, journalError);
        } else {
          console.log(`✅ Created journal entry`);
        }
      }

      logger.log(`✅ Successfully processed ${takenTrades.length} taken trades`);
      toast.success(`Processed ${takenTrades.length} trade(s). Check your journal!`);
    } catch (error) {
      logger.error('❌ Error closing taken trades:', error);
      toast.error('Failed to process taken trades');
      // Don't throw - we don't want to block the signal update
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs">
          <Edit2 className="w-3 h-3 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Signal - {currencyPair}</DialogTitle>
          <DialogDescription>
            Edit signal status, result, or adjust price levels.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="levels">Price Levels</TabsTrigger>
            </TabsList>
            
            <TabsContent value="status" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Result</Label>
                <Select 
                  value={result} 
                  onValueChange={(value) => {
                    setResult(value);
                    // Auto-close when setting a final result
                    if (value !== 'pending' && status === 'active') {
                      setStatus('closed');
                    }
                    // Auto-reopen if setting back to pending
                    if (value === 'pending' && status === 'closed') {
                      setStatus('active');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="win">Win</SelectItem>
                    <SelectItem value="loss">Loss</SelectItem>
                    <SelectItem value="breakeven">Breakeven</SelectItem>
                  </SelectContent>
                </Select>
                {result !== 'pending' && status === 'active' && (
                  <p className="text-xs text-amber-400">⚠️ Status will be set to "Closed" automatically</p>
                )}
              </div>

              {/* TP Hit Toggles */}
              <div className="space-y-2">
                <Label>Take Profit Hits</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={tp1HitState ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTp1HitState(!tp1HitState)}
                    className={tp1HitState ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                  >
                    TP1 {tp1HitState ? '✓' : ''}
                  </Button>
                  {currentTakeProfit2 && (
                    <Button
                      type="button"
                      variant={tp2HitState ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTp2HitState(!tp2HitState)}
                      className={tp2HitState ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                    >
                      TP2 {tp2HitState ? '✓' : ''}
                    </Button>
                  )}
                  {currentTakeProfit3 && (
                    <Button
                      type="button"
                      variant={tp3HitState ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTp3HitState(!tp3HitState)}
                      className={tp3HitState ? "bg-emerald-500 hover:bg-emerald-600" : ""}
                    >
                      TP3 {tp3HitState ? '✓' : ''}
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="levels" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Stop Loss</Label>
                <Input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="Stop loss price"
                />
              </div>

              <div className="space-y-2">
                <Label>Take Profit 1</Label>
                <Input
                  type="number"
                  step="any"
                  value={takeProfit1}
                  onChange={(e) => setTakeProfit1(e.target.value)}
                  placeholder="Take profit 1"
                />
              </div>

              <div className="space-y-2">
                <Label>Take Profit 2 (Optional)</Label>
                <Input
                  type="number"
                  step="any"
                  value={takeProfit2}
                  onChange={(e) => setTakeProfit2(e.target.value)}
                  placeholder="Take profit 2"
                />
              </div>

              <div className="space-y-2">
                <Label>Take Profit 3 (Optional)</Label>
                <Input
                  type="number"
                  step="any"
                  value={takeProfit3}
                  onChange={(e) => setTakeProfit3(e.target.value)}
                  placeholder="Take profit 3"
                />
              </div>

              <div className="text-xs text-muted-foreground">
                Entry: {currentEntryPrice} | Direction: {direction.toUpperCase()}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
