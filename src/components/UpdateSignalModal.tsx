import { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// Helper to calculate pips
const calculatePips = (price1: number, price2: number, pair: string): number => {
  const isJPYPair = pair.includes('JPY');
  const isXAUPair = pair.includes('XAU');
  
  let pipMultiplier = 10000;
  if (isJPYPair) pipMultiplier = 100;
  if (isXAUPair) pipMultiplier = 10;
  
  return Math.abs(Math.round((price1 - price2) * pipMultiplier));
};

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

      const updateData: Record<string, any> = {
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

      toast.success('Signal updated successfully!');
      setOpen(false);
      onSignalUpdated();
    } catch (err: any) {
      console.error('Error updating signal:', err);
      toast.error(err.message || 'Failed to update signal');
    } finally {
      setLoading(false);
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
