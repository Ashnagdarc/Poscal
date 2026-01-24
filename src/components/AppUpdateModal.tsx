import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { appUpdatesApi } from '@/lib/api';

interface AppUpdate {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

const MAX_VIEWS = 5;
const STORAGE_KEY = 'app_update_views';

interface ViewRecord {
  [updateId: string]: number;
}

export const AppUpdateModal = () => {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [open, setOpen] = useState(false);
  const { sendNotification, permission } = useNotifications();

  useEffect(() => {
    const checkForUpdates = async () => {

      try {
        // Fetch the latest active update
        const updates = await appUpdatesApi.getAll();
        const latestActive = (updates || []).find((u: any) => u.is_active) || updates?.[0];
        if (!latestActive) return;

        // Check view count from localStorage
        const viewsRaw = localStorage.getItem(STORAGE_KEY);
        const views: ViewRecord = viewsRaw ? JSON.parse(viewsRaw) : {};

        const currentViews = views[latestActive.id] || 0;

        if (currentViews < MAX_VIEWS) {
          setUpdate(data);
          setOpen(true);

          // Increment view count
          views[latestActive.id] = currentViews + 1;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
        }
      } catch (err) {
        console.error('Error checking for updates:', err);
      }
    };

    // Small delay to let the app render first
    const timer = setTimeout(checkForUpdates, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Note: Real-time updates via Supabase channels removed; rely on periodic checks or backend push

  if (!update) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-xl">{update.title}</DialogTitle>
          </div>
          <DialogDescription>
            New update available - {format(new Date(update.created_at), 'MMMM dd, yyyy')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {update.description}
          </p>
          
          <p className="text-xs text-muted-foreground">
            Posted on {format(new Date(update.created_at), 'MMMM dd, yyyy')}
          </p>
          
          <Button className="w-full" onClick={() => setOpen(false)}>
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
