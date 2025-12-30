import { Bell, BellOff, BellRing, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotifications } from '@/hooks/use-notifications';
import { toast } from 'sonner';

export const NotificationSettings = () => {
  const { permission, isSupported, requestPermission, sendNotification } = useNotifications();

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast.success('Push notifications enabled!');
      // Send a test notification
      sendNotification('Notifications Enabled! 🎉', {
        body: 'You will now receive alerts for trading signals.',
      });
    } else {
      toast.error('Notification permission denied. Please enable in browser settings.');
    }
  };

  const handleTestNotification = () => {
    sendNotification('Test Signal Alert 📊', {
      body: 'EUR/USD - TP1 Hit! Take Profit 1 reached.',
    });
    toast.success('Test notification sent!');
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
            Your browser doesn't support push notifications.
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
          Get alerts when signals hit TP or SL levels, even when the app is in background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {permission === 'granted' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Check className="w-4 h-4" />
              <span>Notifications are enabled</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNotification}
              className="w-full"
            >
              <BellRing className="w-4 h-4 mr-2" />
              Send Test Notification
            </Button>
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
          >
            <Bell className="w-4 h-4 mr-2" />
            Enable Push Notifications
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
