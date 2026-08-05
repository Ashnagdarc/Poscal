import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/errorReporting';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, {
      source: 'ErrorBoundary',
      componentStack: errorInfo.componentStack,
    });
    this.setState({
      error,
      errorInfo,
    });

    // Vite HMR can break lazy chunks mid-navigation; recover with a single reload.
    const message = error.message ?? '';
    const isChunkLoadError =
      message.includes('dynamically imported module') ||
      message.includes('Importing a module script failed');
    if (isChunkLoadError && import.meta.env.DEV) {
      const key = 'poscal:chunk-auto-reload';
      const last = Number(sessionStorage.getItem(key) ?? '0');
      const now = Date.now();
      if (now - last > 10_000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  handleRetry = () => {
    const message = this.state.error?.message ?? "";
    // Soft remount cannot recover these: Vite HMR often recreates createContext()
    // while an old Provider fiber remains, so hooks keep seeing undefined.
    const needsHardReload =
      message.includes("dynamically imported module") ||
      message.includes("Failed to fetch") ||
      message.includes("must be used within") ||
      // Stale PWA after deploy often hits missing Convex functions once.
      message.includes("Could not find public function") ||
      message.includes("authSettings:getVerificationPolicy");

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (needsHardReload) {
      // Drop page caches + plain reload so "Try again" escapes a bad SW shell.
      void (async () => {
        try {
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(
              keys
                .filter(
                  (key) =>
                    key === "poscal-pages"
                    || key === "poscal-static-runtime"
                    || key.includes("workbox-precache"),
                )
                .map((key) => caches.delete(key)),
            );
          }
        } catch {
          // ignore
        }
        window.location.reload();
      })();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <h1 className="text-xl font-bold">Something went wrong</h1>
            </div>
            
            <p className="text-muted-foreground">
              We encountered an unexpected error. Please try again, refresh the page, or return home.
            </p>

            {this.state.error && import.meta.env.DEV && (
              <details className="mt-4 p-3 bg-secondary rounded text-xs">
                <summary className="cursor-pointer font-medium mb-2">Error Details (Dev Only)</summary>
                <pre className="whitespace-pre-wrap overflow-auto max-h-48">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            {/* Production builds never render stack traces (P-033 / AIS-018). */}

            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button onClick={this.handleReset} className="flex-1">
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
