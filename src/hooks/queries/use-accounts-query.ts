import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { accountsApi } from '@/lib/api';

interface TradingAccount {
  id: string;
  account_name: string;
  platform: string;
  is_active: boolean;
}

export const ACCOUNTS_QUERY_KEY = ['trading_accounts'] as const;

export const useAccountsQuery = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...ACCOUNTS_QUERY_KEY, user?.id],
    queryFn: async (): Promise<TradingAccount[]> => {
      if (!user) throw new Error('User not authenticated');

      try {
        const data = await accountsApi.getAll();
        return data || [];
      } catch (error) {
        logger.error('Error fetching accounts:', error);
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // Consider fresh for 2 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });
};
