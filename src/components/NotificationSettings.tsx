import { Bell, BellOff, BellRing, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { toast } from 'sonner';

export const NotificationSettings = () => {
  const { 
    permission, 
    isSupported, 
    isSubscribed, 
    loading, 
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  const handleEnableNotifications = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Push notifications enabled! You will receive alerts even when the app is closed.');
    } else if (permission === 'denied') {
      toast.error('Notification permission denied. Please enable in browser settings.');
    } else {
      toast.error('Failed to enable push notifications. Please try again.');
    }
  };

  const handleDisableNotifications = async () => {
    const success = await unsubscribe();
    if (success) {
      toast.success('Push notifications disabled.');
    }
  };

  const handleTestNotification = () => {
    // For testing, we just show a local notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Test Signal Alert 📊', {
        body: 'EUR/USD - TP1 Hit! Take Profit 1 reached.',
        icon: '/pwa-192x192.png',
        badge: '/favicon.png',
      });
      toast.success('Test notification sent!');
    }
  };

  if (!isSupported) {
    return (
      <Card className="bg-secondary border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="w-4 h-4 text-muted-foreground" />
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
    <Card className="bg-secondary border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get alerts for new trading signals and app updates, even when the app is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isSubscribed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Check className="w-4 h-4" />
              <span>Push notifications are enabled</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestNotification}
                className="flex-1"
              >
                <BellRing className="w-4 h-4 mr-2" />
                Test
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisableNotifications}
                disabled={loading}
                className="flex-1 text-muted-foreground"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disable'}
              </Button>
            </div>
          </div>
        ) : permission === 'denied' ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Notifications are blocked. Please enable them in your browser settings.
            </p>
            <p className="text-xs text-muted-foreground">
              Look for the lock/info icon in your browser's address bar and allow notifications.
            </p>
          </div>
        ) : (
          <Button
            onClick={handleEnableNotifications}
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Bell className="w-4 h-4 mr-2" />
            )}
            Enable Push Notifications
          </Button>
        )}
      </CardContent>
    </Card>
  );
};