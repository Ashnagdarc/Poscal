import axios, { type AxiosInstance } from 'axios';
import { api as convexApi } from '../../convex/_generated/api';
import { convexClient, createAuthenticatedConvexClient } from '@/lib/convexClient';
import { logger } from '@/lib/logger';

// Use relative path for Vercel serverless functions, fallback to external API for other endpoints
// In development, use /api proxy to localhost:3001; in production, use external API
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://api.poscalfx.com');

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
      const hasLegacyToken = !!localStorage.getItem('auth_token');
      if (hasLegacyToken && error.response?.status === 401) {
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

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
}

export interface AuthResponse {
  user: User;
  token: string;
}

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

const parseSignalsError = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const apiMessage = err.response?.data?.message as string | undefined;

    if (status === 502 || status === 503 || status === 504) {
      return 'Signals service is temporarily unavailable.';
    }

    if (!err.response) {
      return 'Unable to reach the signals service.';
    }

    return apiMessage || `Signals request failed (${status ?? 'unknown'})`;
  }

  return err instanceof Error ? err.message : 'Failed to load signals';
};

export const featureFlagApi = {
  getPaidLock: async (): Promise<boolean> => {
    return await convexClient.query(convexApi.admin.getPaidLock, {});
  },

  setPaidLock: async (enabled: boolean, authToken?: string | null): Promise<boolean> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.setPaidLock, { enabled });
  },
};

export const systemApi = {
  getIngestorHealth: async (authToken?: string | null): Promise<{
    recent_401_count: number;
    last_401_at: string | null;
    last_flush_at: string | null;
    backend_reachable: boolean;
  }> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    return await createAuthenticatedConvexClient(authToken).query(convexApi.admin.getIngestorHealth, {});
  },
};

export const adminUsersApi = {
  getAll: async (authToken?: string | null): Promise<Array<{
    id: string;
    full_name: string | null;
    email: string;
    is_admin: boolean;
    account_type: string | null;
    created_at: string;
    subscription_tier: string;
    subscription_end: string | null;
  }>> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    return await createAuthenticatedConvexClient(authToken).query(convexApi.admin.listUsers, {});
  },
};

export const authApi = {
  signUp: async (email: string, password: string, fullName?: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/signup', {
      email,
      password,
      full_name: fullName,
    });
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  signIn: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/signin', {
      email,
      password,
    });
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  signOut: async (): Promise<void> => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  getCurrentUser: async (): Promise<any> => {
    const { data } = await api.post('/auth/me');
    return data;
  },

  validateToken: async (token: string): Promise<any> => {
    const { data } = await api.post('/auth/validate', { token });
    return data;
  },

  requestReset: async (email: string): Promise<{ success: boolean }> => {
    const { data } = await api.post('/auth/request-reset', { email });
    return data;
  },

  resetPassword: async (email: string, token: string, new_password: string): Promise<{ success: boolean }> => {
    const { data } = await api.post('/auth/reset-password', { email, token, new_password });
    return data;
  },
};

// Trading Signals API
export const signalsApi = {
  getAll: async (query?: { status?: string; limit?: number }): Promise<any[]> => {
    try {
      return await convexClient.query(convexApi.signals.list, {
        status: query?.status ?? null,
        currencyPair: (query as any)?.currency_pair ?? null,
        result: (query as any)?.result ?? null,
        date: (query as any)?.date ?? null,
      });
    } catch (error) {
      throw new Error(parseSignalsError(error));
    }
  },

  getOne: async (id: string): Promise<any> => {
    try {
      const rows = await convexClient.query(convexApi.signals.list, {
        status: null,
        currencyPair: null,
        result: null,
        date: null,
      });
      return rows.find((row: any) => row.id === id) ?? null;
    } catch (error) {
      throw new Error(parseSignalsError(error));
    }
  },

  create: async (signalData: any, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin to create signals.');
    }

    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.signals.create, {
      externalId: signalData.external_id ?? null,
      currencyPair: signalData.currency_pair,
      symbol: signalData.symbol ?? null,
      direction: signalData.direction,
      marketExecution: signalData.market_execution ?? null,
      entryPrice: Number(signalData.entry_price),
      stopLoss: Number(signalData.stop_loss),
      takeProfit1: Number(signalData.take_profit_1),
      takeProfit2: signalData.take_profit_2 ?? null,
      takeProfit3: signalData.take_profit_3 ?? null,
      takeProfit: signalData.take_profit ?? null,
      pipsToSl: Number(signalData.pips_to_sl),
      pipsToTp1: Number(signalData.pips_to_tp1),
      pipsToTp2: signalData.pips_to_tp2 ?? null,
      pipsToTp3: signalData.pips_to_tp3 ?? null,
      analysis: signalData.analysis ?? null,
      timeframe: signalData.timeframe ?? null,
      expiresAtMs: signalData.expires_at ? new Date(signalData.expires_at).getTime() : null,
      status: signalData.status ?? 'active',
      result: signalData.result ?? null,
      tp1Hit: Boolean(signalData.tp1_hit),
      tp2Hit: Boolean(signalData.tp2_hit),
      tp3Hit: Boolean(signalData.tp3_hit),
      notes: signalData.notes ?? null,
      chartImageUrl: signalData.chart_image_url ?? null,
      confidenceScore: signalData.confidence_score ?? null,
      takenCount: Number(signalData.taken_count ?? 0),
      closedAtMs: signalData.closed_at ? new Date(signalData.closed_at).getTime() : null,
    });
  },

  update: async (id: string, updates: any, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin to update signals.');
    }

    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.signals.update, {
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

  delete: async (id: string, authToken?: string | null): Promise<void> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin to delete signals.');
    }

    await createAuthenticatedConvexClient(authToken).mutation(convexApi.signals.remove, {
      id: id as any,
    });
  },
};

