import { usersApi, type User } from "@/lib/api";
import { convexClient } from "@/lib/convexClient";
import { api } from "../../convex/_generated/api";

export interface AppProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  subscription_tier?: string | null;
  subscription_expires_at?: string | null;
}

const toIsoString = (value?: number | null) => {
  if (!value) {
    return new Date().toISOString();
  }
  return new Date(value).toISOString();
};

const fromConvexProfile = (row: {
  _id: string;
  externalUserId: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  createdAtMs: number;
  subscriptionTier?: string | null;
  subscriptionExpiresAtMs?: number | null;
}): AppProfile => ({
  id: row.externalUserId || row._id,
  email: row.email ?? null,
  full_name: row.fullName ?? null,
  avatar_url: row.avatarUrl ?? null,
  created_at: toIsoString(row.createdAtMs),
  subscription_tier: row.subscriptionTier ?? null,
  subscription_expires_at: row.subscriptionExpiresAtMs ? toIsoString(row.subscriptionExpiresAtMs) : null,
});

export const syncAuthUserToConvex = async (user: User) => {
  if (!convexClient || !user?.id || !user.email) {
    return null;
  }

  return await convexClient.mutation(api.profiles.upsertFromAuth, {
    userId: user.id,
    email: user.email,
    fullName: user.full_name ?? null,
    avatarUrl: null,
    role: null,
    paymentStatus: null,
    subscriptionTier: null,
    subscriptionExpiresAtMs: null,
  });
};

export const getUserProfile = async (user: User): Promise<AppProfile> => {
  if (convexClient && user?.id) {
    const row = await convexClient.query(api.profiles.getByUserId, {
      userId: user.id,
    });

    if (row) {
      return fromConvexProfile(row);
    }
  }

  const profile = await usersApi.getProfile();
  if (convexClient && profile) {
    await convexClient.mutation(api.profiles.upsertFromAuth, {
      userId: user.id,
      email: profile.email || user.email,
      fullName: profile.full_name ?? user.full_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      role: null,
      paymentStatus: null,
      subscriptionTier: profile.subscription_tier ?? null,
      subscriptionExpiresAtMs: profile.subscription_expires_at ? new Date(profile.subscription_expires_at).getTime() : null,
    });
  }

  return profile;
};

export const updateUserProfile = async (
  user: User,
  updates: Partial<Pick<AppProfile, "full_name" | "avatar_url" | "email">>,
): Promise<AppProfile> => {
  const normalizedEmail = updates.email ?? user.email;

  if (convexClient) {
    const row = await convexClient.mutation(api.profiles.updateByUserId, {
      userId: user.id,
      email: normalizedEmail ?? null,
      fullName: updates.full_name ?? null,
      avatarUrl: updates.avatar_url ?? null,
      role: null,
      paymentStatus: null,
      subscriptionTier: null,
      subscriptionExpiresAtMs: null,
    });

    if (row) {
      return fromConvexProfile(row);
    }
  }

  const backendProfile = await usersApi.updateProfile({
    full_name: updates.full_name,
    avatar_url: updates.avatar_url,
  });
  return backendProfile;
};
