import { useAuthActions } from "@convex-dev/auth/react";
import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAuthToken, useConvexAuth } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { clearLegacyAuthMirrors, setConvexAuthTokenMirror } from '@/lib/authTokenStore';
import { syncSharedConvexHttpAuth } from '@/lib/convexClient';
import { clearSensitiveLocalStorage } from '@/lib/privacyCleanup';

export type AuthResult = {
  error: string | null;
  /** True when Convex Auth issued a session (email already verified or just verified). */
  signedIn: boolean;
};

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  isConfigured: boolean;
  /** Subscription fields from the same `users.viewer` query (no extra fetch). */
  viewerSubscription: ViewerSubscription | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  verifyPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<{ error: string | null }>;
  verifyEmail: (email: string, code: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
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

  const signUp = async (email: string, password: string, fullName?: string): Promise<AuthResult> => {
    try {
      const result = await convexSignIn("password", {
        flow: "signUp",
        email,
        password,
        ...(fullName?.trim() ? { name: fullName.trim() } : {}),
      });
      return { error: null, signedIn: Boolean(result.signingIn) };
    } catch (error: unknown) {
      console.error('[auth] Sign up error:', error);
      return { error: toSafeAuthErrorMessage(error, "Sign up failed"), signedIn: false };
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const result = await convexSignIn("password", {
        flow: "signIn",
        email,
        password,
      });
      return { error: null, signedIn: Boolean(result.signingIn) };
    } catch (error: unknown) {
      console.error('[auth] Sign in error:', error);
      return {
        error: toSafeAuthErrorMessage(error, "Invalid email or password"),
        signedIn: false,
      };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await convexSignIn("password", {
        flow: "reset",
        email,
      });
      return { error: null };
    } catch (error: unknown) {
      console.error("[auth] Password reset request error:", error);
      // Avoid account enumeration: success-like framing when possible, but network/config still surfaces.
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
      return { error: null };
    } catch (error: unknown) {
      console.error("[auth] Password reset verify error:", error);
      return { error: toSafeAuthErrorMessage(error, "Could not reset password") };
    }
  };

  const verifyEmail = async (email: string, code: string): Promise<AuthResult> => {
    try {
      const result = await convexSignIn("password", {
        flow: "email-verification",
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });
      return { error: null, signedIn: Boolean(result.signingIn) };
    } catch (error: unknown) {
      console.error("[auth] Email verification error:", error);
      return {
        error: toSafeAuthErrorMessage(error, "Invalid or expired verification code"),
        signedIn: false,
      };
    }
  };

  const resendVerification = async (email: string) => {
    try {
      // email-verification without code resends OTP (Convex Auth Password + verify provider).
      await convexSignIn("password", {
        flow: "email-verification",
        email: email.trim().toLowerCase(),
      });
      return { error: null };
    } catch (error: unknown) {
      console.error("[auth] Resend verification error:", error);
      // Neutral messaging where possible (AP enumeration-safe).
      return {
        error: toSafeAuthErrorMessage(
          error,
          "If an account needs verification, a code was sent.",
        ),
      };
    }
  };

  const signOut = async () => {
    try {
      await convexSignOut();
    } finally {
      // Clear journal notes / progress residue on shared devices (AP-009 / MC-020).
      clearSensitiveLocalStorage();
      clearLegacyAuthMirrors();
      setConvexAuthTokenMirror(null);
      syncSharedConvexHttpAuth(null);
    }
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
        verifyEmail,
        resendVerification,
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

  // Convex Auth / Password provider variants for wrong credentials
  if (
    normalized.includes("invalidsecret")
    || normalized.includes("invalid secret")
    || normalized.includes("invalid credentials")
    || normalized.includes("invalid account id")
    || normalized.includes("invalid password")
    || normalized.includes("could not find")
    || normalized.includes("incorrect")
    || normalized.includes("no account")
    || normalized.includes("account not found")
    || normalized.includes("user not found")
    || normalized.includes("autherror")
    || normalized.includes("failed to authenticate")
  ) {
    return "Invalid email or password";
  }

  if (normalized.includes("already exists") || normalized.includes("already in use")) {
    return "An account with this email already exists";
  }

  if (
    normalized.includes("email not confirmed")
    || normalized.includes("not verified")
    || normalized.includes("email verification required")
  ) {
    return "Please verify your email to continue";
  }

  if (
    normalized.includes("too many")
    || normalized.includes("rate")
    || normalized.includes("attempts")
  ) {
    return "Too many attempts. Please wait and try again.";
  }

  if (
    normalized.includes("could not send")
    || normalized.includes("not configured")
    || normalized.includes("verification email is not configured")
    || normalized.includes("password reset email is not configured")
    || normalized.includes("email verification is not enabled")
  ) {
    return "Email could not be sent. Please try again later, or ask an admin if mail is configured.";
  }

  if (
    normalized.includes("password must be")
    || normalized.includes("invalid password.")
    || normalized.includes("at least")
  ) {
    return "Password must be at least 10 characters and include a letter and a number.";
  }

  if (normalized.includes("invalid code") || normalized.includes("could not verify")) {
    return "Invalid or expired code. Request a new one.";
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
