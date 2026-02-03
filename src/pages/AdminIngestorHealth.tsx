import { useEffect, useState } from "react";
import { systemApi } from "@/lib/api";
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
    } catch (err: any) {
      setError(err?.message || "Failed to load ingestor health");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Price Ingestor Health</h1>
            <p className="text-sm text-slate-400 mt-1">
              Monitor batch flushes and recent 401s from the ingestor.
            </p>
          </div>
          <Button onClick={loadHealth} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error && (
          <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Recent 401 Errors (last 5 min)</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {health ? health.recent_401_count : "—"}
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Last 401 At</CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              {health ? formatTimestamp(health.last_401_at) : "—"}
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Last Batch Flush</CardTitle>
            </CardHeader>
            <CardContent className="text-lg">
              {health ? formatTimestamp(health.last_flush_at) : "—"}
            </CardContent>
          </Card>
          <Card className="bg-slate-900/60 border-slate-800">
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
