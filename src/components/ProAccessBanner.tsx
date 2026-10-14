import { useState } from "react";
import { useMutation } from "convex/react";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useProPaywall } from "@/contexts/ProPaywallContext";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
export function ProAccessBanner({ journalId }: { journalId?: string | null }) {
  const { hasPro, isLoading, freeJournalId, canChooseFreeJournal, usage } =
    useSubscription();
  const openPro = useProPaywall();
  const choose = useMutation(api.proBilling.chooseFreeJournal);
  const [busy, setBusy] = useState(false);
  if (hasPro || isLoading) return null;
  const locked = !!journalId && journalId !== freeJournalId;
  return (
    <div className="mb-4 space-y-3 rounded-2xl border border-border bg-secondary/60 p-4 text-sm">
      <p className="font-semibold">
        {locked
          ? "This journal is read-only"
          : `Free: ${usage.entries}/15 new entries this month`}
      </p>
      <p className="text-muted-foreground">
        {locked
          ? "Your trades, notebooks and screenshots are safe. Pro unlocks editing in all your journals."
          : "Old entries stay available. Extra screenshots and full analytics unlock with Pro."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            openPro(locked ? "Unlock this journal" : "More with Poscal Pro")
          }
        >
          View Poscal Pro
        </Button>
        {locked && canChooseFreeJournal && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (busy) return;
              setBusy(true);
              void choose({ journalId: journalId as Id<"tradingAccounts"> })
                .catch((err) => toast.error(err.message))
                .finally(() => setBusy(false));
            }}
          >
            Use this as my one Free journal
          </Button>
        )}
      </div>
      {locked && canChooseFreeJournal && (
        <p className="text-xs text-muted-foreground">
          You can choose once during this Free period. Other journals will
          remain readable.
        </p>
      )}
    </div>
  );
}
