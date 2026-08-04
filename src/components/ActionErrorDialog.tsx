import { AlertTriangle, X } from "lucide-react";
import type { ActionErrorInfo } from "@/lib/actionError";

interface ActionErrorDialogProps {
  open: boolean;
  error: ActionErrorInfo | null;
  onClose: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ActionErrorDialog = ({
  open,
  error,
  onClose,
  onRetry,
  retryLabel = "Try again",
}: ActionErrorDialogProps) => {
  if (!open || !error) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-background/80 p-6 backdrop-blur-sm animate-fade-in sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="action-error-title"
      aria-describedby="action-error-message"
    >
      <div className="my-auto w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg animate-scale-in">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 id="action-error-title" className="text-lg font-bold text-foreground">
                {error.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {error.code ? (
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Code {error.code}
              </p>
            ) : null}
          </div>
        </div>

        <p id="action-error-message" className="text-sm leading-relaxed text-muted-foreground">
          {error.message}
        </p>

        {error.whatToDo ? (
          <div className="mt-4 rounded-xl border border-border/60 bg-secondary/40 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              What to do
            </p>
            <p className="mt-1 text-sm text-foreground">{error.whatToDo}</p>
          </div>
        ) : null}

        {error.technical ? (
          <details className="mt-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground/80">Details</summary>
            <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono">
              {error.technical}
            </pre>
          </details>
        ) : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl bg-secondary font-semibold text-foreground transition-all duration-200 active:scale-[0.98]"
          >
            {onRetry ? "Dismiss" : "Got it"}
          </button>
          {onRetry ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="h-12 flex-1 rounded-xl bg-foreground font-semibold text-background transition-all duration-200 active:scale-[0.98]"
            >
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
