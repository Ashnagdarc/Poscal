import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';
import { authApi, User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount.
    // TODO: Migrate to httpOnly cookies to prevent XSS token theft (requires backend Set-Cookie changes).
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setSession({ access_token: token });
      } catch (error) {
        console.error('[auth] Error parsing stored user:', error);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const { user, token } = await authApi.signUp(email, password, fullName);
      setUser(user);
      setSession({ access_token: token });
      return { error: null };
    } catch (error: unknown) {
      console.error('[auth] Sign up error:', error);
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : 'Sign up failed';
      return { error: msg };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { user, token } = await authApi.signIn(email, password);
      setUser(user);
      setSession({ access_token: token });
      return { error: null };
    } catch (error: unknown) {
      console.error('[auth] Sign in error:', error);
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : 'Sign in failed';
      return { error: msg };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authApi.requestReset(email);
      return { error: null };
    } catch (error: unknown) {
      console.error('[auth] Reset password error:', error);
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : 'Failed to request password reset';
      return { error: msg };
    }
  };

  const signOut = async () => {
    await authApi.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isConfigured: true, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
