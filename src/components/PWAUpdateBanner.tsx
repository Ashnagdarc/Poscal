import { RefreshCw } from "lucide-react";
import { usePWAUpdate } from "@/hooks/use-pwa-update";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PWAUpdateBannerProps {
  className?: string;
}

export const PWAUpdateBanner = ({ className }: PWAUpdateBannerProps) => {
  const { updateAvailable, isUpdating, updateApp } = usePWAUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-[90] border-b border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Update available</p>
          <p className="text-xs text-muted-foreground">
            A newer version of Poscal is ready. Update to get the latest UI and fixes.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={isUpdating}
          onClick={() => void updateApp()}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isUpdating && "animate-spin")} />
          {isUpdating ? "Updating…" : "Update app"}
        </Button>
      </div>
    </div>
  );
};
