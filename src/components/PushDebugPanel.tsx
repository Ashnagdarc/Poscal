import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface DebugLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

export function PushDebugPanel() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_LOG') {
          addLog(event.data.message, event.data.logType || 'info');
        }
      });
    }

    // Check notification permission
    if ('Notification' in window) {
      addLog(`Notification permission: ${Notification.permission}`, 
        Notification.permission === 'granted' ? 'success' : 'error');
    }

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) {
          addLog(`Service Worker: ${reg.active ? 'Active' : 'Not active'}`, 
            reg.active ? 'success' : 'error');
        } else {
          addLog('Service Worker: Not registered', 'error');
        }
      });
    }
  }, []);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{ timestamp, message, type }, ...prev].slice(0, 50));
  };

  const testNotification = async () => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        addLog('Testing local notification...', 'info');
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification('Test Notification', {
              body: 'This is a test from the debug panel',
              icon: '/pwa-192x192.png',
              tag: 'test'
            });
            addLog('Local notification sent successfully!', 'success');
          } else {
            addLog('No service worker registration found', 'error');
          }
        } catch (err) {
          addLog(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
        }
      } else {
        addLog(`Permission not granted: ${Notification.permission}`, 'error');
      }
    }
  };

  const refreshServiceWorker = async () => {
    addLog('Refreshing service worker...', 'info');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        addLog('Service worker update triggered', 'success');
        
        // Wait a bit then reload
        setTimeout(() => {
          addLog('Reloading page...', 'info');
          window.location.reload();
        }, 1000);
      }
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    }
  };

  const checkSubscription = async () => {
    addLog('Checking push subscription...', 'info');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      
      if (sub) {
        const endpoint = sub.endpoint;
        const isApple = endpoint.includes('push.apple.com');
        const isGoogle = endpoint.includes('fcm.googleapis.com');
        addLog(`Subscribed to: ${isApple ? 'Apple' : isGoogle ? 'Google' : 'Unknown'}`, 'success');
        addLog(`Endpoint: ${endpoint.substring(0, 50)}...`, 'info');
      } else {
        addLog('No push subscription found!', 'error');
      }
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    }
  };

  const forceReregister = async () => {
    addLog('Force re-registering service worker...', 'info');
    try {
      // Unregister all service workers
      const regs = await navigator.serviceWorker.getRegistrations();
      addLog(`Found ${regs.length} service worker(s)`, 'info');
      
      for (const reg of regs) {
        await reg.unregister();
        addLog('Unregistered service worker', 'success');
      }
      
      addLog('Reloading in 2 seconds...', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      addLog(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    }
  };

  const sendTestPush = async () => {
    addLog('Sending test push via Edge Function...', 'info');
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('send-push-notification', {
        body: {
          title: '🧪 Manual Test from Debug Panel',
          body: 'Testing if Edge Function can send push notifications',
          tag: 'debug-test',
          data: { type: 'test', source: 'debug-panel' }
        }
      });
      
      addLog(`Response: ${JSON.stringify(result)}`, result.error ? 'error' : 'success');
      
      if (result.error) {
        addLog(`❌ Error: ${JSON.stringify(result.error)}`, 'error');
      } else if (result.data) {
        addLog(`✅ Success: ${JSON.stringify(result.data)}`, 'success');
      }
    } catch (err) {
      addLog(`❌ Exception: ${err instanceof Error ? err.message : 'Unknown'}`, 'error');
    }
  };

  const clearLogs = () => setLogs([]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-50"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <Card className="w-full h-[70vh] bg-white rounded-t-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Push Debug</h3>
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" variant="outline" onClick={testNotification} className="text-xs px-2 h-8">
              Test
            </Button>
            <Button size="sm" variant="default" onClick={sendTestPush} className="text-xs px-2 h-8 bg-purple-600">
              📤 Push
            </Button>
            <Button size="sm" variant="outline" onClick={checkSubscription} className="text-xs px-2 h-8">
              Sub
            </Button>
            <Button size="sm" variant="outline" onClick={refreshServiceWorker} className="text-xs px-2 h-8">
              Refresh
            </Button>
            <Button size="sm" variant="destructive" onClick={forceReregister} className="text-xs px-2 h-8">
              Reset
            </Button>
            <Button size="sm" variant="outline" onClick={clearLogs} className="text-xs px-2 h-8">
              Clear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsVisible(false)} className="text-xs px-2 h-8">
              ✕
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No logs yet. Create an app update to see push events.
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`p-2 rounded ${
                  log.type === 'error' ? 'bg-red-50 text-red-700' :
                  log.type === 'success' ? 'bg-green-50 text-green-700' :
                  'bg-gray-50 text-gray-700'
                }`}
              >
                <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
