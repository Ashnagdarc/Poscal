import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAuthToken, useConvexAuth } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { clearLegacyAuthMirrors, setConvexAuthTokenMirror } from '@/lib/authTokenStore';
import { syncSharedConvexHttpAuth } from '@/lib/convexClient';

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  isConfigured: boolean;
  /** Subscription fields from the same `users.viewer` query (no extra fetch). */
  viewerSubscription: ViewerSubscription | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  verifyPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<{ error: string | null }>;
  passwordResetAvailable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
}

export interface ViewerSubscription {
  paymentStatus: string;
  subscriptionTier: string;
  expiresAtMs: number | null;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const authToken = useAuthToken();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const consumeRateLimit = useMutation(api.authRateLimit.consume);
  const resetRateLimit = useMutation(api.authRateLimit.reset);

  const user: User | null = viewer
    ? {
        id: viewer.id,
        email: viewer.email ?? "",
        full_name: viewer.fullName ?? null,
        avatar_url: viewer.avatarUrl ?? null,
        email_verified: viewer.emailVerified,
      }
    : null;

  const viewerSubscription: ViewerSubscription | null = viewer
    ? {
        paymentStatus: viewer.paymentStatus ?? "free",
        subscriptionTier: viewer.subscriptionTier ?? "free",
        expiresAtMs: viewer.subscriptionExpiresAtMs ?? null,
      }
    : null;

  const session = user ? { access_token: "convex-auth" } : null;
  const loading = authLoading || (isAuthenticated && viewer === undefined);

  // Mirror JWT in memory + sync shared ConvexHttpClient for lib helpers that don't use React hooks.
  // Do not persist a second localStorage copy (P-028).
  useEffect(() => {
    setConvexAuthTokenMirror(authToken ?? null);
    syncSharedConvexHttpAuth(authToken ?? null);
    if (!authToken) {
      clearLegacyAuthMirrors();
    }
  }, [authToken]);

  const enforceRateLimit = async (
    action: "signIn" | "signUp" | "reset",
    email: string,
  ): Promise<string | null> => {
    try {
      const result = await consumeRateLimit({ action, email });
      if (!result.ok) {
        return result.message ?? "Too many attempts. Please wait and try again.";
      }
      return null;
    } catch (error: unknown) {
      console.error("[auth] Rate limit check failed", error);
      // Fail closed on rate-limit infrastructure errors to avoid abuse windows.
      return "Unable to verify rate limits. Please try again shortly.";
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const limited = await enforceRateLimit("signUp", email);
    if (limited) return { error: limited };

    try {
      await convexSignIn("password", {
        flow: "signUp",
        email,
        password,
        ...(fullName?.trim() ? { name: fullName.trim() } : {}),
      });
      await resetRateLimit({ action: "signUp", email });
      return { error: null };
    } catch (error: unknown) {
      console.error('[auth] Sign up error:', error);
      return { error: toSafeAuthErrorMessage(error, "Sign up failed") };
    }
  };

  const signIn = async (email: string, password: string) => {
    const limited = await enforceRateLimit("signIn", email);
    if (limited) return { error: limited };

    try {
      await convexSignIn("password", {
        flow: "signIn",
        email,
        password,
      });
      await resetRateLimit({ action: "signIn", email });
      return { error: null };
    } catch (error: unknown) {
      console.error('[auth] Sign in error:', error);
      return { error: toSafeAuthErrorMessage(error, "Sign in failed") };
    }
  };

  const resetPassword = async (email: string) => {
    const limited = await enforceRateLimit("reset", email);
    if (limited) return { error: limited };

    try {
      await convexSignIn("password", {
        flow: "reset",
        email,
      });
      return { error: null };
    } catch (error: unknown) {
      console.error("[auth] Password reset request error:", error);
      return { error: toSafeAuthErrorMessage(error, "Could not start password reset") };
    }
  };

  const verifyPasswordReset = async (
    email: string,
    code: string,
    newPassword: string,
  ) => {
    try {
      await convexSignIn("password", {
        flow: "reset-verification",
        email,
        code,
        newPassword,
      });
      await resetRateLimit({ action: "reset", email });
      await resetRateLimit({ action: "signIn", email });
      return { error: null };
    } catch (error: unknown) {
      console.error("[auth] Password reset verify error:", error);
      return { error: toSafeAuthErrorMessage(error, "Could not reset password") };
    }
  };

  const signOut = async () => {
    await convexSignOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: true,
        viewerSubscription,
        signUp,
        signIn,
        signOut,
        resetPassword,
        verifyPasswordReset,
        passwordResetAvailable: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Map Convex Auth internals to stable user-facing messages (AIS-008 / ETH-001). */
function toSafeAuthErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toLowerCase();

  if (
    normalized.includes("invalidsecret")
    || normalized.includes("invalid credentials")
    || normalized.includes("invalid password")
    || normalized.includes("could not find")
    || normalized.includes("incorrect")
  ) {
    return "Invalid email or password";
  }

  if (normalized.includes("already exists") || normalized.includes("already in use")) {
    return "An account with this email already exists";
  }

  if (normalized.includes("email not confirmed") || normalized.includes("not verified")) {
    return "Please check your email to confirm your account";
  }

  if (
    normalized.includes("too many")
    || normalized.includes("rate")
    || normalized.includes("attempts")
  ) {
    return "Too many attempts. Please wait and try again.";
  }

  if (normalized.includes("could not send") || normalized.includes("not configured")) {
    return "Password reset email could not be sent. Please try again later.";
  }

  if (normalized.includes("password must be") || normalized.includes("invalid password.")) {
    return "Password must be at least 8 characters.";
  }

  if (normalized.includes("invalid code") || normalized.includes("could not verify")) {
    return "Invalid or expired reset code. Request a new one.";
  }

  // Never surface stacks, file paths, or Convex request IDs to the UI.
  if (
    raw.includes("\n")
    || raw.includes(" at ")
    || raw.includes("Request ID")
    || raw.includes("@convex")
    || raw.includes(".ts:")
    || raw.includes(".js:")
    || raw.length > 160
  ) {
    return fallback;
  }

  return raw.trim() || fallback;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
