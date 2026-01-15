import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';

const AdminWebhookLogs = () => {
  const navigate = useNavigate();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['webhook-logs'],
    queryFn: async () => {
      const r = await fetch(`${apiBaseUrl}/api/webhook-logs`);
      if (!r.ok) throw new Error('Failed to fetch logs');
      return r.json();
    },
  });
  const logs = data?.logs || [];
  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 bg-secondary/80 rounded-xl flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Webhook Logs</h1>
            <p className="text-sm text-muted-foreground">Recent webhook events (last 50)</p>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 animate-slide-up">
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="mb-4">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left py-2 pr-4">Time</th>
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2 pr-4">Error</th>
                <th className="text-left py-2 pr-4">Signature</th>
                <th className="text-left py-2 pr-4">Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id} className="border-t border-border/50">
                  <td className="py-2 pr-4">{log.processed_at?.replace('T', ' ').slice(0,19)}</td>
                  <td className="py-2 pr-4">{log.event_type}</td>
                  <td className="py-2 pr-4">{log.status}</td>
                  <td className="py-2 pr-4 text-red-500">{log.error || '-'}</td>
                  <td className="py-2 pr-4">{log.signature?.slice(0,12) || '-'}</td>
                  <td className="py-2 pr-4 max-w-xs truncate" title={JSON.stringify(log.payload)}>{JSON.stringify(log.payload).slice(0,60)}...</td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">No logs found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default AdminWebhookLogs;
