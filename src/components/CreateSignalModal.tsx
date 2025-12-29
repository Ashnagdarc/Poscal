import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const calculatePips = (entry: number, target: number, pair: string): number => {
    const isJpy = pair.includes('JPY');
    const multiplier = isJpy ? 100 : 10000;
    return Math.abs(Math.round((target - entry) * multiplier));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const entry = parseFloat(formData.entry_price);
      const sl = parseFloat(formData.stop_loss);
      const tp1 = parseFloat(formData.take_profit_1);
      const tp2 = formData.take_profit_2 ? parseFloat(formData.take_profit_2) : null;
      const tp3 = formData.take_profit_3 ? parseFloat(formData.take_profit_3) : null;

      const signalData = {
        currency_pair: formData.currency_pair,
        direction: formData.direction,
        entry_price: entry,
        stop_loss: sl,
        take_profit_1: tp1,
        take_profit_2: tp2,
        take_profit_3: tp3,
        pips_to_sl: calculatePips(entry, sl, formData.currency_pair),
        pips_to_tp1: calculatePips(entry, tp1, formData.currency_pair),
        pips_to_tp2: tp2 ? calculatePips(entry, tp2, formData.currency_pair) : null,
        pips_to_tp3: tp3 ? calculatePips(entry, tp3, formData.currency_pair) : null,
        chart_image_url: formData.chart_image_url || null,
        notes: formData.notes || null,
        status: 'active',
        result: null,
      };

      const { error } = await supabase.from('trading_signals').insert(signalData);

      if (error) throw error;

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
    } catch (err: any) {
      console.error('Error creating signal:', err);
      toast.error(err.message || 'Failed to create signal');
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
