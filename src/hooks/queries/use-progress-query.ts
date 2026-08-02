import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import {
  getProgressSessionForDay,
  listProgressSessions,
  saveProgressSession,
  type ProgressSession,
} from "@/lib/progressSessions";

export const PROGRESS_QUERY_KEY = ["progressSessions"] as const;

export const useProgressSessionsQuery = () => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();

  return useQuery({
    queryKey: [...PROGRESS_QUERY_KEY, "list", user?.id, activeJournalId],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");
      return await listProgressSessions(user.id, activeJournalId);
    },
    enabled: !!user && !!activeJournalId,
    staleTime: 1000 * 30,
  });
};

export const useProgressDayQuery = (dateKey: string) => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();

  return useQuery({
    queryKey: [...PROGRESS_QUERY_KEY, "day", user?.id, activeJournalId, dateKey],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");
      return await getProgressSessionForDay(user.id, dateKey, activeJournalId);
    },
    enabled: !!user && !!dateKey && !!activeJournalId,
    staleTime: 1000 * 15,
  });
};

export const useSaveProgressSessionMutation = () => {
  const { user } = useAuth();
  const { activeJournalId } = useJournal();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (session: ProgressSession) => {
      if (!user) throw new Error("User not authenticated");
      return await saveProgressSession(user.id, session, activeJournalId);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY });
      queryClient.setQueryData(
        [...PROGRESS_QUERY_KEY, "day", user?.id, activeJournalId, saved.dateKey],
        saved,
      );
    },
  });
};
