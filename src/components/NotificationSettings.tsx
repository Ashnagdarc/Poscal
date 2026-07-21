import { Bell, BellOff, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { toast } from 'sonner';

interface NotificationSettingsProps {
  embedded?: boolean;
}

export const NotificationSettings = ({ embedded = false }: NotificationSettingsProps) => {
  const {
    permission,
    isSupported,
    isSubscribed,
    loading,
    lastError,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

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

  const content = !isSupported ? (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Not supported</p>
      <p className="text-xs text-muted-foreground">
        Use Chrome, Firefox, or Edge for push notifications.
      </p>
    </div>
  ) : isSubscribed ? (
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
  ) : permission === 'denied' ? (
    <div className="space-y-1">
      <p className="text-sm text-destructive">Blocked in browser settings</p>
      <p className="text-xs text-muted-foreground">
        Allow notifications via the lock icon in your address bar.
      </p>
    </div>
  ) : (
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
            <p className="font-medium text-foreground">Push notifications</p>
            <p className="text-xs text-muted-foreground">Signals and app updates</p>
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
            Push Notifications
          </CardTitle>
          <CardDescription>
            Your browser doesn't support push notifications. Try using a modern browser like Chrome, Firefox, or Edge.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get alerts for new trading signals and important app updates, even when the app is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{content}</CardContent>
    </Card>
  );
};
