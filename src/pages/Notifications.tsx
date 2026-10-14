import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notificationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

const BROADCAST_READ_KEY = "poscal.broadcastNotifRead";

type InboxItem = {
  id: string;
  title: string;
  body: string;
  tag: string | null;
  is_read: boolean;
  created_at: string;
  is_broadcast?: boolean;
};

function readBroadcastIds(): Set<string> {
  try {
    const raw = localStorage.getItem(BROADCAST_READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeBroadcastIds(ids: Set<string>) {
  localStorage.setItem(BROADCAST_READ_KEY, JSON.stringify([...ids]));
}

const Notifications = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.getNotifications();
      const broadcastRead = readBroadcastIds();
      setItems(
        data.map((row) => {
          const isBroadcast = !row.is_read && broadcastRead.has(row.id) ? true : false;
          // Broadcasts stay pending on server; apply local read state.
          const locallyRead = broadcastRead.has(row.id);
          return {
            ...row,
            is_read: row.is_read || locallyRead,
            is_broadcast: !row.is_read && !locallyRead ? undefined : isBroadcast,
          };
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (item: InboxItem) => {
    if (item.is_read) return;
    try {
      await notificationsApi.markRead(item.id);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)),
      );
    } catch {
      // Shared broadcast rows are marked read on-device only.
      const ids = readBroadcastIds();
      ids.add(item.id);
      writeBroadcastIds(ids);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, is_read: true } : row)),
      );
    }
  };

  return (
    <div className="min-h-full bg-background pb-6">
      <PageHeader
        title="Notifications"
        subtitle="In-app alerts and announcements"
        icon={<Bell className="h-5 w-5" />}
        leading={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl space-y-3 px-6 md:max-w-3xl">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-secondary/30 p-5">
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 px-6 py-12 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground">Inbox is empty</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              App updates and alerts will appear here.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void markRead(item)}
              className={cn(
                "w-full rounded-2xl border border-border/50 px-5 py-4 text-left transition-colors",
                item.is_read ? "bg-secondary/30" : "bg-secondary/50 hover:bg-secondary/70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!item.is_read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
                    )}
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </main>
    </div>
  );
};

export default Notifications;
