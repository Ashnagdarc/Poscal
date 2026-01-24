import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Plus, Edit } from 'lucide-react';
import { Tables } from '@/types/database.types';
import { AccountFormSchema } from '@/lib/formValidation';
import { supabase } from '@/lib/supabase-shim';

type TradingAccount = Tables<'trading_accounts'>;

interface TradingAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: () => void;
  editingAccount?: TradingAccount | null;
}

const PLATFORMS = ['MT4', 'MT5', 'cTrader', 'TradingView', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

export const TradingAccountModal = ({ open, onOpenChange, onAccountCreated, editingAccount }: TradingAccountModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [platform, setPlatform] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('USD');

  // Populate form when editing
  useEffect(() => {
    if (editingAccount) {
      setAccountName(editingAccount.account_name);
      setPlatform(editingAccount.platform);
      setBalance(editingAccount.initial_balance.toString());
      setCurrency(editingAccount.currency);
    } else {
      // Reset form when creating new
      setAccountName('');
      setPlatform('');
      setBalance('');
      setCurrency('USD');
    }
  }, [editingAccount, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    // Validate with Zod schema
    const validation = AccountFormSchema.safeParse({
      account_name: accountName,
      platform,
      initial_balance: balance,
      currency,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    const balanceNum = parseFloat(balance);

    setLoading(true);

    try {
      if (editingAccount) {
        // Update existing account
        const { error } = await supabase
          .from('trading_accounts')
          .update({
            account_name: accountName.trim(),
            platform,
            currency,
            // Update initial_balance and adjust current_balance proportionally
            initial_balance: balanceNum,
            current_balance: editingAccount.current_balance + (balanceNum - editingAccount.initial_balance),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAccount.id)
          .eq('user_id', user.id);

        if (error) throw error;

        // Queue notification for account update
        await supabase.rpc('queue_user_push_notification', {
          p_user_id: user.id,
          p_title: `✏️ Account Updated: ${accountName.trim()}`,
          p_body: `Your ${platform} account has been updated`,
          p_tag: 'account-updated',
          p_data: { type: 'account_updated', account_id: editingAccount.id },
        });

        toast.success('Trading account updated successfully!');
      } else {
        // Create new account
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

        // Queue notification for new account
        await supabase.rpc('queue_user_push_notification', {
          p_user_id: user.id,
          p_title: `💼 New Trading Account: ${accountName.trim()}`,
          p_body: `${platform} account with ${balanceNum} ${currency} created`,
          p_tag: 'account-created',
          p_data: { type: 'account_created', platform, currency },
        });

        toast.success('Trading account created successfully!');
      }

      onAccountCreated();
      onOpenChange(false);
      
      // Reset form
      setAccountName('');
      setPlatform('');
      setBalance('');
      setCurrency('USD');
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${editingAccount ? 'update' : 'create'} account`;
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingAccount ? (
              <>
                <Edit className="w-5 h-5" />
                Edit Trading Account
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Add Trading Account
              </>
            )}
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
              autoFocus={!editingAccount}
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
              <Label htmlFor="balance">
                {editingAccount ? 'Initial Balance *' : 'Account Balance *'}
              </Label>
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
              {editingAccount && (
                <p className="text-xs text-muted-foreground">
                  Current: {editingAccount.currency} {editingAccount.current_balance.toFixed(2)}
                </p>
              )}
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
                {editingAccount ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              editingAccount ? 'Update Account' : 'Create Account'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
