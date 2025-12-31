import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/use-notifications';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
      if (!isSupabaseConfigured) return;

      try {
        // Fetch the latest active update
        const { data, error } = await supabase
          .from('app_updates')
          .select('id, title, description, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) return;

        // Check view count from localStorage
        const viewsRaw = localStorage.getItem(STORAGE_KEY);
        const views: ViewRecord = viewsRaw ? JSON.parse(viewsRaw) : {};

        const currentViews = views[data.id] || 0;

        if (currentViews < MAX_VIEWS) {
          setUpdate(data);
          setOpen(true);

          // Increment view count
          views[data.id] = currentViews + 1;
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

  // Listen for new updates and update changes in real-time
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('app-updates-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_updates',
        },
        (payload) => {
          const newUpdate = payload.new as AppUpdate & { is_active: boolean };
          if (newUpdate.is_active) {
            // Show toast notification
            toast.info(`📢 ${newUpdate.title}`, {
              description: newUpdate.description.slice(0, 100) + (newUpdate.description.length > 100 ? '...' : ''),
              duration: 5000
            });
            
            // Send push notification
            if (permission === 'granted') {
              sendNotification(`📢 App Update: ${newUpdate.title}`, {
                body: newUpdate.description.slice(0, 100) + (newUpdate.description.length > 100 ? '...' : '')
              });
            }

            // Reset view count for this new update and show modal
            const viewsRaw = localStorage.getItem(STORAGE_KEY);
            const views: ViewRecord = viewsRaw ? JSON.parse(viewsRaw) : {};
            views[newUpdate.id] = 1;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
            
            setUpdate(newUpdate);
            setOpen(true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'app_updates',
        },
        (payload) => {
          // If the deleted update is the one being shown, close the modal
          if (update && payload.old && (payload.old as any).id === update.id) {
            setOpen(false);
            setUpdate(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_updates',
        },
        (payload) => {
          // If update is deactivated, close the modal
          if (update && payload.new && (payload.new as any).id === update.id) {
            if (!(payload.new as any).is_active) {
              setOpen(false);
              setUpdate(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [update, permission, sendNotification]);

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
