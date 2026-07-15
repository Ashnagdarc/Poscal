import { ReactNode, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { SignalFormSchema } from '@/lib/formValidation';
import { notificationsApi, signalsApi } from '@/lib/api';
import { FEATURED_CURRENCY_PAIRS } from './CurrencyGrid';

type SignalOrderType = 'buy' | 'sell' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';

const ORDER_TYPES: Array<{ value: SignalOrderType; label: string }> = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'buy_limit', label: 'Buy Limit' },
  { value: 'sell_limit', label: 'Sell Limit' },
  { value: 'buy_stop', label: 'Buy Stop' },
  { value: 'sell_stop', label: 'Sell Stop' },
];

interface CreateSignalModalProps {
  onSignalCreated: () => void;
  trigger?: ReactNode;
}

const initialFormData = {
  currency_pair: '',
  order_type: 'buy' as SignalOrderType,
  entry_price: '',
  stop_loss: '',
  take_profit_1: '',
};

const normalizeSymbol = (value: string) => value.trim().toUpperCase();

const toNumber = (value: string) => Number.parseFloat(value);

const orderTypeLabel = (value: SignalOrderType) =>
  ORDER_TYPES.find((type) => type.value === value)?.label ?? value;

const getSignalFormErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Failed to create signal';
  if (error.message.includes('ArgumentValidationError')) {
    return 'Could not create signal. Check the symbol, order type, stop loss, and take profit.';
  }
  return error.message;
};

export const CreateSignalModal = ({ onSignalCreated, trigger }: CreateSignalModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedForm = {
        ...formData,
        currency_pair: normalizeSymbol(formData.currency_pair),
      };
      const validation = SignalFormSchema.safeParse(normalizedForm);
      if (!validation.success) {
        toast.error(validation.error.errors[0]?.message ?? 'Invalid signal');
        setLoading(false);
        return;
      }

      const signalData = {
        currency_pair: normalizedForm.currency_pair,
        order_type: normalizedForm.order_type,
        entry_price: normalizedForm.entry_price ? toNumber(normalizedForm.entry_price) : null,
        stop_loss: toNumber(normalizedForm.stop_loss),
        take_profit_1: toNumber(normalizedForm.take_profit_1),
        take_profit_2: null,
        take_profit_3: null,
        trading_view_url: null,
        notes: null,
        status: 'active',
      };

      const createdSignal = await signalsApi.create(signalData);

      try {
        await notificationsApi.queueNotification({
          title: `New Signal: ${signalData.currency_pair}`,
          body: `${orderTypeLabel(signalData.order_type)} | SL ${signalData.stop_loss} | TP ${signalData.take_profit_1}`,
          tag: `signal-${createdSignal?.id ?? Date.now()}`,
          data: {
            type: 'signal',
            signalId: createdSignal?.id ?? null,
            path: '/signals',
          },
        });
      } catch (pushError) {
        logger.warn('Signal created, but push notification queueing failed:', pushError);
      }

      toast.success('Signal created successfully');
      setOpen(false);
      setFormData(initialFormData);
      onSignalCreated();
    } catch (error) {
      logger.error('Error creating signal:', error);
      toast.error(getSignalFormErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="icon"
            className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 h-14 w-14 rounded-full shadow-lg z-40"
            aria-label="Create signal"
          >
            <Plus className="w-6 h-6" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Create Signal</DialogTitle>
          <DialogDescription>
            Post a trade setup for users to apply in their calculator.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Select
                value={formData.currency_pair}
                onValueChange={(value) => setFormData({ ...formData, currency_pair: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select pair" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {FEATURED_CURRENCY_PAIRS.map((pair) => (
                    <SelectItem key={pair.symbol} value={pair.symbol}>
                      {pair.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Order Type</Label>
              <Select
                value={formData.order_type}
                onValueChange={(value) => setFormData({ ...formData, order_type: value as SignalOrderType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entry</Label>
              <Input
                type="number"
                step="any"
                value={formData.entry_price}
                onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                placeholder="Optional"
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

          <div className="space-y-2">
            <Label>Take Profit</Label>
            <Input
              type="number"
              step="any"
              value={formData.take_profit_1}
              onChange={(e) => setFormData({ ...formData, take_profit_1: e.target.value })}
              required
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
