import { useEffect, useState } from "react";
import { systemApi } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HealthState = {
  recent_401_count: number;
  last_401_at: string | null;
  last_flush_at: string | null;
  backend_reachable: boolean;
};

const formatTimestamp = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function AdminIngestorHealth() {
  const [health, setHealth] = useState<HealthState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await systemApi.getIngestorHealth();
      setHealth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load ingestor health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <PageHeader
        title="Ingestor Health"
        subtitle="Batch flushes and recent auth errors"
        actions={
          <Button onClick={loadHealth} disabled={loading} variant="outline">
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl px-6">
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent 401 Errors (last 5 min)</CardTitle>
            </CardHeader>
            <CardContent className="font-display text-3xl font-semibold">
              {health ? health.recent_401_count : "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last 401 At</CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              {health ? formatTimestamp(health.last_401_at) : "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last Batch Flush</CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              {health ? formatTimestamp(health.last_flush_at) : "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backend Reachable</CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              {health ? (health.backend_reachable ? "Yes" : "No") : "—"}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
