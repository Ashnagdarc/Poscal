import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";

/**
 * Delete Convex Auth sessions (+ refresh tokens) for a user.
 * Non-destructive to journal/profile data — only auth session rows.
 *
 * Mirrors @convex-dev/auth `invalidateSessionsImpl` / `deleteSession` so app-layer
 * mutations can revoke sessions without requiring ActionCtx helpers.
 */
export async function deleteAuthSessionsForUser(
  db: GenericDatabaseWriter<DataModel>,
  userId: Id<"users">,
  options?: {
    /** Keep this session (e.g. the caller's current device). */
    exceptSessionId?: Id<"authSessions"> | null;
  },
): Promise<number> {
  const exceptId = options?.exceptSessionId ?? null;
  const sessions = await db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  let deleted = 0;
  for (const session of sessions) {
    if (exceptId !== null && session._id === exceptId) {
      continue;
    }
    const refreshTokens = await db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) {
      await db.delete(token._id);
    }
    await db.delete(session._id);
    deleted += 1;
  }
  return deleted;
}
