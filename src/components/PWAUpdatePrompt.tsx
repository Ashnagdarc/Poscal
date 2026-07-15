import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAUpdate } from "@/hooks/use-pwa-update";

export const PWAUpdatePrompt = () => {
  const { updateAvailable, isUpdating, updateApp } = usePWAUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 px-4"
      data-poscal-update-prompt
    >
      <div className="mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-background/95 p-3 shadow-[0_16px_40px_-22px_rgba(0,0,0,0.75)] backdrop-blur">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <RefreshCw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Update ready</p>
          <p className="text-xs leading-snug text-muted-foreground">Restart Poscal to use the latest version.</p>
        </div>
        <Button size="sm" onClick={updateApp} disabled={isUpdating} className="shrink-0">
          {isUpdating ? "Updating" : "Update"}
        </Button>
      </div>
    </div>
  );
};
