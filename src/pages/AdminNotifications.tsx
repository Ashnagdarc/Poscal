import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdmin } from "@/hooks/use-admin";
import { notificationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type QueueRow = {
  id: string;
  user_id: string | null;
  channel: string;
  title: string;
  body: string;
  status: string;
  tag: string | null;
  attempts: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_FILTERS = ["all", "pending", "processing", "sent", "failed"] as const;
const CHANNEL_FILTERS = ["all", "push", "email", "in_app"] as const;

const AdminNotifications = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [channel, setChannel] = useState<(typeof CHANNEL_FILTERS)[number]>("all");

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/settings");
  }, [isAdmin, adminLoading, navigate]);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await notificationsApi.listQueue({
        status: status === "all" ? undefined : status,
        channel: channel === "all" ? undefined : channel,
        limit: 100,
      });
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // Reload when filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, status, channel]);

  if (adminLoading || !isAdmin) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background pb-6">
      <PageHeader
        title="Notification queue"
        subtitle="Push, email, and in-app jobs"
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
        actions={
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => void load(true)}
            disabled={refreshing}
            aria-label="Refresh queue"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl space-y-4 px-6 md:max-w-3xl">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? "default" : "outline"}
              className="rounded-lg capitalize"
              onClick={() => setStatus(value)}
            >
              {value}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={channel === value ? "default" : "outline"}
              className="rounded-lg"
              onClick={() => setChannel(value)}
            >
              {value === "in_app" ? "In-app" : value === "all" ? "All channels" : value}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-secondary/30 p-5">
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 px-6 py-12 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground">Queue is empty</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-border/50 bg-secondary/40 px-5 py-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-[10px] uppercase">
                    {row.channel}
                  </Badge>
                  <Badge
                    variant={row.status === "failed" ? "destructive" : "secondary"}
                    className="rounded-full text-[10px] uppercase"
                  >
                    {row.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground">{row.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{row.body}</p>
                <p className="mt-2 text-xs text-muted-foreground/80">
                  Attempts {row.attempts}
                  {row.user_id ? ` · User ${row.user_id}` : " · Broadcast"}
                </p>
                {row.error_message && (
                  <p className="mt-2 text-xs text-destructive">{row.error_message}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminNotifications;
