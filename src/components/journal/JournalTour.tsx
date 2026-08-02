import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { api } from "../../../convex/_generated/api";

export type JournalTourSection = "today" | "trades" | "history";

type TourStep = {
  id: string;
  title: string;
  body: string;
  section: JournalTourSection;
  target: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "switcher",
    title: "Your journals",
    body: "Switch between accounts here, or create another journal when you need one.",
    section: "today",
    target: "journal-switcher",
  },
  {
    id: "tabs",
    title: "Three places to work",
    body: "Today is your daily hub. Trades holds analytics. History keeps calculator results.",
    section: "today",
    target: "journal-tabs",
  },
  {
    id: "growth",
    title: "Trading growth",
    body: "Your equity curve starts from this journal’s account size and updates as you close trades.",
    section: "today",
    target: "journal-growth",
  },
  {
    id: "results",
    title: "Returns & calendar",
    body: "Tap a month or day to filter results. Calendar days sync with your session notes below.",
    section: "today",
    target: "journal-results",
  },
  {
    id: "session",
    title: "Daily session",
    body: "Write pre/post market notes and tick your checklist for the selected day.",
    section: "today",
    target: "journal-session",
  },
  {
    id: "trades",
    title: "Trades & analytics",
    body: "Log manual trades and review net P&L, win rate, and charts for this journal.",
    section: "trades",
    target: "journal-trades",
  },
  {
    id: "history",
    title: "Saved calculations",
    body: "Calculator results land here. Mark wins and losses so they feed your calendar and growth.",
    section: "history",
    target: "journal-history",
  },
];

const storageKey = (userId: string) => `poscal.journalTourCompleted.${userId}`;

export const hasCompletedJournalTour = (userId?: string | null) => {
  if (!userId || typeof window === "undefined") return true;
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
};

export const markJournalTourCompletedLocal = (userId: string) => {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    // ignore
  }
};

export const resetJournalTour = (userId?: string | null) => {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
};

