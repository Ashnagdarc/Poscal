import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, type SubscriptionTier } from "@/contexts/SubscriptionContext";
import { ACCOUNT_CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { TRADES_QUERY_KEY } from "@/hooks/queries/use-trades-query";
import { PROGRESS_QUERY_KEY } from "@/hooks/queries/use-progress-query";
import {
  attachOrphanJournalData,
  createTradingJournal,
  deleteTradingJournal,
  listTradingJournals,
  readStoredActiveJournalId,
  writeStoredActiveJournalId,
  type CreateJournalInput,
  type TradingJournal,
} from "@/lib/tradingJournals";
import {
  cacheOfflineJournals,
  isLikelyNetworkError,
  loadOfflineJournals,
} from "@/lib/offlineStore";

const JOURNALS_QUERY_KEY = ["tradingJournals"] as const;

interface JournalContextValue {
  journals: TradingJournal[];
  activeJournal: TradingJournal | null;
  activeJournalId: string | null;
  isLoading: boolean;
  needsOnboarding: boolean;
  canCreateJournal: boolean;
  journalLimit: number;
  setActiveJournalId: (journalId: string) => void;
  refreshJournals: () => Promise<TradingJournal[]>;
  createJournal: (input: CreateJournalInput) => Promise<TradingJournal>;
  deleteJournal: (journalId: string) => Promise<void>;
}

const JournalContext = createContext<JournalContextValue | undefined>(undefined);

export const JournalProvider = ({ children }: { children: ReactNode }) => {
  const { user, authMode } = useAuth();
  const { subscriptionTier, limits, hasPro, freeJournalId, isLoading: subscriptionLoading } = useSubscription();
  const { setCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [journals, setJournals] = useState<TradingJournal[]>([]);
  const [activeJournalId, setActiveJournalIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const journalLimit = limits.journals;
  const canCreateJournal = journals.length < journalLimit;

  const refreshJournals = useCallback(async () => {
    if (!user?.id) {
      setJournals([]);
      setActiveJournalIdState(null);
      setIsLoading(false);
      return [] as TradingJournal[];
    }

    setIsLoading(true);
    try {
      let next: TradingJournal[];
      if (authMode === "offline_verified_device") {
        next = await loadOfflineJournals<TradingJournal>(user.id);
      } else {
        try {
          next = await listTradingJournals(user.id);
        } catch (error) {
          if (!isLikelyNetworkError(error)) throw error;
          next = await loadOfflineJournals<TradingJournal>(user.id);
        }
      }
      setJournals(next);

      if (authMode === "online_authenticated") {
        void cacheOfflineJournals(user.id, next).catch((error) => {
          console.warn("[journal] Could not cache journals for offline use", error);
        });
      }

      const stored = readStoredActiveJournalId(user.id);
      const preferred =
        (stored && next.find((journal) => journal.id === stored)?.id)
        || next[0]?.id
        || null;

      setActiveJournalIdState(preferred);
      if (preferred) {
        writeStoredActiveJournalId(user.id, preferred);
      }

      return next;
    } finally {
      setIsLoading(false);
    }
  }, [authMode, user?.id]);

  useEffect(() => {
    void refreshJournals();
  }, [refreshJournals]);

  const accessibleJournals = useMemo(() => journals.map(journal => ({ ...journal, isReadOnly: journal.status === "archived" || (!hasPro && journal.id !== freeJournalId) })), [journals, hasPro, freeJournalId]);
  const activeJournal = useMemo(
    () => accessibleJournals.find(journal => journal.id === activeJournalId) ?? null,
    [accessibleJournals, activeJournalId],
  );

  useEffect(() => {
    if (!activeJournal) return;
    const match = ACCOUNT_CURRENCIES.find((item) => item.code === activeJournal.currency);
    if (match) {
      setCurrency(match);
    }
  }, [activeJournal, setCurrency]);

  const setActiveJournalId = useCallback((journalId: string) => {
    if (!user?.id) return;
    setActiveJournalIdState(journalId);
    writeStoredActiveJournalId(user.id, journalId);
    void queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY });
  }, [queryClient, user?.id]);

  const createJournal = useCallback(async (input: CreateJournalInput) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }
    if (authMode !== "online_authenticated") {
      throw new Error("Creating a journal requires a connection. Your existing journals remain available offline.");
    }

    const created = await createTradingJournal(user.id, {
      ...input,
      subscriptionTier: input.subscriptionTier ?? subscriptionTier,
    });

    await attachOrphanJournalData(user.id, created.id);

    const next = await listTradingJournals(user.id);
    setJournals(next);
    setActiveJournalIdState(created.id);
    writeStoredActiveJournalId(user.id, created.id);

    void queryClient.invalidateQueries({ queryKey: JOURNALS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY });

    return created;
  }, [authMode, queryClient, subscriptionTier, user?.id]);

  const deleteJournal = useCallback(async (journalId: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }
    if (authMode !== "online_authenticated") {
      throw new Error("Deleting a journal requires a connection.");
    }

    await deleteTradingJournal(user.id, journalId);

    const next = await listTradingJournals(user.id);
    setJournals(next);

    const nextActive =
      (activeJournalId === journalId
        ? next[0]?.id
        : next.find((journal) => journal.id === activeJournalId)?.id)
      ?? next[0]?.id
      ?? null;

    setActiveJournalIdState(nextActive);
    writeStoredActiveJournalId(user.id, nextActive);

    void queryClient.invalidateQueries({ queryKey: JOURNALS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: TRADES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY });
  }, [activeJournalId, authMode, queryClient, user?.id]);

  const value = useMemo<JournalContextValue>(() => ({
    journals: accessibleJournals,
    activeJournal,
    activeJournalId,
    isLoading: isLoading || subscriptionLoading,
    needsOnboarding: !isLoading && !!user?.id && journals.length === 0,
    canCreateJournal,
    journalLimit,
    setActiveJournalId,
    refreshJournals,
    createJournal,
    deleteJournal,
  }), [
    accessibleJournals,
    journals.length,
    activeJournal,
    activeJournalId,
    isLoading,
    subscriptionLoading,
    user?.id,
    canCreateJournal,
    journalLimit,
    setActiveJournalId,
    refreshJournals,
    createJournal,
    deleteJournal,
  ]);

  return (
    <JournalContext.Provider value={value}>
      {children}
    </JournalContext.Provider>
  );
};

export const useJournal = () => {
  const context = useContext(JournalContext);
  if (!context) {
    throw new Error("useJournal must be used within a JournalProvider");
  }
  return context;
};

export type { TradingJournal, CreateJournalInput, SubscriptionTier };
