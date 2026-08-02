import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";

type AuthCtx = Parameters<typeof getAuthUserId>[0];

/** Require a signed-in Convex Auth user. Never trust client-supplied user IDs. */
export async function requireAuthUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}
