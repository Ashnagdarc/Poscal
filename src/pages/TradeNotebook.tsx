import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Clock3, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ManualTradeSheet } from "@/components/journal/ManualTradeSheet";
import {
  getJournalEntry,
  updateJournalEntry,
  updateTradeNotebook,
  type JournalTrade,
  type NotebookPatch,
} from "@/lib/convexJournal";
import { toast } from "sonner";
import {
  deleteJournalImage,
  listJournalImages,
  uploadJournalImage,
  type JournalAttachment,
  type JournalImageQuota,
  type JournalImageRole,
} from "@/lib/journalImages";
import type { ManualTradeInput } from "@/hooks/queries/use-trades-query";

type NotebookDraft = {
  entry_reason: string;
  during_trade_notes: string;
  post_trade_review: string;
  lessons_learned: string;
  updatedAtMs: number;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const MAX_SECTION_CHARS = 100_000;
const AUTOSAVE_DELAY_MS = 1_500;

const emptyDraft = (): NotebookDraft => ({
  entry_reason: "",
  during_trade_notes: "",
  post_trade_review: "",
  lessons_learned: "",
  updatedAtMs: Date.now(),
});

const draftKey = (tradeId: string) => `poscal.tradeNotebookDraft.${tradeId}`;

const fromTrade = (trade: JournalTrade): NotebookDraft => ({
  entry_reason: trade.entry_reason ?? "",
  during_trade_notes: trade.during_trade_notes ?? "",
  post_trade_review: trade.post_trade_review ?? "",
  lessons_learned: trade.lessons_learned ?? "",
  updatedAtMs: trade.journal_updated_at ? new Date(trade.journal_updated_at).getTime() : 0,
});

const readLocalDraft = (tradeId: string): NotebookDraft | null => {
  try {
    const raw = localStorage.getItem(draftKey(tradeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotebookDraft>;
    if (
      typeof parsed.entry_reason !== "string"
      || typeof parsed.during_trade_notes !== "string"
      || typeof parsed.post_trade_review !== "string"
      || typeof parsed.lessons_learned !== "string"
      || typeof parsed.updatedAtMs !== "number"
    ) {
      return null;
    }
    return parsed as NotebookDraft;
  } catch {
    return null;
  }
};

const writeLocalDraft = (tradeId: string, draft: NotebookDraft) => {
  try {
    localStorage.setItem(draftKey(tradeId), JSON.stringify(draft));
  } catch {
    // Storage can be unavailable or full. Server autosave still runs.
  }
};

const clearLocalDraft = (tradeId: string) => {
  try {
    localStorage.removeItem(draftKey(tradeId));
  } catch {
    // ignore
  }
};

const formatPrice = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 2 : 4,
    maximumFractionDigits: value >= 100 ? 2 : 5,
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return "Date not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const TradeNotebook = () => {
  const { tradeId } = useParams<{ tradeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [trade, setTrade] = useState<JournalTrade | null>(null);
  const [draft, setDraft] = useState<NotebookDraft>(emptyDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [attachments, setAttachments] = useState<JournalAttachment[]>([]);
  const [imageQuota, setImageQuota] = useState<JournalImageQuota | null>(null);
  const [uploadingRole, setUploadingRole] = useState<JournalImageRole | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [isTradeDetailsOpen, setIsTradeDetailsOpen] = useState(false);
  const [isSavingTradeDetails, setIsSavingTradeDetails] = useState(false);

  const hydratedRef = useRef(false);
  const revisionRef = useRef(0);

  useEffect(() => {
    if (!tradeId || !user?.id) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    hydratedRef.current = false;

    void getJournalEntry(user.id, tradeId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setLoadError("This trade could not be found.");
          return;
        }

        setTrade(result);

        const remote = fromTrade(result);
        const local = readLocalDraft(tradeId);
        const initial = local && local.updatedAtMs > remote.updatedAtMs ? local : remote;
        setDraft(initial);
        revisionRef.current = 0;
        setSaveState(local && local.updatedAtMs > remote.updatedAtMs ? "dirty" : "idle");
        hydratedRef.current = true;
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not load this notebook.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tradeId, user?.id]);

  useEffect(() => {
    if (!tradeId || !user?.id) return;
    let cancelled = false;

    void listJournalImages(tradeId)
      .then((result) => {
        if (cancelled) return;
        setAttachments(result.attachments);
        setImageQuota(result.quota);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[notebook] image metadata load failed", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tradeId, user?.id]);

  const patch = useMemo<NotebookPatch>(() => ({
    entry_reason: draft.entry_reason || null,
    during_trade_notes: draft.during_trade_notes || null,
    post_trade_review: draft.post_trade_review || null,
    lessons_learned: draft.lessons_learned || null,
  }), [
    draft.entry_reason,
    draft.during_trade_notes,
    draft.post_trade_review,
    draft.lessons_learned,
  ]);

  useEffect(() => {
    if (!hydratedRef.current || !tradeId || !user?.id || saveState !== "dirty") return;

    const timer = window.setTimeout(() => {
      const savingRevision = revisionRef.current;
      setSaveState("saving");

      void updateTradeNotebook(user.id, tradeId, patch)
        .then((updated) => {
          // If the user typed again while this request was in flight, do not
          // mark the newer local draft as saved or clear it.
          if (savingRevision !== revisionRef.current) return;
          setTrade(updated);
          clearLocalDraft(tradeId);
          setSaveState("saved");
        })
        .catch(() => {
          if (savingRevision !== revisionRef.current) return;
          setSaveState("error");
        });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [patch, saveState, tradeId, user?.id]);

  const updateSection = (
    key: "entry_reason" | "during_trade_notes" | "post_trade_review" | "lessons_learned",
    value: string,
  ) => {
    if (!tradeId) return;

    revisionRef.current += 1;
    setDraft((current) => {
      const next = {
        ...current,
        [key]: value.slice(0, MAX_SECTION_CHARS),
        updatedAtMs: Date.now(),
      };
      writeLocalDraft(tradeId, next);
      return next;
    });
    setSaveState("dirty");
  };

  const handleImageSelection = async (
    role: JournalImageRole,
    file: File | null,
  ) => {
    if (!file || !tradeId) return;
    setUploadingRole(role);
    try {
      const result = await uploadJournalImage(tradeId, role, file);
      setAttachments((current) => [
        ...current.filter((item) => item.role !== role),
        result.attachment,
      ]);
      const refreshed = await listJournalImages(tradeId);
      setAttachments(refreshed.attachments);
      setImageQuota(refreshed.quota);
      toast.success(role === "before" ? "Before-trade chart saved" : "After-trade chart saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload chart");
    } finally {
      setUploadingRole(null);
    }
  };

  const handleDeleteImage = async (attachment: JournalAttachment) => {
    setDeletingAttachmentId(attachment.id);
    try {
      await deleteJournalImage(attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      if (tradeId) {
        const refreshed = await listJournalImages(tradeId);
        setImageQuota(refreshed.quota);
      }
      toast.success("Chart removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove chart");
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleSaveTradeDetails = async (input: ManualTradeInput) => {
    if (!trade || !user?.id) return;

    setIsSavingTradeDetails(true);
    try {
      const updated = await updateJournalEntry(user.id, trade.id, {
        ...input,
        journal_type: "structured",
      });
      setTrade((current) => ({
        ...updated,
        entry_reason: current?.entry_reason ?? null,
        during_trade_notes: current?.during_trade_notes ?? null,
        post_trade_review: current?.post_trade_review ?? null,
        lessons_learned: current?.lessons_learned ?? null,
      }));
      setIsTradeDetailsOpen(false);
      toast.success("Trade details saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save trade details");
    } finally {
      setIsSavingTradeDetails(false);
    }
  };

  const imageFor = (role: JournalImageRole) =>
    attachments.find((item) => item.role === role) ?? null;

  const renderChartUploader = (role: JournalImageRole, label: string) => {
    const attachment = imageFor(role);
    const uploading = uploadingRole === role;

    if (attachment) {
      return (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-secondary/30">
          <img
            src={attachment.url}
            alt={label}
            className="max-h-[520px] w-full bg-black/20 object-contain"
            loading="lazy"
          />
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{label}</p>
              <p className="text-[11px] text-muted-foreground">
                {(attachment.sizeBytes / 1024).toFixed(0)} KB
              </p>
            </div>
            <div className="flex gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-background px-3 text-xs font-semibold text-foreground">
                <Upload className="h-3.5 w-3.5" />
                Replace
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.currentTarget.value = "";
                    void handleImageSelection(role, file);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void handleDeleteImage(attachment)}
                disabled={deletingAttachmentId === attachment.id}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-background px-3 text-xs font-semibold text-muted-foreground disabled:opacity-50"
              >
                {deletingAttachmentId === attachment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Remove
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <label className="mt-3 flex min-h-32 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 px-4 text-center transition hover:bg-secondary/60">
        <div>
          {uploading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
          )}
          <p className="mt-2 text-sm font-semibold text-foreground">
            {uploading ? "Uploading chart…" : `Add ${label.toLowerCase()}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPEG or WebP. Poscal compresses images before upload.
          </p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.currentTarget.value = "";
              void handleImageSelection(role, file);
            }}
          />
        </div>
      </label>
    );
  };

  const statusLabel = (() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "error") return "Saved on this device";
    if (saveState === "saved") return "Saved";
    if (saveState === "dirty") return "Unsaved changes";
    return trade?.journal_status === "complete"
      ? "Journal complete"
      : trade?.journal_status === "draft"
        ? "Draft"
        : "Ready to journal";
  })();

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading notebook…
        </div>
      </div>
    );
  }

  if (!trade || loadError) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Notebook unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError ?? "This trade could not be found."}</p>
        <button
          type="button"
          onClick={() => navigate("/journal")}
          className="mt-5 h-11 rounded-xl bg-secondary px-5 text-sm font-semibold text-foreground"
        >
          Back to Journal
        </button>
      </div>
    );
  }

  const isNotebookDraft = trade.journal_type === "notebook_draft";
  const displayPair = isNotebookDraft ? "Untitled trade" : trade.pair;
  const pnl = trade.pnl;
  const direction = trade.direction === "sell" || trade.direction === "short" ? "Short" : "Long";

  return (
    <div className="min-h-full bg-background pb-12">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/journal")}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground"
            aria-label="Back to Journal"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{displayPair}</p>
            <p className="text-xs text-muted-foreground">{statusLabel}</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveState === "saving" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" || trade.journal_status === "complete" ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
            <span>{saveState === "error" ? "Offline draft" : "Autosave"}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
        <section className="border-b border-border/60 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{displayPair}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {isNotebookDraft ? (
                  <>
                    <span>Manual notebook</span>
                    <span>•</span>
                    <span>{formatDate(trade.entry_date ?? trade.created_at)}</span>
                  </>
                ) : (
                  <>
                    <span>{direction}</span>
                    <span>•</span>
                    <span className="capitalize">{trade.status}</span>
                    <span>•</span>
                    <span>{formatDate(trade.entry_date ?? trade.created_at)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-muted-foreground">P&L</p>
              <p className={`text-2xl font-bold ${
                pnl == null
                  ? "text-foreground"
                  : pnl > 0
                    ? "text-emerald-400"
                    : pnl < 0
                      ? "text-red-400"
                      : "text-foreground"
              }`}>
                {pnl == null ? "—" : `${pnl > 0 ? "+" : ""}${pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Use only what helps you. Notes and charts are optional, and you can come back to this trade anytime.
          </p>
        </section>

        <section className="border-b border-border/60 py-5">
          <p className="text-sm font-bold text-foreground">Before the trade</p>
          {renderChartUploader("before", "Before-trade chart")}

          <label className="mt-6 block">
            <span className="text-sm font-semibold text-foreground">Why did you take this trade?</span>
            <textarea
              value={draft.entry_reason}
              onChange={(event) => updateSection("entry_reason", event.target.value)}
              maxLength={MAX_SECTION_CHARS}
              placeholder="What did you see? What was the setup, context, confirmation or idea behind the entry?"
              className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-foreground/30"
            />
          </label>
        </section>

        <section className="border-b border-border/60 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground">Trade details</p>
            <button
              type="button"
              onClick={() => setIsTradeDetailsOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-secondary px-3 text-xs font-semibold text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isNotebookDraft ? "Add details" : "Edit"}
            </button>
          </div>

          {isNotebookDraft ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">Details are optional</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Journal first if you want. Add the instrument, direction, prices, P&amp;L or risk later and Poscal will include it in your trade analytics then.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Entry</p>
                <p className="mt-1 font-semibold text-foreground">{formatPrice(trade.entry_price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stop loss</p>
                <p className="mt-1 font-semibold text-foreground">{formatPrice(trade.stop_loss)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Take profit</p>
                <p className="mt-1 font-semibold text-foreground">{formatPrice(trade.take_profit)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exit</p>
                <p className="mt-1 font-semibold text-foreground">{formatPrice(trade.exit_price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Position size</p>
                <p className="mt-1 font-semibold text-foreground">
                  {trade.position_size == null ? "—" : `${trade.position_size} lots`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Risk</p>
                <p className="mt-1 font-semibold text-foreground">
                  {trade.risk_percent == null ? "—" : `${trade.risk_percent}%`}
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="border-b border-border/60 py-5">
          <p className="text-sm font-bold text-foreground">During the trade</p>
          <textarea
            value={draft.during_trade_notes}
            onChange={(event) => updateSection("during_trade_notes", event.target.value)}
            maxLength={MAX_SECTION_CHARS}
            placeholder="What happened while the position was open? Record management decisions, emotions, changes in structure or anything worth remembering."
            className="mt-3 min-h-36 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-foreground/30"
          />
        </section>

        <section className="border-b border-border/60 py-5">
          <p className="text-sm font-bold text-foreground">After the trade</p>
          {renderChartUploader("after", "After-trade chart")}

          <textarea
            value={draft.post_trade_review}
            onChange={(event) => updateSection("post_trade_review", event.target.value)}
            maxLength={MAX_SECTION_CHARS}
            placeholder="How did the trade actually play out? Was the thesis right even if the result was wrong?"
            className="mt-4 min-h-36 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-foreground/30"
          />
        </section>

        <section className="py-5">
          <p className="text-sm font-bold text-foreground">What I learned</p>
          <textarea
            value={draft.lessons_learned}
            onChange={(event) => updateSection("lessons_learned", event.target.value)}
            maxLength={MAX_SECTION_CHARS}
            placeholder="What would you repeat, avoid or change if this setup appeared again?"
            className="mt-3 min-h-36 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm leading-6 text-foreground outline-none transition focus:border-foreground/30"
          />

          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            <span>
              {trade.journal_updated_at
                ? `Last synced ${formatDate(trade.journal_updated_at)}`
                : "Your first note will start this journal"}
            </span>
          </div>

          {imageQuota && imageQuota.usedBytes > 0 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Image storage {(imageQuota.usedBytes / (1024 * 1024)).toFixed(1)} / {(imageQuota.limitBytes / (1024 * 1024)).toFixed(0)} MB
            </p>
          ) : null}

          {saveState === "error" ? (
            <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
              Poscal could not reach the server. Your latest writing is stored on this device and will remain available when you reopen this trade.
            </p>
          ) : null}
        </section>
      </main>

      <ManualTradeSheet
        open={isTradeDetailsOpen}
        onOpenChange={setIsTradeDetailsOpen}
        trade={trade}
        isSaving={isSavingTradeDetails}
        onSave={handleSaveTradeDetails}
      />
    </div>
  );
};

export default TradeNotebook;
