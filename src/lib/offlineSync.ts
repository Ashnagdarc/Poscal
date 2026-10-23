import { api } from "../../convex/_generated/api";
import { getAuthenticatedConvexHttpClient } from "@/lib/convexClient";
import { toConvexTradeInput, toConvexTradePatch } from "@/lib/convexJournal";
import type { OfflineOperation } from "@/lib/offlineStore";

export type OfflineReplayResult = {
  status: "applied" | "replayed";
  entityId: string;
  revision: number | null;
};

const toNotebookPatch = (payload: Record<string, unknown>) => ({
  title: payload.journal_title as string | null | undefined,
  entryReason: payload.entry_reason as string | null | undefined,
  duringTradeNotes: payload.during_trade_notes as string | null | undefined,
  postTradeReview: payload.post_trade_review as string | null | undefined,
  lessonsLearned: payload.lessons_learned as string | null | undefined,
});

export const replayOfflineOperation = async (
  operation: OfflineOperation,
): Promise<OfflineReplayResult> => {
  const client = getAuthenticatedConvexHttpClient();

  if (operation.operation === "create") {
    if (operation.payload.kind === "notebook_draft") {
      return await client.mutation(api.tradingJournal.replayCreateNotebookDraft, {
        clientOperationId: operation.clientOperationId,
        journalId: operation.journalId as any,
        entryDateMs: typeof operation.payload.entryDateMs === "number"
          ? operation.payload.entryDateMs
          : null,
      }) as OfflineReplayResult;
    }
    return await client.mutation(api.tradingJournal.replayCreateEntry, {
      clientOperationId: operation.clientOperationId,
      entry: toConvexTradeInput(operation.payload),
    }) as OfflineReplayResult;
  }

  if (operation.baseRevision === null) {
    throw new Error("OFFLINE_SYNC_MISSING_REVISION");
  }

  if (operation.operation === "delete") {
    return await client.mutation(api.tradingJournal.replayDeleteEntry, {
      clientOperationId: operation.clientOperationId,
      id: operation.entityId as any,
      expectedRevision: operation.baseRevision,
    }) as OfflineReplayResult;
  }

  if (operation.entityType === "notebook") {
    return await client.mutation(api.tradingJournal.replayUpdateNotebook, {
      clientOperationId: operation.clientOperationId,
      id: operation.entityId as any,
      expectedRevision: operation.baseRevision,
      patch: toNotebookPatch(operation.payload),
    }) as OfflineReplayResult;
  }

  return await client.mutation(api.tradingJournal.replayUpdateEntry, {
    clientOperationId: operation.clientOperationId,
    id: operation.entityId as any,
    expectedRevision: operation.baseRevision,
    patch: toConvexTradePatch(operation.payload),
  }) as OfflineReplayResult;
};
