import { useEffect, useState } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { signalsApi } from '@/lib/api';
import { FEATURED_CURRENCY_PAIRS } from './CurrencyGrid';

type SignalOrderType = 'buy' | 'sell' | 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';
type SignalStatus = 'active' | 'hit_tp' | 'hit_sl' | 'cancelled';

const ORDER_TYPES: Array<{ value: SignalOrderType; label: string }> = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'buy_limit', label: 'Buy Limit' },
  { value: 'sell_limit', label: 'Sell Limit' },
  { value: 'buy_stop', label: 'Buy Stop' },
  { value: 'sell_stop', label: 'Sell Stop' },
];

const STATUSES: Array<{ value: SignalStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'hit_tp', label: 'Hit TP' },
  { value: 'hit_sl', label: 'Hit SL' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface UpdateSignalModalProps {
  signalId: string;
  symbol: string;
  orderType: SignalOrderType;
  status: SignalStatus;
  entryPrice: number | string;
  stopLoss: number | string;
  takeProfit1: number | string;
  onSignalUpdated: () => void;
}

const toStringValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return '';
  return String(value);
};

const toOptionalNumber = (value: string) => {
  if (!value.trim()) return null;
  return Number.parseFloat(value);
};

const getSignalFormErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Failed to update signal';
  if (error.message.includes('ArgumentValidationError')) {
    return 'Could not save signal changes. Check the symbol, order type, stop loss, and take profit.';
  }
  return error.message;
};

export const UpdateSignalModal = ({
  signalId,
  symbol,
  orderType,
  status: currentStatus,
  entryPrice,
  stopLoss,
  takeProfit1,
  onSignalUpdated,
}: UpdateSignalModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    currency_pair: symbol,
    order_type: orderType,
    status: currentStatus,
    entry_price: toStringValue(entryPrice),
    stop_loss: toStringValue(stopLoss),
    take_profit_1: toStringValue(takeProfit1),
  });

  useEffect(() => {
    if (!open) return;
    setFormData({
      currency_pair: symbol,
      order_type: orderType,
      status: currentStatus,
      entry_price: toStringValue(entryPrice),
      stop_loss: toStringValue(stopLoss),
      take_profit_1: toStringValue(takeProfit1),
    });
    setShowDeleteConfirm(false);
  }, [currentStatus, entryPrice, open, orderType, stopLoss, symbol, takeProfit1]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signalsApi.update(signalId, {
        currency_pair: formData.currency_pair.trim().toUpperCase(),
        order_type: formData.order_type,
        status: formData.status,
        entry_price: toOptionalNumber(formData.entry_price),
        stop_loss: Number.parseFloat(formData.stop_loss),
        take_profit_1: Number.parseFloat(formData.take_profit_1),
        take_profit_2: null,
        take_profit_3: null,
        notes: null,
        trading_view_url: null,
      });

      toast.success('Signal updated');
      setOpen(false);
      onSignalUpdated();
    } catch (error) {
      logger.error('Error updating signal:', error);
      toast.error(getSignalFormErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSignal = async () => {
    setDeleteLoading(true);
    try {
      await signalsApi.delete(signalId);
      toast.success('Signal deleted');
      setOpen(false);
      onSignalUpdated();
    } catch (error) {
      logger.error('Error deleting signal:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete signal');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-3 text-xs">
          <Edit2 className="w-3 h-3 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Signal</DialogTitle>
          <DialogDescription>
            Update the setup details or signal status.
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

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as SignalStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="flex flex-col gap-3 pt-2">
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
                <p className="text-sm text-red-400 font-medium">Delete this signal?</p>
                <p className="text-xs text-muted-foreground">
                  This removes the signal from the feed. It does not touch the journal.
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
                    {deleteLoading ? 'Deleting...' : 'Delete'}
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
