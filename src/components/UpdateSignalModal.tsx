import { useState, useEffect } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { calculatePositionSize, calculatePnL, calculatePips } from '@/lib/forexCalculations';
import { signalsApi, notificationsApi } from '@/lib/api';

interface UpdateSignalModalProps {
  signalId: string;
  currentStatus: string;
  currentResult: string | null;
  currentStopLoss: number | string;
  currentTakeProfit1: number | string;
  currentTakeProfit2: number | string | null;
  currentTakeProfit3: number | string | null;
  currentEntryPrice: number | string;
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
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [result, setResult] = useState(currentResult || 'pending');
  
  // Helper to convert to string for input fields
  const toStr = (val: number | string | null | undefined): string => {
    if (!val && val !== 0) return '';
    return typeof val === 'string' ? val : val.toString();
  };

  // Helper to convert to number for calculations
  const toNum = (val: number | string | null | undefined): number => {
    if (!val && val !== 0) return 0;
    return typeof val === 'string' ? parseFloat(val) : val;
  };
  
  // Price levels
  const [stopLoss, setStopLoss] = useState(toStr(currentStopLoss));
  const [takeProfit1, setTakeProfit1] = useState(toStr(currentTakeProfit1));
  const [takeProfit2, setTakeProfit2] = useState(toStr(currentTakeProfit2));
  const [takeProfit3, setTakeProfit3] = useState(toStr(currentTakeProfit3));
  
  // TP hit toggles
  const [tp1HitState, setTp1HitState] = useState(tp1Hit);
  const [tp2HitState, setTp2HitState] = useState(tp2Hit);
  const [tp3HitState, setTp3HitState] = useState(tp3Hit);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStatus(currentStatus);
      setResult(currentResult || 'pending');
      setStopLoss(toStr(currentStopLoss));
      setTakeProfit1(toStr(currentTakeProfit1));
      setTakeProfit2(toStr(currentTakeProfit2));
      setTakeProfit3(toStr(currentTakeProfit3));
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
        pips_to_sl: Math.round(calculatePips(toNum(currentEntryPrice), sl, currencyPair)),
        pips_to_tp1: Math.round(calculatePips(toNum(currentEntryPrice), tp1, currencyPair)),
        pips_to_tp2: tp2 ? Math.round(calculatePips(toNum(currentEntryPrice), tp2, currencyPair)) : null,
        pips_to_tp3: tp3 ? Math.round(calculatePips(toNum(currentEntryPrice), tp3, currencyPair)) : null,
        tp1_hit: tp1HitState,
        tp2_hit: tp2HitState,
        tp3_hit: tp3HitState,
      };

      if (status === 'closed' && currentStatus !== 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      await signalsApi.update(signalId, updateData);

      // If signal is being closed, update all taken trades
      if (status === 'closed' && currentStatus !== 'closed' && updateData.result) {
        await handleCloseTakenTrades(signalId, String(updateData.result));
      }

      // If signal is being cancelled, cancel all open taken trades without P/L impact
      if (status === 'cancelled' && currentStatus !== 'cancelled') {
        await handleCancelTakenTrades(signalId);
      }

      // Queue notification for signal update (optional - don't block on failure)
      let notificationTitle = `📊 Signal Updated: ${currencyPair}`;
      let notificationBody = `Price levels have been updated`;
      
      if (status === 'closed' && currentStatus !== 'closed') {
        notificationTitle = `🏁 Signal Closed: ${currencyPair} - ${result.toUpperCase()}`;
        notificationBody = `The ${currencyPair} signal has been closed with result: ${result}`;
      } else if (status === 'cancelled' && currentStatus !== 'cancelled') {
        notificationTitle = `⛔ Signal Cancelled: ${currencyPair}`;
        notificationBody = `The ${currencyPair} signal has been cancelled`;
      }

      try {
        // Note: Notification queuing is optional and requires user_id
        // Skipping for now as this is a broadcast-style notification
        // await notificationsApi.queueNotification({...});
        console.log('Signal notification skipped (requires broadcast support)');
      } catch (error) {
        console.warn('Failed to queue notification:', error);
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
      console.log(`🔄 Calling RPC function to close taken trades for signal ${signalId} with result: ${signalResult}`);
      
      // Close open taken trades for this signal using signalsApi
      const takenTrades = await signalsApi.getUserTakenTrades();
      const openTrades = takenTrades.filter((t: any) => t.signal_id === signalId && t.status === 'open');
      let processed = 0;
      for (const t of openTrades) {
        await signalsApi.updateTakenTrade(t.id, 'closed', undefined);
        processed++;
      }
      if (processed > 0) {
        toast.success(`Processed ${processed} trade(s). Check your journal!`);
      } else {
        toast.info('No open trades found for this signal');
      }
    } catch (error) {
      logger.error('❌ Error closing taken trades:', error);
      toast.error('Failed to process taken trades');
    }
  };

  const handleCancelTakenTrades = async (signalId: string) => {
    try {
      console.log(`🔄 Cancelling all open taken trades for signal ${signalId}`);
      
      // Simply close taken trades as cancelled with no P/L impact
      const takenTrades = await signalsApi.getUserTakenTrades();
      const openTrades = takenTrades.filter((t: any) => t.signal_id === signalId && t.status === 'open');
      for (const t of openTrades) {
        await signalsApi.updateTakenTrade(t.id, 'cancelled');
      }

      console.log('✅ Cancelled taken trades');
      toast.info('Open trades for this signal have been cancelled');
    } catch (error) {
      logger.error('❌ Error cancelling taken trades:', error);
      toast.error('Failed to cancel taken trades');
    }
  };

  const handleDeleteSignal = async () => {
    setDeleteLoading(true);
    try {
      console.log(`🗑️ Deleting signal ${signalId}`);
      
      // First, delete or cancel all taken trades for this signal
      const allTakenTrades = await signalsApi.getUserTakenTrades();
      const signalTakenTrades = allTakenTrades.filter((t: any) => t.signal_id === signalId);
      const takenTradeCount = signalTakenTrades.length;

      // Delete all taken trades (admin can delete via RLS or we cancel them)
      if (takenTradeCount > 0) {
        for (const t of signalTakenTrades) {
          await signalsApi.updateTakenTrade(t.id, 'cancelled');
        }
      }

      // Now delete the signal
      await signalsApi.delete(signalId);

      // Queue notification that signal was deleted (optional - don't block)
      try {
        // Note: Notification queuing skipped (requires broadcast support)
        console.log('Signal deletion notification skipped (requires broadcast support)');
      } catch (error) {
        console.warn('Failed to queue notification:', error);
      }

      console.log('✅ Signal deleted');
      
      if (takenTradeCount > 0) {
        toast.success(`Signal deleted. ${takenTradeCount} taken trade(s) removed.`);
      } else {
        toast.success('Signal deleted successfully');
      }
      
      setOpen(false);
      onSignalUpdated();
    } catch (error) {
      logger.error('❌ Error deleting signal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete signal');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
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

          <div className="flex flex-col gap-3 pt-4">
            <div className="flex gap-3">
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
            
            {/* Delete Section */}
            {!showDeleteConfirm ? (
              <Button
                type="button"
                variant="outline"
                className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Signal
              </Button>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
                <p className="text-sm text-red-400 font-medium">⚠️ Are you sure?</p>
                <p className="text-xs text-muted-foreground">
                  This will permanently delete the signal and all associated taken trades. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleDeleteSignal}
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete Forever'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
