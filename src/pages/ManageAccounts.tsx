import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, AlertTriangle, Wallet, Plus, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { BottomNav } from '@/components/BottomNav';
import { TradingAccountModal } from '@/components/TradingAccountModal';
import { AccountPerformanceDashboard } from '@/components/AccountPerformanceDashboard';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tables } from '@/types/database.types';
import { logger } from '@/lib/logger';
import { accountsApi, signalsApi, notificationsApi } from '@/lib/api';
import { supabase, isSupabaseConfigured } from '@/lib/supabase-shim';

type TradingAccount = Tables<'trading_accounts'>;

interface AccountWithTrades extends TradingAccount {
  activeTradesCount?: number;
}

export const ManageAccounts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountWithTrades[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; account: AccountWithTrades | null }>({
    isOpen: false,
    account: null,
  });
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch accounts from new API
      const accountsData = await accountsApi.getAll();

      // Fetch active trades from signalsApi (taken trades)
      const takenTrades = await signalsApi.getUserTakenTrades();

      // Count active trades per account
      const accountsWithTrades: AccountWithTrades[] = accountsData.map(account => ({
        ...account,
        activeTradesCount: takenTrades.filter(
          (trade: any) => trade.account_id === account.id && trade.status === 'open'
        ).length,
      }));

      setAccounts(accountsWithTrades);
    } catch (error) {
      logger.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleEditAccount = (account: TradingAccount) => {
    setEditingAccount(account);
    setShowAccountModal(true);
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm.account) return;

    const account = deleteConfirm.account;

    // Check if account has active trades
    if (account.activeTradesCount && account.activeTradesCount > 0) {
      toast.error(`Cannot delete account with ${account.activeTradesCount} active trade(s). Close all trades first.`);
      setDeleteConfirm({ isOpen: false, account: null });
      return;
    }

    try {
      await accountsApi.delete(account.id);

      // Queue notification for account deletion
      await notificationsApi.queueNotification({
        user_id: user!.id,
        title: `🗑️ Account Deleted: ${account.account_name}`,
        body: `Your ${account.platform} trading account has been deleted`,
        tag: 'account-deleted',
        data: { type: 'account_deleted', account_name: account.account_name },
      });

      toast.success('Trading account deleted');
      fetchAccounts();
    } catch (error) {
      logger.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setDeleteConfirm({ isOpen: false, account: null });
    }
  };

  const handleToggleActive = async (account: TradingAccount) => {
    try {
      const newStatus = !account.is_active;
      await accountsApi.update(account.id, { is_active: newStatus });

      // Queue notification for account status change
      await notificationsApi.queueNotification({
        user_id: user!.id,
        title: newStatus ? `✅ Account Active: ${account.account_name}` : `⏸️ Account Inactive: ${account.account_name}`,
        body: `Your ${account.platform} account is now ${newStatus ? 'active' : 'inactive'}`,
        tag: 'account-status-changed',
        data: { type: 'account_status_changed', is_active: newStatus },
      });

      toast.success(account.is_active ? 'Account deactivated' : 'Account activated');
      fetchAccounts();
    } catch (error) {
      logger.error('Error toggling account status:', error);
      toast.error('Failed to update account');
    }
  };

  const getPnL = (account: TradingAccount) => {
    const pnl = account.current_balance - account.initial_balance;
    const pnlPercent = (pnl / account.initial_balance) * 100;
    return { pnl, pnlPercent };
  };

  const toggleAccountExpanded = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-6 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trading Accounts</h1>
            <p className="text-sm text-muted-foreground">Manage your trading accounts</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditingAccount(null);
            setShowAccountModal(true);
          }}
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </header>

      {/* Accounts List */}
      <main className="flex-1 px-6 space-y-4 animate-slide-up overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-secondary rounded-2xl p-8 text-center">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Trading Accounts</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first trading account to start taking signals and tracking your trades.
            </p>
            <Button
              onClick={() => {
                setEditingAccount(null);
                setShowAccountModal(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First Account
            </Button>
          </div>
        ) : (
          <>
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <span className="font-semibold text-foreground">Portfolio Summary</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-background/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total Accounts</p>
                  <p className="text-lg font-bold text-foreground">{accounts.length}</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total Balance</p>
                  <p className="text-lg font-bold text-foreground">
                    ${accounts.reduce((sum, acc) => sum + acc.current_balance, 0).toLocaleString(undefined, { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </p>
                </div>
                <div className="bg-background/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Active</p>
                  <p className="text-lg font-bold text-foreground">
                    {accounts.filter(a => a.is_active).length}
                  </p>
                </div>
              </div>
            </div>

            {/* Accounts */}
            {accounts.map((account) => {
              const { pnl, pnlPercent } = getPnL(account);
              const hasActiveTrades = (account.activeTradesCount || 0) > 0;

              return (
                <div
                  key={account.id}
                  className="bg-secondary rounded-2xl p-4 border border-border/50"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{account.account_name}</h3>
                        {!account.is_active && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.platform}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditAccount(account)}
                        className="h-8 w-8"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm({ isOpen: true, account })}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={hasActiveTrades}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Balance Info */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-background/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                      <p className="text-sm font-bold text-foreground">
                        {account.currency} {account.current_balance.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className={`rounded-lg p-3 ${pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <p className="text-xs text-muted-foreground mb-1">P&L</p>
                      <p className={`text-sm font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  {/* Active Trades Warning */}
                  {hasActiveTrades && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-amber-500">
                        <p className="font-semibold">
                          {account.activeTradesCount} active trade{account.activeTradesCount !== 1 ? 's' : ''}
                        </p>
                        <p className="opacity-80">Close all trades before deleting this account</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mb-3">
                    <Button
                      variant={account.is_active ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleActive(account)}
                      className="flex-1"
                    >
                      {account.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Collapsible open={expandedAccounts.has(account.id)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleAccountExpanded(account.id)}
                          className="flex-1 gap-1"
                        >
                          Analytics
                          {expandedAccounts.has(account.id) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </Collapsible>
                  </div>

                  {/* Performance Dashboard */}
                  <Collapsible open={expandedAccounts.has(account.id)}>
                    <CollapsibleContent className="pt-2 border-t border-border/30">
                      <AccountPerformanceDashboard account={account} />
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
          </>
        )}
      </main>

      {/* Trading Account Modal */}
      <TradingAccountModal
        open={showAccountModal}
        onOpenChange={(open) => {
          setShowAccountModal(open);
          if (!open) setEditingAccount(null);
        }}
        onAccountCreated={fetchAccounts}
        editingAccount={editingAccount}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, account: null })}
        onConfirm={handleDeleteAccount}
        title="Delete Trading Account"
        description={`Are you sure you want to delete "${deleteConfirm.account?.account_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
      />

      <BottomNav />
    </div>
  );
};

export default ManageAccounts;
