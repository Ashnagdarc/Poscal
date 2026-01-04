import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { calculatePips } from '@/lib/forexCalculations';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { SignalFormSchema } from '@/lib/formValidation';

const CURRENCY_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD',
  'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'XAU/USD', 'BTC/USD',
];

interface CreateSignalModalProps {
  onSignalCreated: () => void;
}

export const CreateSignalModal = ({ onSignalCreated }: CreateSignalModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currency_pair: '',
    direction: 'buy' as 'buy' | 'sell',
    entry_price: '',
    stop_loss: '',
    take_profit_1: '',
    take_profit_2: '',
    take_profit_3: '',
    chart_image_url: '',
    notes: '',
  });

  const validateLevels = (
    direction: 'buy' | 'sell',
    entry: number,
    sl: number,
    tp1: number,
    tp2: number | null,
    tp3: number | null
  ): string | null => {
    if (direction === 'buy') {
      // For BUY: SL must be below entry, TPs must be above entry
      if (sl >= entry) {
        return 'Stop Loss must be below Entry Price for a BUY trade';
      }
      if (tp1 <= entry) {
        return 'Take Profit 1 must be above Entry Price for a BUY trade';
      }
      if (tp2 !== null && tp2 <= entry) {
        return 'Take Profit 2 must be above Entry Price for a BUY trade';
      }
      if (tp3 !== null && tp3 <= entry) {
        return 'Take Profit 3 must be above Entry Price for a BUY trade';
      }
      // TPs should be in ascending order
      if (tp2 !== null && tp2 <= tp1) {
        return 'Take Profit 2 must be higher than Take Profit 1';
      }
      if (tp3 !== null && tp2 !== null && tp3 <= tp2) {
        return 'Take Profit 3 must be higher than Take Profit 2';
      }
    } else {
      // For SELL: SL must be above entry, TPs must be below entry
      if (sl <= entry) {
        return 'Stop Loss must be above Entry Price for a SELL trade';
      }
      if (tp1 >= entry) {
        return 'Take Profit 1 must be below Entry Price for a SELL trade';
      }
      if (tp2 !== null && tp2 >= entry) {
        return 'Take Profit 2 must be below Entry Price for a SELL trade';
      }
      if (tp3 !== null && tp3 >= entry) {
        return 'Take Profit 3 must be below Entry Price for a SELL trade';
      }
      // TPs should be in descending order (lower is better for SELL)
      if (tp2 !== null && tp2 >= tp1) {
        return 'Take Profit 2 must be lower than Take Profit 1';
      }
      if (tp3 !== null && tp2 !== null && tp3 >= tp2) {
        return 'Take Profit 3 must be lower than Take Profit 2';
      }
    }
    return null; // All validations passed
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First validate with Zod schema
      const validation = SignalFormSchema.safeParse(formData);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }

      const entry = parseFloat(formData.entry_price);
      const sl = parseFloat(formData.stop_loss);
      const tp1 = parseFloat(formData.take_profit_1);
      const tp2 = formData.take_profit_2 ? parseFloat(formData.take_profit_2) : null;
      const tp3 = formData.take_profit_3 ? parseFloat(formData.take_profit_3) : null;

      // Validate levels
      const validationError = validateLevels(formData.direction, entry, sl, tp1, tp2, tp3);
      if (validationError) {
        toast.error(validationError);
        setLoading(false);
        return;
      }

      const signalData: any = {
        currency_pair: formData.currency_pair,
        direction: formData.direction,
        entry_price: entry,
        stop_loss: sl,
        take_profit_1: tp1,
        pips_to_sl: Math.round(calculatePips(entry, sl, formData.currency_pair)),
        pips_to_tp1: Math.round(calculatePips(entry, tp1, formData.currency_pair)),
        status: 'active',
      };

      // Add optional fields only if they have values
      if (tp2) {
        signalData.take_profit_2 = tp2;
        signalData.pips_to_tp2 = Math.round(calculatePips(entry, tp2, formData.currency_pair));
      }
      if (tp3) {
        signalData.take_profit_3 = tp3;
        signalData.pips_to_tp3 = Math.round(calculatePips(entry, tp3, formData.currency_pair));
      }
      if (formData.chart_image_url) {
        signalData.chart_image_url = formData.chart_image_url;
      }
      if (formData.notes) {
        signalData.notes = formData.notes;
      }

      console.log('📤 Attempting to insert signal with data:', JSON.stringify(signalData, null, 2));

      const { error } = await supabase.from('trading_signals').insert(signalData);

      if (error) {
        console.error('Database error details:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        
        // Try to fetch an existing signal to compare structure
        const { data: existingSignal } = await supabase
          .from('trading_signals')
          .select('*')
          .limit(1)
          .single();
        console.log('📋 Example existing signal structure:', existingSignal);
        
        throw error;
      }

      // Send push notification to all subscribers
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            title: `📊 New Signal: ${formData.currency_pair}`,
            body: `${formData.direction.toUpperCase()} at ${entry}`,
            tag: 'new-signal',
            data: { type: 'signal' },
          },
        });
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
        // Don't fail the signal creation if push fails
      }

      toast.success('Signal created successfully!');
      setOpen(false);
      setFormData({
        currency_pair: '',
        direction: 'buy',
        entry_price: '',
        stop_loss: '',
        take_profit_1: '',
        take_profit_2: '',
        take_profit_3: '',
        chart_image_url: '',
        notes: '',
      });
      onSignalCreated();
    } catch (error) {
      logger.error('Error creating signal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create signal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-40"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Signal</DialogTitle>
          <DialogDescription>
            Add a new trading signal with entry, stop loss, and take profit levels.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency Pair</Label>
              <Select
                value={formData.currency_pair}
                onValueChange={(v) => setFormData({ ...formData, currency_pair: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pair" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(v) => setFormData({ ...formData, direction: v as 'buy' | 'sell' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entry Price</Label>
              <Input
                type="number"
                step="any"
                value={formData.entry_price}
                onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Stop Loss</Label>
              <Input
                type="number"
                step="any"
                value={formData.stop_loss}
                onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>TP1</Label>
              <Input
                type="number"
                step="any"
                value={formData.take_profit_1}
                onChange={(e) => setFormData({ ...formData, take_profit_1: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>TP2</Label>
              <Input
                type="number"
                step="any"
                value={formData.take_profit_2}
                onChange={(e) => setFormData({ ...formData, take_profit_2: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label>TP3</Label>
              <Input
                type="number"
                step="any"
                value={formData.take_profit_3}
                onChange={(e) => setFormData({ ...formData, take_profit_3: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chart Image URL</Label>
            <Input
              type="url"
              value={formData.chart_image_url}
              onChange={(e) => setFormData({ ...formData, chart_image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Analysis notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creating...' : 'Create Signal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
