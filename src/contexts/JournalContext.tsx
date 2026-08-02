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
  getJournalLimit,
  listTradingJournals,
  readStoredActiveJournalId,
  writeStoredActiveJournalId,
  type CreateJournalInput,
  type TradingJournal,
} from "@/lib/tradingJournals";

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
  const { user } = useAuth();
  const { subscriptionTier } = useSubscription();
  const { setCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [journals, setJournals] = useState<TradingJournal[]>([]);
  const [activeJournalId, setActiveJournalIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const journalLimit = getJournalLimit(subscriptionTier);
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
      const next = await listTradingJournals(user.id);
      setJournals(next);

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
  }, [user?.id]);

  useEffect(() => {
    void refreshJournals();
  }, [refreshJournals]);

  const activeJournal = useMemo(
    () => journals.find((journal) => journal.id === activeJournalId) ?? null,
    [journals, activeJournalId],
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
  }, [queryClient, subscriptionTier, user?.id]);

  const deleteJournal = useCallback(async (journalId: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
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
  }, [activeJournalId, queryClient, user?.id]);

  const value = useMemo<JournalContextValue>(() => ({
    journals,
    activeJournal,
    activeJournalId,
    isLoading,
    needsOnboarding: !isLoading && !!user?.id && journals.length === 0,
    canCreateJournal,
    journalLimit,
    setActiveJournalId,
    refreshJournals,
    createJournal,
    deleteJournal,
  }), [
    journals,
    activeJournal,
    activeJournalId,
    isLoading,
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
