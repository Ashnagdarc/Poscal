import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

interface TradingAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: () => void;
}

const PLATFORMS = ['MT4', 'MT5', 'cTrader', 'TradingView', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

export const TradingAccountModal = ({ open, onOpenChange, onAccountCreated }: TradingAccountModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [platform, setPlatform] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('USD');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    if (!accountName.trim() || !platform || !balance) {
      toast.error('Please fill in all required fields');
      return;
    }

    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum) || balanceNum <= 0) {
      toast.error('Please enter a valid balance');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('trading_accounts')
        .insert({
          user_id: user.id,
          account_name: accountName.trim(),
          platform,
          initial_balance: balanceNum,
          current_balance: balanceNum,
          currency,
        });

      if (error) throw error;

      toast.success('Trading account created successfully!');
      onAccountCreated();
      onOpenChange(false);
      
      // Reset form
      setAccountName('');
      setPlatform('');
      setBalance('');
      setCurrency('USD');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Trading Account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name *</Label>
            <Input
              id="accountName"
              placeholder="e.g., My MT5 Live Account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform">Trading Platform *</Label>
            <Select value={platform} onValueChange={setPlatform} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="balance">Account Balance *</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                min="0"
                placeholder="100000"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
