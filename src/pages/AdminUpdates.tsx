import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Megaphone,
  Calendar,
  Bell,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/PageHeader';
import { logger } from '@/lib/logger';
import { useAdmin } from '@/hooks/use-admin';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { featureFlagApi, appUpdatesApi, notificationsApi } from '@/lib/api';

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
    try {
      const data = await appUpdatesApi.getAll();
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
      const enabled = await featureFlagApi.getPaidLock();
      setPaidLockEnabled(!!enabled);
    } catch (err) {
      console.error('fetchPaidLock error', err);
    }
  };

  const togglePaidLock = async () => {
    try {
      const desiredState = !(paidLockEnabled ?? false);
      const updatedState = await featureFlagApi.setPaidLock(desiredState);
      setPaidLockEnabled(!!updatedState);
      toast.success(updatedState ? 'Paid lock enabled' : 'Paid lock disabled');
    } catch (err: unknown) {
      console.error('togglePaidLock error', err);
      toast.error(err instanceof Error ? err.message : 'Failed to toggle paid lock');
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
      await appUpdatesApi.create({
        title: formData.title.trim(),
        description: formData.description.trim(),
      });

      try {
        logger.log('📤 Queuing push notification...');
        await notificationsApi.queueNotification({
          title: `📢 App Update: ${formData.title.trim()}`,
          body: formData.description.trim().slice(0, 100) + (formData.description.length > 100 ? '...' : ''),
          tag: 'app-update',
          data: { type: 'update' },
        });
        logger.log('✅ Push notification queued successfully');
      } catch (pushError) {
        logger.error('❌ Exception sending push notification:', pushError);
        toast.error('Push notification error: ' + (pushError as Error).message);
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
      await appUpdatesApi.delete(id);
      toast.success('Update deleted');
      setUpdates(updates.filter((u) => u.id !== id));
    } catch (error) {
      logger.error('Error deleting update:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete update');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      toast.info('Toggle active not yet implemented in backend');
      fetchUpdates();
    } catch (error) {
      logger.error('Error toggling update:', error);
      toast.error('Failed to update status');
    }
  };

  const stats = useMemo(() => {
    const activeCount = updates.filter((u) => u.is_active).length;
    const latest = updates[0]?.created_at ?? null;
    return { total: updates.length, activeCount, latest };
  }, [updates]);

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader
        title="App Updates"
        subtitle="Broadcast changes to all users"
        icon={<Megaphone className="h-5 w-5" />}
        leading={
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} aria-label="Back to settings">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl space-y-6 px-6 md:max-w-3xl">
        {/* Admin control */}
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-secondary/50">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/10">
                <Lock className="h-4.5 w-4.5 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">Paid features lock</p>
                <p className="text-xs text-muted-foreground">
                  Restrict premium pages for non-subscribers
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant={paidLockEnabled ? 'default' : 'outline'}
              onClick={togglePaidLock}
              className="shrink-0 rounded-xl"
            >
              {paidLockEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          <StatPill label="Total" value={loading ? '—' : String(stats.total)} />
          <StatPill label="Active" value={loading ? '—' : String(stats.activeCount)} accent />
          <StatPill
            label="Latest"
            value={
              loading || !stats.latest
                ? '—'
                : formatDistanceToNow(new Date(stats.latest), { addSuffix: true })
            }
            small
          />
        </section>

        {/* Updates section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Posted updates
            </h2>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-xl">
                  <Plus className="h-4 w-4" />
                  New update
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create app update</DialogTitle>
                  <DialogDescription>
                    Users will see this in-app and receive a push notification.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <Label htmlFor="update-title">Title</Label>
                    <Input
                      id="update-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. New Feature: Dark Mode"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="update-description">Description</Label>
                    <Textarea
                      id="update-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what's new or what has changed..."
                      rows={5}
                      required
                    />
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
                    <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>A push notification will be sent to all subscribed devices.</span>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 rounded-xl" disabled={submitting}>
                      {submitting ? 'Posting…' : 'Post update'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border/50 bg-secondary/30 p-5">
                  <Skeleton className="mb-3 h-5 w-40" />
                  <Skeleton className="mb-2 h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : updates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10">
                <Sparkles className="h-7 w-7 text-brand" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No updates yet</h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                Post your first update to notify users about new features, fixes, or announcements.
              </p>
              <Button className="mt-5 gap-2 rounded-xl" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create first update
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((update) => (
                <article
                  key={update.id}
                  className={`overflow-hidden rounded-2xl border border-border/50 bg-secondary/40 transition-opacity ${
                    !update.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{update.title}</h3>
                          <Badge
                            variant={update.is_active ? 'default' : 'secondary'}
                            className="rounded-full text-[10px] uppercase tracking-wide"
                          >
                            {update.is_active ? 'Live' : 'Hidden'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <time dateTime={update.created_at}>
                            {format(new Date(update.created_at), 'MMM d, yyyy · h:mm a')}
                          </time>
                          <span className="text-muted-foreground/50">·</span>
                          <span>{formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs"
                          onClick={() => toggleActive(update.id, update.is_active)}
                        >
                          {update.is_active ? 'Hide' : 'Show'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(update.id)}
                          aria-label="Delete update"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {update.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

function StatPill({
  label,
  value,
  accent = false,
  small = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/40 px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-display font-semibold text-foreground ${
          small ? 'text-sm' : 'text-xl'
        } ${accent ? 'text-brand' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}

export default AdminUpdates;
