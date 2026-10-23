import { useAuthActions } from "@convex-dev/auth/react";
import { createContext, useContext, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthToken, useConvexAuth } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { clearLegacyAuthMirrors, setConvexAuthTokenMirror } from '@/lib/authTokenStore';
import { mapPasswordResetRequestError, toSafeAuthErrorMessage } from '@/lib/authErrorMessages';
import { syncSharedConvexHttpAuth } from '@/lib/convexClient';
import { clearSensitiveLocalStorage } from '@/lib/privacyCleanup';
import { useBackendAvailability, type BackendAvailability } from '@/hooks/use-backend-availability';
import {
  clearOfflineAccount,
  loadLastOfflineAccount,
  saveOfflineAccount,
  type OfflineAccountSnapshot,
} from '@/lib/offlineStore';

export type AuthMode =
  | "checking"
  | "online_authenticated"
  | "offline_verified_device"
  | "reauthentication_required"
  | "signed_out";

export type AuthResult = {
  error: string | null;
  /** True when Convex Auth issued a session (email already verified or just verified). */
  signedIn: boolean;
};

interface AuthContextType {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  authMode: AuthMode;
  backendAvailability: BackendAvailability;
  isOffline: boolean;
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
  /** Same server-authoritative role as users.viewer (reactive Convex query). */
  role?: string | null;
}

export interface ViewerSubscription {
  paymentStatus: string;
  subscriptionTier: string;
  expiresAtMs: number | null;
  freeJournalId?: string | null;
  lockedJournalIds?: string[];
  usage?: {
    journals: number;
    entries: number;
    screenshots: number;
    storageBytes: number;
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const authToken = useAuthToken();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const unregisterPush = useMutation(api.admin.unsubscribePush);
  const { availability: backendAvailability } = useBackendAvailability();
  const [cachedAccount, setCachedAccount] = useState<OfflineAccountSnapshot | null>(null);
  const [offlineCacheLoaded, setOfflineCacheLoaded] = useState(false);
  const persistedAccountId = useRef<string | null>(null);

  const liveUser = useMemo<User | null>(() => viewer
    ? {
        id: viewer.id,
        email: viewer.email ?? "",
        full_name: viewer.fullName ?? null,
        avatar_url: viewer.avatarUrl ?? null,
        email_verified: viewer.emailVerified,
        role: viewer.role ?? "user",
      }
    : null, [viewer]);

  const liveViewerSubscription = useMemo<ViewerSubscription | null>(() => viewer
    ? {
        paymentStatus: viewer.paymentStatus ?? "free",
        subscriptionTier: viewer.subscriptionTier ?? "free",
        expiresAtMs: viewer.subscriptionExpiresAtMs ?? null,
      }
    : null, [viewer]);

  useEffect(() => {
    let active = true;
    void loadLastOfflineAccount()
      .then((snapshot) => {
        if (!active || !snapshot) return;
        setCachedAccount((current) => current ?? snapshot);
        if (persistedAccountId.current && persistedAccountId.current !== snapshot.accountId) {
          void clearOfflineAccount(snapshot.accountId).catch((error) => {
            console.warn("[auth] Could not clear a stale offline account", error);
          });
        }
      })
      .finally(() => {
        if (active) setOfflineCacheLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cachedAccount && !persistedAccountId.current) {
      persistedAccountId.current = cachedAccount.accountId;
    }
  }, [cachedAccount]);

  useEffect(() => {
    if (!liveUser) return;
    if (persistedAccountId.current && persistedAccountId.current !== liveUser.id) {
      const previousAccountId = persistedAccountId.current;
      void clearOfflineAccount(previousAccountId).catch((error) => {
        console.warn("[auth] Could not clear the previous account cache", error);
      });
    }
    persistedAccountId.current = liveUser.id;
    const snapshot: OfflineAccountSnapshot = {
      accountId: liveUser.id,
      user: liveUser,
      viewerSubscription: liveViewerSubscription,
      lastVerifiedAtMs: Date.now(),
      schemaVersion: 1,
    };
    setCachedAccount(snapshot);
    void saveOfflineAccount(snapshot).catch((error) => {
      console.warn("[auth] Could not persist offline account snapshot", error);
    });
  }, [liveUser, liveViewerSubscription]);

  const authMode = useMemo<AuthMode>(() => {
    if (!offlineCacheLoaded || authLoading) return "checking";
    if (backendAvailability === "offline" && cachedAccount) return "offline_verified_device";
    if (liveUser) return "online_authenticated";
    if (backendAvailability === "checking" || (isAuthenticated && viewer === undefined)) return "checking";
    if (cachedAccount) return "reauthentication_required";
    return "signed_out";
  }, [authLoading, backendAvailability, cachedAccount, isAuthenticated, liveUser, offlineCacheLoaded, viewer]);

  const user: User | null = liveUser ?? (
    authMode === "offline_verified_device" && cachedAccount
      ? { ...cachedAccount.user, role: "user" }
      : null
  );

  const viewerSubscription: ViewerSubscription | null = liveViewerSubscription ?? (
    authMode === "offline_verified_device"
      ? cachedAccount?.viewerSubscription ?? null
      : null
  );

  const session = authMode === "online_authenticated" ? { access_token: "convex-auth" } : null;
  const loading = authMode === "checking";

  // Sync the in-memory JWT mirror during render so child effects (journal images,
  // HTTP helpers) never race ahead of an empty token after auth resolves.
  // Do not persist a second localStorage copy (P-028).
  setConvexAuthTokenMirror(authToken ?? null);
  syncSharedConvexHttpAuth(authToken ?? null);

  useEffect(() => {
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
        error: toSafeAuthErrorMessage(error, "Could not sign in right now. Please try again or reset your password."),
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
      // Soft: unknown email → null (no enumeration). Provider/key failures surface.
      return { error: mapPasswordResetRequestError(error) };
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
      console.error("[auth] Verification email error:", error);
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
    // Detach this browser's push endpoint while the session is still valid.
    // Browser notification permission remains granted, so the next sign-in can
    // silently create/register a fresh subscription without showing the prompt.
    if (
      typeof navigator !== "undefined"
      && "serviceWorker" in navigator
      && typeof window !== "undefined"
      && "PushManager" in window
    ) {
      try {
        const registration = (await navigator.serviceWorker.getRegistration("/")) ?? null;

        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            try {
              await unregisterPush({
                endpoint: subscription.endpoint,
                id: undefined,
              });
            } catch (error) {
              console.warn("[auth] Could not deactivate push endpoint before sign-out", error);
            }

            try {
              await subscription.unsubscribe();
            } catch (error) {
              console.warn("[auth] Could not remove local push subscription on sign-out", error);
            }
          }
        }
      } catch (error) {
        console.warn("[auth] Push cleanup before sign-out failed", error);
      }
    }

    try {
      await convexSignOut();
    } finally {
      // Clear journal notes / progress residue on shared devices (AP-009 / MC-020).
      clearSensitiveLocalStorage();
      clearLegacyAuthMirrors();
      setConvexAuthTokenMirror(null);
      syncSharedConvexHttpAuth(null);
      const accountId = user?.id ?? cachedAccount?.accountId ?? null;
      setCachedAccount(null);
      if (accountId) {
        await clearOfflineAccount(accountId).catch((error) => {
          console.warn("[auth] Could not clear offline account cache", error);
        });
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        authMode,
        backendAvailability,
        isOffline: authMode === "offline_verified_device",
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
