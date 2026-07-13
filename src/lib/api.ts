import axios, { type AxiosInstance } from 'axios';
import { api as convexApi } from '../../convex/_generated/api';
import { convexClient, createAuthenticatedConvexClient } from '@/lib/convexClient';
import { logger } from '@/lib/logger';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// For serverless functions in /api, use relative path
const serverlessApi = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getStoredConvexAuthToken = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem('convex_auth_token');
};

const getAuthenticatedConvexClient = () => {
  const token = getStoredConvexAuthToken();
  return token ? createAuthenticatedConvexClient(token) : convexClient;
};

// Add auth token to requests if available (for both APIs)
const addAuthInterceptor = (axiosInstance: AxiosInstance) => {
  axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
};

// Handle token expiration (for both APIs)
const addErrorInterceptor = (axiosInstance: AxiosInstance) => {
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        // Redirect to signin page, not auth
        window.location.href = '/signin';
      }
      return Promise.reject(error);
    }
  );
};

addAuthInterceptor(api);
addAuthInterceptor(serverlessApi);
addErrorInterceptor(api);
addErrorInterceptor(serverlessApi);

interface FeatureFlagResponse {
  success: boolean;
  key: string;
  enabled: boolean;
  message?: string;
}

const parseFeatureFlagError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const apiMessage = err.response?.data?.message as string | undefined;
    const statusText = status ? ` (${status})` : '';
    return apiMessage || `${err.message}${statusText}`;
  }
  return err instanceof Error ? err.message : 'Failed to reach feature flag API';
};

export const featureFlagApi = {
  getPaidLock: async (): Promise<boolean> => {
    try {
      logger.log('[feature-flag] Fetching paid lock status from Convex...');
      const enabled = await convexClient.query(convexApi.admin.getPaidLock, {});
      logger.log('[feature-flag] Paid lock status:', enabled);
      return !!enabled;
    } catch (err) {
      logger.error('[feature-flag] Error:', err);
      throw new Error(parseFeatureFlagError(err));
    }
  },

  setPaidLock: async (enabled: boolean): Promise<boolean> => {
    try {
      logger.log('[feature-flag] Setting paid lock to:', enabled);
      await getAuthenticatedConvexClient().mutation(convexApi.admin.setPaidLock, { enabled });
      logger.log('[feature-flag] Update success');
      return !!enabled;
    } catch (err) {
      logger.error('[feature-flag] Update error:', err);
      throw new Error(parseFeatureFlagError(err));
    }
  },
};

export const systemApi = {
  getIngestorHealth: async (): Promise<{
    recent_401_count: number;
    last_401_at: string | null;
    last_flush_at: string | null;
    backend_reachable: boolean;
  }> => {
    return await getAuthenticatedConvexClient().query(convexApi.admin.getIngestorHealth, {});
  },
};

export const adminUsersApi = {
  getAll: async (): Promise<Array<{
    id: string;
    full_name: string | null;
    email: string;
    is_admin: boolean;
    account_type: string | null;
    created_at: string;
    subscription_tier: string;
    subscription_end: string | null;
  }>> => {
    return await getAuthenticatedConvexClient().query(convexApi.admin.listUsers, {});
  },
};

