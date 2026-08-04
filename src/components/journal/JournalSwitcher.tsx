import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useJournal } from "@/contexts/JournalContext";
import { JournalOnboarding } from "@/components/journal/JournalOnboarding";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TradingJournal } from "@/lib/tradingJournals";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useActionError } from "@/contexts/ActionErrorContext";

export const JournalSwitcher = () => {
  const {
    journals,
    activeJournal,
    setActiveJournalId,
    canCreateJournal,
    journalLimit,
    deleteJournal,
  } = useJournal();
  const { showErrorFromUnknown } = useActionError();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [journalToDelete, setJournalToDelete] = useState<TradingJournal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!activeJournal) return null;

  const handleConfirmDelete = async () => {
    if (!journalToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const name = journalToDelete.name;
      await deleteJournal(journalToDelete.id);
      setJournalToDelete(null);
      setOpen(false);
      toast.success(`Deleted “${name}”`);
    } catch (error) {
      console.error("[journalSwitcher] Failed to delete journal", error);
      showErrorFromUnknown(error, {
        title: "Couldn't delete journal",
        fallbackMessage: "We couldn’t delete that journal.",
        code: "JNL-DEL-BOOK",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-left transition-all active:scale-[0.99]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{activeJournal.name}</p>
            <p className="text-xs text-muted-foreground">
              {activeJournal.currency} · {journals.length}/{journalLimit} journals
            </p>
          </div>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
            <div className="max-h-64 overflow-y-auto p-1">
              {journals.map((journal) => (
                <div
                  key={journal.id}
                  className={cn(
                    "flex items-center gap-1 rounded-xl",
                    journal.id === activeJournal.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveJournalId(journal.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left transition-colors",
                      journal.id !== activeJournal.id && "hover:bg-secondary/70 hover:text-foreground",
                    )}
                  >
                    <span className="block truncate text-sm font-semibold">{journal.name}</span>
                    <span className="block text-[11px]">
                      {journal.currency} · {journal.startingBalance.toLocaleString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${journal.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setJournalToDelete(journal);
                    }}
                    className="mr-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-1">
              {canCreateJournal ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" />
                  New journal
                </button>
              ) : (
                <Link
                  to="/upgrade"
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  Upgrade for more journals
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                    Your plan allows {journalLimit} journal{journalLimit === 1 ? "" : "s"}
                  </span>
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md border-border bg-background p-0 sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Create journal</DialogTitle>
          </DialogHeader>
          <JournalOnboarding
            mode="create"
            onCancel={() => setCreateOpen(false)}
            onComplete={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!journalToDelete}
        onClose={() => {
          if (!isDeleting) setJournalToDelete(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
        title="Delete journal?"
        description={
          journalToDelete
            ? `“${journalToDelete.name}” and all of its trades, results, and session notes will be permanently deleted.`
            : "This journal and its data will be permanently deleted."
        }
        confirmText={isDeleting ? "Deleting…" : "Delete"}
        variant="destructive"
      />
    </>
  );
};
