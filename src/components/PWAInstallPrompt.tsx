import { useState, useEffect } from 'react';
import { Download, Plus, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePWAInstall } from '@/hooks/use-pwa-install';

const PROMPT_DISMISSED_KEY = 'pwa-install-dismissed';
const PROMPT_SHOWN_COUNT_KEY = 'pwa-install-shown-count';
const MAX_PROMPT_COUNT = 3;

export const PWAInstallPrompt = () => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const iOS =
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iOS);

    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (standalone || isInstalled) {
      setVisible(false);
      setInstructionsOpen(false);
      return;
    }

    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed === 'true') return;

    const shownCount = parseInt(localStorage.getItem(PROMPT_SHOWN_COUNT_KEY) || '0', 10);
    if (shownCount >= MAX_PROMPT_COUNT) return;

    if (!iOS && !isInstallable) return;

    const delay = shownCount === 0 ? 8000 : 4000;
    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem(PROMPT_SHOWN_COUNT_KEY, (shownCount + 1).toString());
    }, delay);

    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    if (isIOS) {
      setInstructionsOpen(true);
      return;
    }

    const installed = await promptInstall();
    if (installed) {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleNeverShowAgain = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setVisible(false);
    setInstructionsOpen(false);
  };

  if (isStandalone || isInstalled) return null;
  if (!isIOS && !isInstallable) return null;
  if (!visible && !instructionsOpen) return null;

  return (
    <>
      {visible && (
        <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 px-4 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-[0_16px_40px_-22px_rgba(0,0,0,0.75)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Install Poscal</p>
              <p className="text-xs leading-snug text-muted-foreground">Open it from your home screen.</p>
            </div>
            <Button size="sm" onClick={handleInstall} className="shrink-0">
              Install
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Install this app on your iPhone:
            </p>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  1
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  Tap <Share className="inline h-4 w-4 shrink-0" /> Share in Safari
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  2
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  Tap <Plus className="inline h-4 w-4 shrink-0" /> <strong>Add to Home Screen</strong>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  3
                </span>
                <span>
                  Tap <strong>Add</strong>
                </span>
              </li>
            </ol>
          </div>

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
    </>
  );
};
