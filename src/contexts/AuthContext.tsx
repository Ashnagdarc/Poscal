import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi, User } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
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
    } catch (error: any) {
      console.error('[auth] Sign up error:', error);
      return { error: error.response?.data?.message || error.message || 'Sign up failed' };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { user, token } = await authApi.signIn(email, password);
      setUser(user);
      setSession({ access_token: token });
      return { error: null };
    } catch (error: any) {
      console.error('[auth] Sign in error:', error);
      return { error: error.response?.data?.message || error.message || 'Sign in failed' };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authApi.requestReset(email);
      return { error: null };
    } catch (error: any) {
      console.error('[auth] Reset password error:', error);
      return { error: error.response?.data?.message || error.message || 'Failed to request password reset' };
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
