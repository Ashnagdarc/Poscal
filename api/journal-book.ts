import type { VercelRequest, VercelResponse } from "@vercel/node";

import { api, createConvexServerClient } from "./_convex.js";
import { deleteR2Object } from "./_lib/r2.js";

export const config = { maxDuration: 30 };

const getBearerToken = (req: VercelRequest) => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

const bodyObject = (req: VercelRequest): Record<string, unknown> => {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body && typeof req.body === "object" ? req.body : {};
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing auth token" });
  }

  let body: Record<string, unknown>;
  try {
    body = bodyObject(req);
  } catch {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  const journalId = String(body.journalId || "");
  if (!journalId) {
    return res.status(400).json({ success: false, message: "Missing journalId" });
  }

  const client = createConvexServerClient(token);
  const journalsApi = (api as any).tradingJournals;
  const entriesApi = (api as any).tradingJournal;

  try {
    await client.mutation(journalsApi.beginRemove, { id: journalId as any });
    const batch = await client.query(journalsApi.removeBatch, {
      id: journalId as any,
    });

    for (const tradeId of batch.tradeIds as string[]) {
      const prepared = await client.mutation(entriesApi.beginDeleteEntry, {
        id: tradeId as any,
      });
      const keys = Array.from(
        new Set(
          ((prepared.objectKeys ?? []) as string[]).filter(
            (key) => Boolean(key) && key !== "pending",
          ),
        ),
      );
      const deletionResults = await Promise.allSettled(
        keys.map((key) => deleteR2Object(key)),
      );
      const failed = deletionResults.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failed) {
        // Metadata stays in the prepared state. Retrying this endpoint resumes
        // the same idempotent R2 deletes before any parent row is removed.
        throw failed.reason;
      }

      await client.mutation(entriesApi.finalizeDeleteEntry, {
        id: tradeId as any,
      });
    }

    const cleanup = await client.mutation(journalsApi.cleanupRemoveBatch, {
      id: journalId as any,
    });

    return res.status(cleanup.done ? 200 : 202).json({
      success: true,
      done: cleanup.done,
      processedEntries: batch.tradeIds.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete journal";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not authenticated") || lower.includes("missing auth")
        ? 401
        : lower.includes("pro_required")
          ? 403
          : lower.includes("not found")
            ? 404
            : lower.includes("r2 object deletion failed")
              ? 502
              : 500;

    console.error("[journal-book-delete]", message);
    return res.status(status).json({ success: false, message });
  }
}
