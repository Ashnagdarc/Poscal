import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Megaphone, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { logger } from '@/lib/logger';
import { useAdmin } from '@/hooks/use-admin';
import { BottomNav } from '@/components/BottomNav';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AppUpdate {
  id: string;
  title: string;
  description: string;
  created_at: string;
  is_active: boolean;
}

const AdminUpdates = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [paidLockEnabled, setPaidLockEnabled] = useState<boolean | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate('/');
    }
  }, [isAdmin, adminLoading, navigate]);

  const fetchUpdates = async () => {
    if (!isSupabaseConfigured) return;

    try {
      const { data, error } = await supabase
        .from('app_updates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUpdates(data || []);
    } catch (error) {
      logger.error('Error fetching updates:', error);
      toast.error('Failed to fetch updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUpdates();
      fetchPaidLock();
    }
  }, [isAdmin]);

  const fetchPaidLock = async () => {
    try {
      // Read directly from Supabase table for local/dev usage to avoid CORS to production API
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'paid_lock_enabled')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('fetchPaidLock supabase error', error);
        return;
      }

      const enabled = data?.value?.enabled === true;
      setPaidLockEnabled(!!enabled);
    } catch (err) {
      console.error('fetchPaidLock error', err);
    }
  };

  const togglePaidLock = async () => {
    try {
      // Use Supabase upsert to set the flag directly (avoids CORS during dev)
      const newVal = !paidLockEnabled;
      const payload = { key: 'paid_lock_enabled', value: { enabled: newVal } };
      const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'key' });
      if (error) throw error;
      setPaidLockEnabled(!!newVal);
      toast.success(newVal ? 'Paid lock enabled' : 'Paid lock disabled');
    } catch (err: any) {
      console.error('togglePaidLock error', err);
      toast.error(err?.message || 'Failed to toggle paid lock');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('app_updates').insert({
        title: formData.title.trim(),
        description: formData.description.trim(),
        is_active: true,
      });

      if (error) throw error;

      // Queue push notification for all subscribers
      try {
        logger.log('📤 Queuing push notification via RPC...');
        const { data: pushResult, error: pushError } = await supabase.rpc('queue_push_notification', {
          p_title: `📢 App Update: ${formData.title.trim()}`,
          p_body: formData.description.trim().slice(0, 100) + (formData.description.length > 100 ? '...' : ''),
          p_tag: 'app-update',
          p_data: { type: 'update' },
        });
        logger.log('✅ Push notification queued:', pushResult);
        if (pushError) {
          logger.error('❌ Push error:', pushError);
          toast.error('Push notification failed to queue');
        } else {
          logger.log('📨 Push sent successfully:', pushResult.data);
        }
      } catch (pushError) {
        logger.error('❌ Exception sending push notification:', pushError);
        toast.error('Push notification error: ' + (pushError as Error).message);
        // Don't fail the update creation if push fails
      }

      toast.success('Update posted successfully! Users will be notified.');
      setFormData({ title: '', description: '' });
      setCreateOpen(false);
      fetchUpdates();
    } catch (error) {
      logger.error('Error creating update:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('app_updates').delete().eq('id', id);

      if (error) throw error;

      toast.success('Update deleted');
      setUpdates(updates.filter((u) => u.id !== id));
    } catch (error) {
      logger.error('Error deleting update:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete update');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('app_updates')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(currentStatus ? 'Update deactivated' : 'Update activated');
      fetchUpdates();
    } catch (error) {
      logger.error('Error toggling update:', error);
      toast.error('Failed to update status');
    }
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-12 pb-4 px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Paid features locked:</div>
            <Button size="sm" variant={paidLockEnabled ? 'secondary' : 'outline'} onClick={togglePaidLock}>
              {paidLockEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">App Updates</h1>
              <p className="text-sm text-muted-foreground">
                Post updates for users to see
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 space-y-4">
        {/* Create Button */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2">
              <Plus className="w-4 h-4" />
              Create New Update
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create App Update</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., New Feature: Dark Mode"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what's new or what has been updated..."
                  rows={4}
                  required
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Posting...' : 'Post Update'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Updates List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 w-32 bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 w-full bg-muted rounded mb-2" />
                  <div className="h-4 w-3/4 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : updates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No updates posted yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <Card key={update.id} className={!update.is_active ? 'opacity-50' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{update.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(update.created_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={update.is_active ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => toggleActive(update.id, update.is_active)}
                      >
                        {update.is_active ? 'Active' : 'Inactive'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(update.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {update.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default AdminUpdates;
