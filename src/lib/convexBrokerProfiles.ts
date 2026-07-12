import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { BROKER_PROFILES, findBrokerProfile } from "@/domain/brokers";
import type { BrokerProfile } from "@/domain/types";
import { createAuthenticatedConvexClient, isConvexEnabled } from "@/lib/convexClient";

export interface SavedBrokerProfile {
  id: Id<"brokerProfiles">;
  name: string;
  brokerId: string;
  accountCurrency: string | null;
  notes: string | null;
}

export const loadBrokerProfiles = async (authToken?: string | null): Promise<SavedBrokerProfile[]> => {
  if (!authToken || !isConvexEnabled()) {
    return [];
  }

  const client = createAuthenticatedConvexClient(authToken);
  if (!client) {
    return [];
  }

  const rows = await client.query(api.brokerProfiles.listForViewer, {});
  return rows.map((row) => ({
    id: row._id,
    name: row.name,
    brokerId: row.brokerId,
    accountCurrency: row.accountCurrency ?? null,
    notes: row.notes ?? null,
  }));
};

export const createBrokerProfile = async (
  input: Omit<SavedBrokerProfile, "id">,
  authToken?: string | null,
) => {
  if (!authToken || !isConvexEnabled()) {
    throw new Error("Broker profiles require an active Convex session.");
  }

  const client = createAuthenticatedConvexClient(authToken);
  if (!client) {
    throw new Error("Broker profiles require an active Convex session.");
  }

  await client.mutation(api.brokerProfiles.createForViewer, {
    name: input.name,
    brokerId: input.brokerId,
    accountCurrency: input.accountCurrency,
    notes: input.notes,
  });
};

export const deleteBrokerProfile = async (id: Id<"brokerProfiles">, authToken?: string | null) => {
  if (!authToken || !isConvexEnabled()) {
    throw new Error("Broker profiles require an active Convex session.");
  }

  const client = createAuthenticatedConvexClient(authToken);
  if (!client) {
    throw new Error("Broker profiles require an active Convex session.");
  }

  await client.mutation(api.brokerProfiles.removeForViewer, { id });
};

export const toCalculatorBrokerProfiles = (savedProfiles: SavedBrokerProfile[]): BrokerProfile[] => {
  return savedProfiles
    .map((savedProfile) => {
      const baseProfile = findBrokerProfile(savedProfile.brokerId) ?? BROKER_PROFILES[0];
      if (!baseProfile) {
        return null;
      }

      return {
        ...baseProfile,
        id: `saved:${savedProfile.id}`,
        name: savedProfile.name,
        accountCurrency: savedProfile.accountCurrency ?? baseProfile.accountCurrency,
      };
    })
    .filter((profile): profile is BrokerProfile => profile !== null);
};