// Trading Signals API
export const signalsApi = {
  getAll: async (query?: { status?: string; limit?: number }): Promise<any[]> => {
    return await convexClient.query(convexApi.signals.list, {
      status: query?.status ?? null,
      currencyPair: null,
      result: null,
      date: null,
    });
  },

  getOne: async (id: string): Promise<any> => {
    const rows = await convexClient.query(convexApi.signals.list, {
      status: null,
      currencyPair: null,
      result: null,
      date: null,
    });
    return rows.find((row: any) => row.id === id) ?? null;
  },

  create: async (signalData: any): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.signals.create, {
      currencyPair: signalData.currency_pair,
      direction: signalData.direction,
      entryPrice: signalData.entry_price,
      stopLoss: signalData.stop_loss,
      takeProfit1: signalData.take_profit_1,
      takeProfit2: signalData.take_profit_2 ?? null,
      takeProfit3: signalData.take_profit_3 ?? null,
      takeProfit: signalData.take_profit ?? signalData.take_profit_1 ?? null,
      pipsToSl: signalData.pips_to_sl,
      pipsToTp1: signalData.pips_to_tp1,
      pipsToTp2: signalData.pips_to_tp2 ?? null,
      pipsToTp3: signalData.pips_to_tp3 ?? null,
      status: signalData.status ?? 'active',
      marketExecution: signalData.market_execution ?? null,
      analysis: signalData.analysis ?? null,
      timeframe: signalData.timeframe ?? null,
      expiresAtMs: signalData.expires_at ? new Date(signalData.expires_at).getTime() : null,
      result: signalData.result ?? null,
      tp1Hit: signalData.tp1_hit ?? false,
      tp2Hit: signalData.tp2_hit ?? false,
      tp3Hit: signalData.tp3_hit ?? false,
      notes: signalData.notes ?? null,
      chartImageUrl: signalData.chart_image_url ?? null,
      confidenceScore: signalData.confidence_score ?? null,
      takenCount: signalData.taken_count ?? 0,
      externalId: signalData.external_id ?? null,
      symbol: signalData.symbol ?? null,
      closedAtMs: signalData.closed_at ? new Date(signalData.closed_at).getTime() : null,
    });
  },

  update: async (id: string, updates: any): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.signals.update, {
      id: id as any,
      currencyPair: updates.currency_pair ?? null,
      symbol: updates.symbol ?? null,
      direction: updates.direction,
      marketExecution: updates.market_execution ?? null,
      entryPrice: updates.entry_price ?? null,
      stopLoss: updates.stop_loss ?? null,
      takeProfit1: updates.take_profit_1 ?? null,
      takeProfit2: updates.take_profit_2 ?? null,
      takeProfit3: updates.take_profit_3 ?? null,
      takeProfit: updates.take_profit ?? null,
      pipsToSl: updates.pips_to_sl ?? null,
      pipsToTp1: updates.pips_to_tp1 ?? null,
      pipsToTp2: updates.pips_to_tp2 ?? null,
      pipsToTp3: updates.pips_to_tp3 ?? null,
      analysis: updates.analysis ?? null,
      timeframe: updates.timeframe ?? null,
      expiresAtMs: updates.expires_at ? new Date(updates.expires_at).getTime() : null,
      status: updates.status,
      result: updates.result ?? null,
      tp1Hit: updates.tp1_hit,
      tp2Hit: updates.tp2_hit,
      tp3Hit: updates.tp3_hit,
      notes: updates.notes ?? null,
      chartImageUrl: updates.chart_image_url ?? null,
      confidenceScore: updates.confidence_score ?? null,
      takenCount: updates.taken_count,
      closedAtMs: updates.closed_at ? new Date(updates.closed_at).getTime() : null,
    });
  },

  delete: async (id: string): Promise<void> => {
    await getAuthenticatedConvexClient().mutation(convexApi.signals.remove, { id: id as any });
  },
};

