import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProgressSessionForDay,
  listProgressSessions,
  saveProgressSession,
  type ProgressSession,
} from "@/lib/progressSessions";

export const PROGRESS_QUERY_KEY = ["progressSessions"] as const;

export const useProgressSessionsQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...PROGRESS_QUERY_KEY, "list", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");
      return await listProgressSessions(user.id);
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });
};

export const useProgressDayQuery = (dateKey: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...PROGRESS_QUERY_KEY, "day", user?.id, dateKey],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");
      return await getProgressSessionForDay(user.id, dateKey);
    },
    enabled: !!user && !!dateKey,
    staleTime: 1000 * 15,
  });
};

export const useSaveProgressSessionMutation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (session: ProgressSession) => {
      if (!user) throw new Error("User not authenticated");
      return await saveProgressSession(user.id, session);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: PROGRESS_QUERY_KEY });
      queryClient.setQueryData([...PROGRESS_QUERY_KEY, "day", user?.id, saved.dateKey], saved);
    },
  });
};
