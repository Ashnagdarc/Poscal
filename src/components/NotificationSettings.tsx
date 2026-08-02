import { useEffect, useState } from 'react';
import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { newsApi, preferencesApi } from '@/lib/api';
import { toast } from 'sonner';

interface NotificationSettingsProps {
  embedded?: boolean;
}

export const NotificationSettings = ({ embedded = false }: NotificationSettingsProps) => {
  const { user } = useAuth();
  const {
    permission,
    isSupported,
    isSubscribed,
    loading,
    lastError,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  const [newsAlertsEnabled, setNewsAlertsEnabled] = useState(true);
  const [newsAlertsLoading, setNewsAlertsLoading] = useState(false);
  const [riskAlertsEnabled, setRiskAlertsEnabled] = useState(true);
  const [milestoneAlertsEnabled, setMilestoneAlertsEnabled] = useState(true);
  const [tradingAlertsLoading, setTradingAlertsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const [newsEnabled, prefs] = await Promise.all([
          newsApi.getNewsAlertsEnabled(),
          preferencesApi.get(),
        ]);
        if (!mounted) return;
        setNewsAlertsEnabled(newsEnabled);
        if (prefs) {
          setRiskAlertsEnabled(prefs.trading_risk_alerts_enabled);
          setMilestoneAlertsEnabled(prefs.trading_milestone_alerts_enabled);
        }
      } catch {
        // Defaults on
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleEnableNotifications = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Push notifications enabled! You will receive alerts even when the app is closed.');
    } else if (permission === 'denied') {
      toast.error('Notification permission denied. Please enable in browser settings.');
    } else {
      toast.error(lastError ? `Failed to enable push: ${lastError}` : 'Failed to enable push notifications. Please try again.');
    }
  };

  const handleDisableNotifications = async () => {
    const success = await unsubscribe();
    if (success) {
      toast.success('Push notifications disabled.');
    }
  };

  const handleNewsAlertsToggle = async (enabled: boolean) => {
    setNewsAlertsLoading(true);
    setNewsAlertsEnabled(enabled);
    try {
      await newsApi.setNewsAlertsEnabled(enabled);
      toast.success(enabled ? 'Calendar alerts on' : 'Calendar alerts off');
    } catch {
      setNewsAlertsEnabled(!enabled);
      toast.error('Could not update calendar alert preference');
    } finally {
      setNewsAlertsLoading(false);
    }
  };

  const handleRiskAlertsToggle = async (enabled: boolean) => {
    setTradingAlertsLoading(true);
    setRiskAlertsEnabled(enabled);
    try {
      await preferencesApi.update({ tradingRiskAlertsEnabled: enabled });
      toast.success(enabled ? 'Risk warnings on' : 'Risk warnings off');
    } catch {
      setRiskAlertsEnabled(!enabled);
      toast.error('Could not update risk alert preference');
    } finally {
      setTradingAlertsLoading(false);
    }
  };

  const handleMilestoneAlertsToggle = async (enabled: boolean) => {
    setTradingAlertsLoading(true);
    setMilestoneAlertsEnabled(enabled);
    try {
      await preferencesApi.update({ tradingMilestoneAlertsEnabled: enabled });
      toast.success(enabled ? 'Milestone alerts on' : 'Milestone alerts off');
    } catch {
      setMilestoneAlertsEnabled(!enabled);
      toast.error('Could not update milestone alert preference');
    } finally {
      setTradingAlertsLoading(false);
    }
  };

  const newsToggle = user ? (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-foreground">Calendar alerts</p>
        <p className="text-[11px] text-muted-foreground">
          {isSubscribed
            ? "High-impact economic events only"
            : "Enable push notifications first to turn calendar alerts on"}
        </p>
      </div>
      <Switch
        checked={isSubscribed && newsAlertsEnabled}
        disabled={newsAlertsLoading || !isSubscribed}
        onCheckedChange={(checked) => void handleNewsAlertsToggle(checked)}
        aria-label="Toggle calendar alerts"
      />
    </div>
  ) : null;

  const tradingToggles = user ? (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">Risk warnings</p>
          <p className="text-[11px] text-muted-foreground">
            Alert when a trade’s risk % exceeds your default
          </p>
        </div>
        <Switch
          checked={riskAlertsEnabled}
          disabled={tradingAlertsLoading}
          onCheckedChange={(checked) => void handleRiskAlertsToggle(checked)}
          aria-label="Toggle risk warnings"
        />
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-foreground">Milestone alerts</p>
          <p className="text-[11px] text-muted-foreground">
            Trade-count and equity % milestones (in-app toast + push/email when enabled)
          </p>
        </div>
        <Switch
          checked={milestoneAlertsEnabled}
          disabled={tradingAlertsLoading}
          onCheckedChange={(checked) => void handleMilestoneAlertsToggle(checked)}
          aria-label="Toggle milestone alerts"
        />
      </div>
    </div>
  ) : null;

  const content = !isSupported ? (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Not supported</p>
      <p className="text-xs text-muted-foreground">
        Use Chrome, Firefox, or Edge for push notifications.
      </p>
      {tradingToggles}
    </div>
  ) : isSubscribed ? (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <span>Enabled</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisableNotifications}
          disabled={loading}
          className="h-8 rounded-lg text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Disable'}
        </Button>
      </div>
      {newsToggle}
      {tradingToggles}
    </div>
  ) : permission === 'denied' ? (
    <div className="space-y-1">
      <p className="text-sm text-destructive">Blocked in browser settings</p>
      <p className="text-xs text-muted-foreground">
        Allow notifications via the lock icon in your address bar.
      </p>
      {tradingToggles}
    </div>
  ) : (
    <div>
      <Button
        onClick={handleEnableNotifications}
        size="sm"
        className="h-9 rounded-xl"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Bell className="mr-2 h-4 w-4" />
        )}
        Enable notifications
      </Button>
      {newsToggle}
      {tradingToggles}
    </div>
  );

  if (embedded) {
    return (
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          {!isSupported ? (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4 text-foreground" />
          )}
          <div>
            <p className="font-medium text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              Calendar, risk warnings, and account milestones
            </p>
          </div>
        </div>
        {content}
      </div>
    );
  }

  if (!isSupported) {
    return (
      <Card className="border-border bg-secondary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            Notifications
          </CardTitle>
          <CardDescription>
            Your browser doesn't support push notifications. Trading alert preferences still apply to in-app toasts.
          </CardDescription>
        </CardHeader>
        <CardContent>{tradingToggles}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
        <CardDescription>
          Calendar events, risk warnings when trades exceed your default risk %, and equity / trade-count milestones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{content}</CardContent>
    </Card>
  );
};