// Trading Journal API
export const tradesApi = {
  getAll: async (query?: { status?: string }): Promise<any[]> => {
    const userId = getStoredConvexAuthToken() ? null : null;
    const client = getAuthenticatedConvexClient();
    const viewer = await client.query(convexApi.users.viewer, {});
    return await client.query(convexApi.tradingJournal.listForUser, {
      userId: viewer.id,
      status: query?.status ?? null,
      limit: 300,
    });
  },

  getStatistics: async (): Promise<any> => {
    const trades = await tradesApi.getAll();
    const closedTrades = trades.filter((trade: any) => trade.status === 'closed');
    const pnlValues = closedTrades.map((trade: any) => Number(trade.pnl ?? 0));
    const wins = pnlValues.filter((value: number) => value > 0).length;
    const losses = pnlValues.filter((value: number) => value < 0).length;
    return {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      wins,
      losses,
      winRate: closedTrades.length ? (wins / closedTrades.length) * 100 : 0,
      totalPnl: pnlValues.reduce((sum: number, value: number) => sum + value, 0),
    };
  },

  getOne: async (id: string): Promise<any> => {
    const trades = await tradesApi.getAll();
    return trades.find((trade: any) => trade._id === id || trade.id === id) ?? null;
  },

  create: async (tradeData: any): Promise<any> => {
    const client = getAuthenticatedConvexClient();
    const viewer = await client.query(convexApi.users.viewer, {});
    return await client.mutation(convexApi.tradingJournal.createEntry, {
      userId: viewer.id,
      externalId: tradeData.externalId ?? null,
      pair: tradeData.pair || tradeData.symbol || 'JOURNAL',
      direction: tradeData.direction === 'sell' || tradeData.direction === 'short' ? tradeData.direction : 'buy',
      entryPrice: tradeData.entry_price ?? null,
      exitPrice: tradeData.exit_price ?? null,
      stopLoss: tradeData.stop_loss ?? null,
      takeProfit: tradeData.take_profit ?? null,
      riskPercent: tradeData.risk_percent ?? null,
      riskAmount: tradeData.risk_amount ?? null,
      positionSize: tradeData.position_size ?? null,
      pnl: tradeData.pnl ?? tradeData.profit_loss ?? null,
      pnlPercent: tradeData.pnl_percent ?? tradeData.profit_loss_percentage ?? null,
      status: tradeData.status ?? 'open',
      notes: tradeData.notes ?? null,
      journalType: tradeData.journal_type ?? null,
      richContent: tradeData.rich_content ?? null,
      images: tradeData.images ?? null,
      links: tradeData.links ?? null,
      screenshots: tradeData.screenshot_urls ?? tradeData.screenshots ?? null,
      marketCondition: tradeData.market_condition ?? null,
      tags: tradeData.tags ?? null,
      entryDateMs: tradeData.entry_date ? new Date(tradeData.entry_date).getTime() : tradeData.trade_date ? new Date(tradeData.trade_date).getTime() : null,
      exitDateMs: tradeData.exit_date ? new Date(tradeData.exit_date).getTime() : null,
    });
  },

  update: async (id: string, updates: any): Promise<any> => {
    const client = getAuthenticatedConvexClient();
    const viewer = await client.query(convexApi.users.viewer, {});
    return await client.mutation(convexApi.tradingJournal.updateEntry, {
      id: id as any,
      userId: viewer.id,
      pair: updates.pair ?? updates.symbol ?? null,
      direction: updates.direction,
      entryPrice: updates.entry_price ?? null,
      exitPrice: updates.exit_price ?? null,
      stopLoss: updates.stop_loss ?? null,
      takeProfit: updates.take_profit ?? null,
      riskPercent: updates.risk_percent ?? null,
      riskAmount: updates.risk_amount ?? null,
      positionSize: updates.position_size ?? null,
      pnl: updates.pnl ?? updates.profit_loss ?? null,
      pnlPercent: updates.pnl_percent ?? updates.profit_loss_percentage ?? null,
      status: updates.status,
      notes: updates.notes ?? null,
      journalType: updates.journal_type ?? null,
      richContent: updates.rich_content ?? null,
      images: updates.images ?? null,
      links: updates.links ?? null,
      screenshots: updates.screenshot_urls ?? updates.screenshots ?? null,
      marketCondition: updates.market_condition ?? null,
      tags: updates.tags ?? null,
      entryDateMs: updates.entry_date ? new Date(updates.entry_date).getTime() : null,
      exitDateMs: updates.exit_date ? new Date(updates.exit_date).getTime() : null,
    });
  },

  delete: async (id: string): Promise<void> => {
    const client = getAuthenticatedConvexClient();
    const viewer = await client.query(convexApi.users.viewer, {});
    await client.mutation(convexApi.tradingJournal.deleteEntry, { id: id as any, userId: viewer.id });
  },
};

