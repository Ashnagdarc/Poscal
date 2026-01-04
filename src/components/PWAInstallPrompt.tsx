import { useState, useEffect } from 'react';
import { Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/use-pwa-install';

const PROMPT_DISMISSED_KEY = 'pwa-install-dismissed';
const PROMPT_SHOWN_COUNT_KEY = 'pwa-install-shown-count';
const MAX_PROMPT_COUNT = 3;

export const PWAInstallPrompt = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [open, setOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    // Check if app is already running in standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if we should show the prompt
    const shouldShowPrompt = () => {
      if (standalone || isInstalled) return false;

      const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
      if (dismissed === 'true') return false;

      const shownCount = parseInt(localStorage.getItem(PROMPT_SHOWN_COUNT_KEY) || '0', 10);
      if (shownCount >= MAX_PROMPT_COUNT) return false;

      // Show prompt after 5 seconds on first visit, then after 3 seconds on subsequent visits
      const delay = shownCount === 0 ? 5000 : 3000;
      
      const timer = setTimeout(() => {
        if (iOS || isInstallable) {
          setOpen(true);
          localStorage.setItem(PROMPT_SHOWN_COUNT_KEY, (shownCount + 1).toString());
        }
      }, delay);

      return () => clearTimeout(timer);
    };

    shouldShowPrompt();
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    if (isIOS) {
      // For iOS, we can't programmatically trigger install, just show instructions
      return;
    }

    // For Android/Chrome
    const installed = await promptInstall();
    if (installed) {
      setOpen(false);
    }
  };

  const handleDismiss = () => {
    setOpen(false);
  };

  const handleNeverShowAgain = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setOpen(false);
  };

  if (isStandalone || isInstalled) return null;
  if (!isIOS && !isInstallable) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Install Poscal App
          </DialogTitle>
          <DialogDescription>
            Get the best experience with our app installed on your device
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isIOS ? (
            // iOS Instructions
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Install this app on your iPhone:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    1
                  </span>
                  <span className="flex items-center gap-2">
                    Tap the <Share className="h-4 w-4 inline" /> Share button at the bottom of Safari
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    2
                  </span>
                  <span className="flex items-center gap-2">
                    Scroll and tap <Plus className="h-4 w-4 inline" /> <strong>Add to Home Screen</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                    3
                  </span>
                  <span>
                    Tap <strong>Add</strong> in the top-right corner
                  </span>
                </li>
              </ol>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>Tip:</strong> Once installed, you can access Poscal directly from your home screen like a native app!
                </p>
              </div>
            </div>
          ) : (
            // Android/Chrome Instructions
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Install Poscal for quick access and a better experience:
              </p>
              <ul className="space-y-2 text-sm list-disc list-inside text-muted-foreground">
                <li>Faster loading times</li>
                <li>Works offline</li>
                <li>Push notifications</li>
                <li>No browser clutter</li>
              </ul>
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" />
                Install App
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNeverShowAgain}
              className="text-xs text-muted-foreground"
            >
              Don't show again
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