// Trading Journal API
export const tradesApi = {
  getAll: async (query?: { status?: string }): Promise<any[]> => {
    const { data } = await api.get('/trades', { params: query });
    return data;
  },

  getStatistics: async (): Promise<any> => {
    const { data } = await api.get('/trades/statistics');
    return data;
  },

  getOne: async (id: string): Promise<any> => {
    const { data } = await api.get(`/trades/${id}`);
    return data;
  },

  create: async (tradeData: any): Promise<any> => {
    const { data } = await api.post('/trades', tradeData);
    return data;
  },

  update: async (id: string, updates: any): Promise<any> => {
    const { data } = await api.put(`/trades/${id}`, updates);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/trades/${id}`);
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

  restorePurchase: async (payload: { userId: string }, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in to restore purchases.');
    }
    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.restoreLatestPaymentForUser, {
      userId: payload.userId,
    });
  },
};

// Push Notifications API
export const notificationsApi = {
  // Get user's push subscriptions
  getSubscriptions: async (authToken?: string | null): Promise<any[]> => {
    if (!authToken) {
      return [];
    }
    return await createAuthenticatedConvexClient(authToken).query(convexApi.admin.listPushSubscriptions, {});
  },

  // Create a new push subscription
  subscribe: async (subscriptionData: {
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
  }, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in to enable push notifications.');
    }
    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.subscribePush, {
      endpoint: subscriptionData.endpoint,
      p256dhKey: subscriptionData.p256dh_key,
      authKey: subscriptionData.auth_key,
    });
  },

  // Delete a push subscription
  unsubscribe: async (id: string, authToken?: string | null): Promise<void> => {
    if (!authToken) {
      throw new Error('You must be signed in to disable push notifications.');
    }
    await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.unsubscribePush, {
      id: id as any,
      endpoint: null,
    });
  },

  // Get user's notifications
  getNotifications: async (): Promise<any[]> => {
    const { data } = await api.get('/notifications/push');
    return data;
  },

  // Queue a push notification (admin only)
  queueNotification: async (notificationData: {
    user_id?: string;
    title: string;
    body: string;
    tag?: string;
    data?: any;
  }, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.queueNotification, {
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
    recipient_email?: string;
    subject: string;
    body: string;
    html?: string;
    from_email?: string;
    scheduled_for_ms?: number | null;
    data?: any;
  }, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.notifications.queueEmail, {
      userId: emailData.user_id ?? null,
      recipientEmail: emailData.recipient_email ?? null,
      subject: emailData.subject,
      body: emailData.body,
      html: emailData.html ?? null,
      fromEmail: emailData.from_email ?? null,
      scheduledForMs: emailData.scheduled_for_ms ?? null,
      data: emailData.data ?? null,
    });
  },
};

// App Updates API (Admin only)
export const appUpdatesApi = {
  getAll: async (): Promise<any[]> => {
    return await convexClient.query(convexApi.admin.listAppUpdates, {});
  },

  create: async (updateData: { title: string; description: string }, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.createAppUpdate, updateData);
  },

  delete: async (id: string, authToken?: string | null): Promise<void> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.deleteAppUpdate, {
      id: id as any,
    });
  },

  update: async (id: string, updates: { is_active?: boolean; title?: string; description?: string }, authToken?: string | null): Promise<any> => {
    if (!authToken) {
      throw new Error('You must be signed in as an admin.');
    }
    return await createAuthenticatedConvexClient(authToken).mutation(convexApi.admin.updateAppUpdate, {
      id: id as any,
      title: updates.title ?? null,
      description: updates.description ?? null,
      isActive: updates.is_active,
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
    const { data } = await api.get('/auth/me');
    // /auth/me returns { user, profile, roles } so extract profile
    return data.profile || data;
  },

  updateProfile: async (updates: any): Promise<any> => {
    const { data } = await api.put('/auth/profile', updates);
    // Response is the updated profile directly
    return data;
  },
};

// Uploads API (avatars, trade screenshots)
export const uploadsApi = {
  uploadAvatar: async (file: File): Promise<any> => {
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read avatar file'));
      reader.readAsDataURL(file);
    });
    return { url };
  },

  deleteAvatar: async (pathOrId: string): Promise<void> => {
    void pathOrId;
  },

  uploadTradeScreenshot: async (tradeId: string, file: File): Promise<any> => {
    void tradeId;
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read screenshot file'));
      reader.readAsDataURL(file);
    });
    return { url };
  },

  deleteTradeScreenshot: async (screenshotId: string): Promise<void> => {
    void screenshotId;
  },
};

export default api;
