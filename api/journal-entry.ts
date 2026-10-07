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

  const tradeId = String(body.tradeId || "");
  if (!tradeId) {
    return res.status(400).json({ success: false, message: "Missing tradeId" });
  }

  const client = createConvexServerClient(token);
  const tradingJournalApi = (api as any).tradingJournal;

  try {
    const prepared = await client.mutation(tradingJournalApi.beginDeleteEntry, {
      id: tradeId as any,
    });

    const keys = Array.from(new Set((prepared.objectKeys ?? []) as string[]));
    const deletionResults = await Promise.allSettled(
      keys.map((key) => deleteR2Object(key)),
    );
    const failedDeletion = deletionResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedDeletion) {
      // Keep deletionRequestedAtMs set. Some objects may already be gone, and
      // DELETE is idempotent, so retrying safely resumes cleanup instead of
      // reopening a partially deleted journal for edits.
      throw failedDeletion.reason;
    }

    await client.mutation(tradingJournalApi.finalizeDeleteEntry, {
      id: tradeId as any,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete journal";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not authenticated") || lower.includes("missing auth")
        ? 401
        : lower.includes("not found")
          ? 404
          : lower.includes("r2 object deletion failed")
            ? 502
            : 500;

    console.error("[journal-entry-delete]", message);
    return res.status(status).json({ success: false, message });
  }
}
