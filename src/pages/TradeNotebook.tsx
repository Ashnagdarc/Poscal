import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Clock3, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  getJournalEntry,
  updateTradeNotebook,
  type JournalTrade,
  type NotebookPatch,
} from "@/lib/convexJournal";
import { toast } from "sonner";

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
            <p className="truncate text-sm font-semibold text-foreground">{trade.pair}</p>
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

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <section className="border-b border-border/60 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{trade.pair}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{direction}</span>
                <span>•</span>
                <span className="capitalize">{trade.status}</span>
                <span>•</span>
                <span>{formatDate(trade.entry_date ?? trade.created_at)}</span>
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
        </section>

        <section className="border-b border-border/60 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Before the trade</p>
          <div className="mt-4 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 px-4 text-center">
            <div>
              <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">Before-trade chart</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Secure chart uploads are the next layer. The notebook data model is ready for them.
              </p>
            </div>
          </div>

          <label className="mt-6 block">
            <span className="text-sm font-semibold text-foreground">Why did you take this trade?</span>
            <textarea
              value={draft.entry_reason}
              onChange={(event) => updateSection("entry_reason", event.target.value)}
              maxLength={MAX_SECTION_CHARS}
              placeholder="What did you see? What was the setup, context, confirmation or idea behind the entry?"
              className="mt-2 min-h-52 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-base leading-7 text-foreground outline-none transition focus:border-foreground/30"
            />
          </label>
        </section>

        <section className="border-b border-border/60 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Trade details</p>
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
        </section>

        <section className="border-b border-border/60 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">During the trade</p>
          <textarea
            value={draft.during_trade_notes}
            onChange={(event) => updateSection("during_trade_notes", event.target.value)}
            maxLength={MAX_SECTION_CHARS}
            placeholder="What happened while the position was open? Record management decisions, emotions, changes in structure or anything worth remembering."
            className="mt-4 min-h-60 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-base leading-7 text-foreground outline-none transition focus:border-foreground/30"
          />
        </section>

        <section className="border-b border-border/60 py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">After the trade</p>
          <div className="mt-4 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 px-4 text-center">
            <div>
              <Camera className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold text-foreground">After-trade chart</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This slot will use the same private R2 attachment system as the before chart.
              </p>
            </div>
          </div>

          <textarea
            value={draft.post_trade_review}
            onChange={(event) => updateSection("post_trade_review", event.target.value)}
            maxLength={MAX_SECTION_CHARS}
            placeholder="How did the trade actually play out? Was the thesis right even if the result was wrong?"
            className="mt-6 min-h-52 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-base leading-7 text-foreground outline-none transition focus:border-foreground/30"
          />
        </section>

        <section className="py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What I learned</p>
          <textarea
            value={draft.lessons_learned}
            onChange={(event) => updateSection("lessons_learned", event.target.value)}
            maxLength={MAX_SECTION_CHARS}
            placeholder="What would you repeat, avoid or change if this setup appeared again?"
            className="mt-4 min-h-60 w-full resize-y rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-base leading-7 text-foreground outline-none transition focus:border-foreground/30"
          />

          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            <span>
              {trade.journal_updated_at
                ? `Last synced ${formatDate(trade.journal_updated_at)}`
                : "Your first note will start this journal"}
            </span>
          </div>

          {saveState === "error" ? (
            <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-xs text-muted-foreground">
              Poscal could not reach the server. Your latest writing is stored on this device and will remain available when you reopen this trade.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
};

export default TradeNotebook;
