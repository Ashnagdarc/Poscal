import type { GenericDatabaseWriter } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";

type SessionDb = GenericDatabaseWriter<DataModel>;

/**
 * Delete Convex Auth sessions (+ refresh tokens) for a user.
 * Non-destructive to app data — only auth session rows.
 *
 * Used for "sign out other devices", account delete, and password-reset
 * post-effects when the client needs to mirror auth-layer invalidation.
 * Password `reset-verification` already calls library `invalidateSessions`
 * (except the new session); this path is for authenticated mutations.
 */
export async function deleteAuthSessionsForUser(
  db: SessionDb,
  userId: Id<"users">,
  options?: {
    /** Keep this session alive (usually the caller's current session). */
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
