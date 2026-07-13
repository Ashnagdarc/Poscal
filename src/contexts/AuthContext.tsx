import { createContext, useContext, ReactNode } from 'react';
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

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

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  const user: User | null = viewer
    ? {
        id: viewer.id,
        email: viewer.email ?? "",
        full_name: viewer.fullName ?? null,
        email_verified: viewer.emailVerified,
      }
    : null;

  const session = user ? { access_token: "convex-auth" } : null;
  const loading = authLoading || (isAuthenticated && viewer === undefined);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      await convexSignIn("password", {
        flow: "signUp",
        email,
        password,
        ...(fullName?.trim() ? { name: fullName.trim() } : {}),
      });
      return { error: null };
    } catch (error: unknown) {
      console.error('[auth] Sign up error:', error);
      const msg = error instanceof Error ? error.message : 'Sign up failed';
      return { error: msg };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await convexSignIn("password", {
        flow: "signIn",
        email,
        password,
      });
      return { error: null };
    } catch (error: unknown) {
      console.error('[auth] Sign in error:', error);
      const msg = error instanceof Error ? error.message : 'Sign in failed';
      return { error: msg };
    }
  };

  const resetPassword = async (email: string) => {
    void email;
    return { error: 'Password reset is not configured yet.' };
  };

  const signOut = async () => {
    await convexSignOut();
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