interface JournalTourProps {
  enabled: boolean;
  pageSection: JournalTourSection;
  onSectionChange: (section: JournalTourSection) => void;
}

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export const JournalTour = ({
  enabled,
  pageSection,
  onSectionChange,
}: JournalTourProps) => {
  const { user } = useAuth();
  const tourStatus = useQuery(api.users.journalTourStatus, user ? {} : "skip");
  const markTourCompletedRemote = useMutation(api.users.markJournalTourCompleted);
  const [stepIndex, setStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const [completedLocally, setCompletedLocally] = useState(() => hasCompletedJournalTour(user?.id));
  const persistedRef = useRef(false);
  const launchedRef = useRef(false);
  const isOpenRef = useRef(false);
  const userIdRef = useRef(user?.id);
  const markRemoteRef = useRef(markTourCompletedRemote);

  const step = TOUR_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / TOUR_STEPS.length) * 100;
  const completedRemotely = tourStatus?.completed === true;
  const statusReady = completedLocally || tourStatus !== undefined;
  const alreadyCompleted = completedLocally || completedRemotely;

  isOpenRef.current = isOpen;
  userIdRef.current = user?.id;
  markRemoteRef.current = markTourCompletedRemote;

  const persistCompleted = useCallback((userId: string, options?: { updateState?: boolean }) => {
    if (!persistedRef.current) {
      persistedRef.current = true;
      markJournalTourCompletedLocal(userId);
      void markRemoteRef.current({}).catch(() => {
        persistedRef.current = false;
      });
    }
    if (options?.updateState !== false) {
      setCompletedLocally(true);
    }
  }, []);

  useEffect(() => {
    launchedRef.current = false;
    setCompletedLocally(hasCompletedJournalTour(user?.id));
    persistedRef.current = hasCompletedJournalTour(user?.id);
  }, [user?.id]);

  useEffect(() => {
    if (completedRemotely && user?.id && !completedLocally) {
      markJournalTourCompletedLocal(user.id);
      setCompletedLocally(true);
      persistedRef.current = true;
    }
  }, [completedRemotely, completedLocally, user?.id]);

  useEffect(() => {
    if (!enabled || !user?.id) {
      setIsOpen(false);
      return;
    }
    if (alreadyCompleted) {
      setIsOpen(false);
      return;
    }
    if (!statusReady || launchedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      launchedRef.current = true;
      setStepIndex(0);
      setIsOpen(true);
      // Persist as soon as it plays once so login/refresh never replays it.
      persistCompleted(user.id, { updateState: false });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [enabled, user?.id, alreadyCompleted, statusReady, persistCompleted]);

  // If the user leaves Journal mid-tour, still count it as done.
  useEffect(() => {
    return () => {
      if (isOpenRef.current && userIdRef.current) {
        markJournalTourCompletedLocal(userIdRef.current);
        void markRemoteRef.current({}).catch(() => {
          // ignore
        });
      }
    };
  }, []);

  // Switch tab first, then measure after the target is stably in view.
  useEffect(() => {
    if (!isOpen || !step) return;

    let cancelled = false;
    const timers: number[] = [];

    if (pageSection !== step.section) {
      onSectionChange(step.section);
      setHighlight(null);
      return;
    }

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour-id="${step.target}"]`);
      if (!(el instanceof HTMLElement)) {
        setHighlight(null);
        return;
      }

      // Keep the target above the docked coach card (~220px) + bottom nav.
      const reservedBottom = 260;
      const headerOffset = 96;
      const rect = el.getBoundingClientRect();
      const visibleBottom = window.innerHeight - reservedBottom;

      if (rect.top < headerOffset || rect.bottom > visibleBottom) {
        const delta =
          rect.top < headerOffset
            ? rect.top - headerOffset
            : rect.bottom - visibleBottom;
        window.scrollBy({ top: delta, left: 0, behavior: "auto" });
      }

      const next = el.getBoundingClientRect();
      setHighlight({
        top: next.top,
        left: next.left,
        width: next.width,
        height: next.height,
      });
    };

    // Instant scroll so measurement isn't mid-animation.
    const el = document.querySelector(`[data-tour-id="${step.target}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    }

    timers.push(window.setTimeout(measure, 32));
    timers.push(window.setTimeout(measure, 120));
    timers.push(window.setTimeout(measure, 280));

    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, step, pageSection, onSectionChange, stepIndex]);

  const finish = () => {
    if (user?.id) persistCompleted(user.id);
    setIsOpen(false);
    setHighlight(null);
    onSectionChange("today");
  };

  const goNext = () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const goBack = () => {
    setStepIndex((current) => Math.max(0, current - 1));
  };

  if (!isOpen || !step) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default bg-black/50"
          aria-label="Dismiss tour"
          onClick={finish}
        />

        {highlight ? (
          <motion.div
            key={`ring-${step.id}`}
            className="pointer-events-none absolute rounded-2xl border-2 border-emerald-400/80 bg-emerald-400/5"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              top: highlight.top,
              left: highlight.left,
              width: highlight.width,
              height: highlight.height,
            }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
        ) : null}

        <motion.div
          key={step.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="journal-tour-title"
          className="fixed inset-x-0 bottom-0 z-[81] px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="h-1 bg-secondary">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {stepIndex + 1} of {TOUR_STEPS.length}
              </p>
              <h3 id="journal-tour-title" className="mt-1 text-base font-bold text-foreground">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={finish}
                  className="min-h-10 px-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  Skip
                </button>
                <div className="flex gap-2">
                  {stepIndex > 0 ? (
                    <Button type="button" variant="outline" size="sm" className="min-h-10 px-4" onClick={goBack}>
                      Back
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" className="min-h-10 px-4" onClick={goNext}>
                    {stepIndex >= TOUR_STEPS.length - 1 ? "Got it" : "Next"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
