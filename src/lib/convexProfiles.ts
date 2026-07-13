import type { User } from "@/contexts/AuthContext";
import { createAuthenticatedConvexClient, convexClient } from "@/lib/convexClient";
import { api } from "../../convex/_generated/api";

export interface AppProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  role?: string | null;
  payment_status?: string | null;
  subscription_tier?: string | null;
  subscription_expires_at?: string | null;
}

const toIsoString = (value?: number | null) => {
  if (!value) {
    return new Date().toISOString();
  }
  return new Date(value).toISOString();
};

export const getUserProfile = async (user: User, authToken?: string | null): Promise<AppProfile> => {
  if (convexClient && user?.id && authToken) {
    const row = await createAuthenticatedConvexClient(authToken).query(api.users.viewerProfile, {});

    if (row) {
      return {
        id: row.id,
        email: row.email ?? null,
        full_name: row.full_name ?? null,
        avatar_url: row.avatar_url ?? null,
        created_at: toIsoString(row.created_at),
        role: row.role ?? "user",
        payment_status: row.payment_status ?? "free",
        subscription_tier: row.subscription_tier ?? "free",
        subscription_expires_at: row.subscription_expires_at ? toIsoString(row.subscription_expires_at) : null,
      };
    }
  }

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name ?? null,
    avatar_url: null,
    created_at: new Date().toISOString(),
    role: "user",
    payment_status: "free",
    subscription_tier: "free",
    subscription_expires_at: null,
  };
};

export const updateUserProfile = async (
  user: User,
  updates: Partial<Pick<AppProfile, "full_name" | "avatar_url" | "email">>,
  authToken?: string | null,
): Promise<AppProfile> => {
  if (convexClient && authToken) {
    const row = await createAuthenticatedConvexClient(authToken).mutation(api.users.updateViewerProfile, {
      fullName: updates.full_name ?? null,
      avatarUrl: updates.avatar_url ?? null,
    });

    if (row) {
      return {
        id: row.id,
        email: row.email ?? null,
        full_name: row.full_name ?? null,
        avatar_url: row.avatar_url ?? null,
        created_at: new Date().toISOString(),
      };
    }
  }

  return {
    id: user.id,
    email: updates.email ?? user.email,
    full_name: updates.full_name ?? user.full_name ?? null,
    avatar_url: updates.avatar_url ?? null,
    created_at: new Date().toISOString(),
  };
};
