import { usePaginatedQuery } from "convex/react";
import { anyApi } from "convex/server";

import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { fromConvexSavedRecord } from "@/lib/calculatorHistory";

export const JOURNAL_CALC_PAGE_SIZE = 50;

export const usePaginatedCalculatorHistory = () => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const enabled = Boolean(user?.id && activeJournalId);

  const paginated = usePaginatedQuery(
    anyApi.calculatorHistory.listForUserPaginated,
    enabled ? { journalId: activeJournalId } : "skip",
    { initialNumItems: JOURNAL_CALC_PAGE_SIZE },
  );

  return {
    ...paginated,
    data: paginated.results.map((row) => fromConvexSavedRecord(row as any)),
    isLoading: paginated.status === "LoadingFirstPage",
    isLoadingMore: paginated.status === "LoadingMore",
    canLoadMore: paginated.status === "CanLoadMore",
    loadMore: () => paginated.loadMore(JOURNAL_CALC_PAGE_SIZE),
  };
};
