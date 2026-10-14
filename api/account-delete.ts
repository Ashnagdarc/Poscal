import type { VercelRequest, VercelResponse } from "@vercel/node";

import { api, createConvexServerClient } from "./_convex.js";
import { deleteR2Object } from "./_lib/r2.js";

export const config = { maxDuration: 30 };

const bearer = (req: VercelRequest) => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
};

const body = (req: VercelRequest): Record<string, unknown> => {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body && typeof req.body === "object" ? req.body : {};
};

async function deleteTradeAssets(
  client: ReturnType<typeof createConvexServerClient>,
  entriesApi: any,
  tradeId: string,
) {
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

  const results = await Promise.allSettled(keys.map((key) => deleteR2Object(key)));
  const failed = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failed) throw failed.reason;

  await client.mutation(entriesApi.finalizeDeleteEntry, {
    id: tradeId as any,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing auth token" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = body(req);
  } catch {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }
  if (payload.confirmation !== "DELETE") {
    return res.status(400).json({
      success: false,
      message: "Type DELETE to confirm permanent account deletion.",
    });
  }

  const client = createConvexServerClient(token);
  const usersApi = (api as any).users;
  const journalsApi = (api as any).tradingJournals;
  const entriesApi = (api as any).tradingJournal;

  try {
    // Idempotently refresh the deletion session on each resumable request.
    await client.mutation(usersApi.beginAccountDeletion, {
      confirmation: "DELETE",
    });

    const journalIds = (await client.query(
      journalsApi.accountDeletionBooks,
      {},
    )) as string[];

    if (journalIds.length > 0) {
      const journalId = journalIds[0];
      await client.mutation(journalsApi.beginRemove, {
        id: journalId as any,
      });
      const batch = await client.query(journalsApi.removeBatch, {
        id: journalId as any,
      });

      for (const tradeId of (batch.tradeIds ?? []) as string[]) {
        await deleteTradeAssets(client, entriesApi, tradeId);
      }

      const cleanup = await client.mutation(journalsApi.cleanupRemoveBatch, {
        id: journalId as any,
      });

      return res.status(202).json({
        success: true,
        done: false,
        phase: "journals",
        journalDone: cleanup.done === true,
        processedEntries: (batch.tradeIds ?? []).length,
      });
    }

    // Clean any legacy/orphan entries that are not attached to a journal.
    const orphanBatch = await client.query(entriesApi.accountDeletionBatch, {});
    if ((orphanBatch.tradeIds ?? []).length > 0) {
      for (const tradeId of orphanBatch.tradeIds as string[]) {
        await deleteTradeAssets(client, entriesApi, tradeId);
      }
      return res.status(202).json({
        success: true,
        done: false,
        phase: "orphan_entries",
        processedEntries: orphanBatch.tradeIds.length,
      });
    }

    const result = await client.mutation(usersApi.deleteAccount, {
      confirmation: "DELETE",
    });
    return res.status(200).json({
      success: true,
      done: true,
      counts: result.counts,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete account";
    const lower = message.toLowerCase();
    const status =
      lower.includes("not authenticated") || lower.includes("missing auth")
        ? 401
        : lower.includes("not found")
          ? 404
          : lower.includes("r2 object deletion failed")
            ? 502
            : 500;
    console.error("[account-delete]", message);
    return res.status(status).json({ success: false, message });
  }
}
