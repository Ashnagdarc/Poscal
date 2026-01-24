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
};

export default api;