// Subscription API
export const subscriptionApi = {
  getDetails: async (): Promise<any> => {
    const { data } = await api.get('/payments/subscription');
    return data;
  },

  getEntitlements: async (): Promise<any> => {
    const { data } = await api.get('/payments/entitlements');
    return data;
  },

  checkFeatureAccess: async (feature: string): Promise<boolean> => {
    const { data } = await api.get(`/payments/feature-access/${feature}`);
    return data.hasAccess;
  },

  verifyPayment: async (payload: {
    userId: string;
    reference: string;
    tier: string;
    amount: number;
    currency: string;
    expiresAt: string;
    paystack_customer_code?: string;
    metadata?: any;
  }): Promise<any> => {
    const { data } = await serverlessApi.post('/api/verify-payment', payload);
    return data;
  },

  restorePurchase: async (payload: { userId: string }): Promise<any> => {
    const { data } = await serverlessApi.post('/api/restore-purchase', payload, {
      headers: {
        Authorization: `Bearer ${getStoredConvexAuthToken() ?? ''}`,
      },
    });
    return data;
  },
};

// Push Notifications API
export const notificationsApi = {
  // Get user's push subscriptions
  getSubscriptions: async (): Promise<any[]> => {
    return await getAuthenticatedConvexClient().query(convexApi.admin.listPushSubscriptions, {});
  },

  // Create a new push subscription
  subscribe: async (subscriptionData: {
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
  }): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.admin.subscribePush, {
      endpoint: subscriptionData.endpoint,
      p256dhKey: subscriptionData.p256dh_key,
      authKey: subscriptionData.auth_key,
    });
  },

  // Delete a push subscription
  unsubscribe: async (id: string): Promise<void> => {
    await getAuthenticatedConvexClient().mutation(convexApi.admin.unsubscribePush, {
      id: id as any,
    });
  },

  // Get user's notifications
  getNotifications: async (): Promise<any[]> => {
    return [];
  },

  // Queue a push notification (admin only)
  queueNotification: async (notificationData: {
    user_id?: string;
    title: string;
    body: string;
    tag?: string;
    data?: any;
  }): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.admin.queueNotification, {
      userId: notificationData.user_id ?? null,
      title: notificationData.title,
      body: notificationData.body,
      tag: notificationData.tag ?? null,
      data: notificationData.data ?? null,
    });
  },

  // Queue an email (admin only)
  queueEmail: async (emailData: {
    user_id?: string;
    subject: string;
    body: string;
    template?: string;
    recipient_email?: string;
    html?: string;
    from_email?: string;
    data?: any;
  }): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.notifications.queueEmail, {
      userId: emailData.user_id ?? null,
      recipientEmail: emailData.recipient_email ?? null,
      subject: emailData.subject,
      body: emailData.body,
      html: emailData.html ?? null,
      fromEmail: emailData.from_email ?? null,
      scheduledForMs: null,
      data: {
        ...(emailData.data ?? {}),
        template: emailData.template ?? null,
      },
    });
  },
};

// App Updates API (Admin only)
export const appUpdatesApi = {
  getAll: async (): Promise<any[]> => {
    try {
      return await convexClient.query(convexApi.admin.listAppUpdates, {});
    } catch (error) {
      logger.warn('Failed to fetch app updates from Convex');
      return [];
    }
  },

  create: async (updateData: { title: string; description: string }): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.admin.createAppUpdate, updateData);
  },

  delete: async (id: string): Promise<void> => {
    await getAuthenticatedConvexClient().mutation(convexApi.admin.deleteAppUpdate, { id: id as any });
  },

  update: async (id: string, updates: { is_active?: boolean; title?: string; description?: string }): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.admin.updateAppUpdate, {
      id: id as any,
      isActive: updates.is_active,
      title: updates.title ?? null,
      description: updates.description ?? null,
    });
  },
};

// Admin API
export const adminApi = {
  // Check if current user has admin role
  hasRole: async (role: string = 'admin'): Promise<boolean> => {
    try {
      const { data } = await api.get('/auth/role', { params: { role } });
      return data.hasRole;
    } catch (error) {
      return false;
    }
  },
};

// Users API
export const usersApi = {
  getProfile: async (): Promise<any> => {
    return await getAuthenticatedConvexClient().query(convexApi.users.viewerProfile, {});
  },

  updateProfile: async (updates: any): Promise<any> => {
    return await getAuthenticatedConvexClient().mutation(convexApi.users.updateViewerProfile, {
      fullName: updates.full_name ?? null,
      avatarUrl: updates.avatar_url ?? null,
    });
  },
};

export default api;
