import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import {
  BrevoContactError,
  deleteBrevoContact,
  resolveBrevoContactListId,
  upsertBrevoContact,
} from "./lib/brevoContacts";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 1_000] as const;

const wait = async (delayMs: number) => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable = error instanceof BrevoContactError && error.retryable;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw error;
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw new Error("Brevo contact operation exhausted retries");
};

export const syncContact = internalAction({
  args: {
    userId: v.string(),
    email: v.string(),
    fullName: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    status: v.union(v.literal("created"), v.literal("updated")),
  }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    if (!apiKey) throw new Error("BREVO_API_KEY is not configured");

    const listId = resolveBrevoContactListId(process.env.BREVO_CONTACT_LIST_ID);
    const status = await withRetry(() => upsertBrevoContact(apiKey, {
      email: args.email,
      externalUserId: args.userId,
      fullName: args.fullName,
      listId,
    }));
    return { status };
  },
});

export const removeContact = internalAction({
  args: { email: v.string() },
  returns: v.object({
    status: v.union(v.literal("deleted"), v.literal("absent")),
  }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    if (!apiKey) throw new Error("BREVO_API_KEY is not configured");

    const status = await withRetry(() => deleteBrevoContact(apiKey, args.email));
    return { status };
  },
});
