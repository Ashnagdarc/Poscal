import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.poscalfx.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

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

const parseFeatureFlagError = (err: any) => {
  const apiMessage = err?.response?.data?.message;
  const generic = err?.message || 'Failed to reach feature flag API';
  return apiMessage || generic;
};

export const featureFlagApi = {
  getPaidLock: async (): Promise<boolean> => {
    try {
      const { data } = await api.get<FeatureFlagResponse>('/feature-flag');
      if (!data?.success) {
        throw new Error(data?.message || 'Unable to read paid lock flag');
      }
      return !!data.enabled;
    } catch (err) {
      throw new Error(parseFeatureFlagError(err));
    }
  },

  setPaidLock: async (enabled: boolean): Promise<boolean> => {
    try {
      const { data } = await api.post<FeatureFlagResponse>('/feature-flag', { enabled });
      if (!data?.success) {
        throw new Error(data?.message || 'Unable to update paid lock flag');
      }
      return !!data.enabled;
    } catch (err) {
      throw new Error(parseFeatureFlagError(err));
    }
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

  requestReset: async (email: string): Promise<{ token: string }> => {
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
    const { data } = await api.get('/signals', { params: query });
    return data;
  },

  getOne: async (id: string): Promise<any> => {
    const { data } = await api.get(`/signals/${id}`);
    return data;
  },

  getUserTakenTrades: async (): Promise<any[]> => {
    const { data } = await api.get('/signals/taken');
    return data;
  },

  create: async (signalData: any): Promise<any> => {
    const { data } = await api.post('/signals', signalData);
    return data;
  },

  update: async (id: string, updates: any): Promise<any> => {
    const { data } = await api.put(`/signals/${id}`, updates);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/signals/${id}`);
  },

  takeSignal: async (id: string, takeData: { account_id: string; risk_percent: number }): Promise<any> => {
    const { data } = await api.post(`/signals/${id}/take`, takeData);
    return data;
  },

  updateTakenTrade: async (id: string, status: string, result_pnl?: number): Promise<any> => {
    const { data } = await api.put(`/signals/taken/${id}`, { status, result_pnl });
    return data;
  },
};

// Trading Accounts API
export const accountsApi = {
  getAll: async (): Promise<any[]> => {
    const { data } = await api.get('/accounts');
    return data;
  },

  getOne: async (id: string): Promise<any> => {
    const { data } = await api.get(`/accounts/${id}`);
    return data;
  },

  create: async (accountData: any): Promise<any> => {
    const { data } = await api.post('/accounts', accountData);
    return data;
  },

  update: async (id: string, updates: any): Promise<any> => {
    const { data } = await api.put(`/accounts/${id}`, updates);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/accounts/${id}`);
  },

  updateBalance: async (id: string, balance: number): Promise<any> => {
    const { data } = await api.put(`/accounts/${id}/balance`, { balance });
    return data;
  },
};

// Trading Journal API
export const tradesApi = {
  getAll: async (query?: { account_id?: string; status?: string }): Promise<any[]> => {
    const { data } = await api.get('/trades', { params: query });
    return data;
  },

  getStatistics: async (accountId?: string): Promise<any> => {
    const { data } = await api.get('/trades/statistics', { params: { account_id: accountId } });
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

  checkFeatureAccess: async (feature: string): Promise<boolean> => {
    const { data } = await api.get(`/payments/feature-access/${feature}`);
    return data.hasAccess;
  },
};

// Push Notifications API
export const notificationsApi = {
  // Get user's push subscriptions
  getSubscriptions: async (): Promise<any[]> => {
    const { data } = await api.get('/notifications/push/subscriptions');
    return data;
  },

  // Create a new push subscription
  subscribe: async (subscriptionData: {
    endpoint: string;
    p256dh_key: string;
    auth_key: string;
    user_agent?: string;
  }): Promise<any> => {
    const { data } = await api.post('/notifications/push/subscribe', subscriptionData);
    return data;
  },

  // Delete a push subscription
  unsubscribe: async (id: string): Promise<void> => {
    await api.delete(`/notifications/push/subscriptions/${id}`);
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
  }): Promise<any> => {
    const { data } = await api.post('/notifications/push', notificationData);
    return data;
  },

  // Queue an email (admin only)
  queueEmail: async (emailData: {
    user_id?: string;
    subject: string;
    body: string;
    template?: string;
  }): Promise<any> => {
    const { data } = await api.post('/notifications/email', emailData);
    return data;
  },
};

// App Updates API (Admin only)
export const appUpdatesApi = {
  getAll: async (): Promise<any[]> => {
    // For now, use a placeholder endpoint - backend needs to implement this
    // TODO: Backend needs /system/updates controller
    try {
      const { data } = await api.get('/system/updates');
      return data;
    } catch (error) {
      console.warn('App updates endpoint not implemented yet');
      return [];
    }
  },

  create: async (updateData: { title: string; description: string }): Promise<any> => {
    const { data } = await api.post('/system/updates', updateData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/system/updates/${id}`);
  },

  update: async (id: string, updates: { is_active?: boolean; title?: string; description?: string }): Promise<any> => {
    const { data } = await api.patch(`/system/updates/${id}`, updates);
    return data;
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
    return data;
  },

  updateProfile: async (updates: any): Promise<any> => {
    const { data } = await api.put('/auth/profile', updates);
    return data;
  },
};

// Uploads API (avatars, trade screenshots)
export const uploadsApi = {
  uploadAvatar: async (file: File): Promise<any> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post('/auth/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  deleteAvatar: async (pathOrId: string): Promise<void> => {
    await api.delete('/auth/avatar', { params: { id: pathOrId } });
  },

  uploadTradeScreenshot: async (tradeId: string, file: File): Promise<any> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post(`/trades/${tradeId}/screenshots`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  deleteTradeScreenshot: async (screenshotId: string): Promise<void> => {
    await api.delete(`/trades/screenshots/${screenshotId}`);
  },
};

export default api;
