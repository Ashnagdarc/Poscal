import { describe, expect, it } from "vitest";
import {
  mergeOfflineTrades,
  planOutboxChange,
  withSyncedRevision,
  type OfflineOperation,
} from "./offlineOutbox";

const operation = (patch: Partial<OfflineOperation>): OfflineOperation => ({
  clientOperationId: "op-1",
  accountId: "user-1",
  entityType: "trade",
  entityId: "trade-1",
  journalId: "journal-1",
  operation: "update",
  baseRevision: 4,
  payload: { notes: "first" },
  createdAtMs: 1,
  attemptCount: 0,
  status: "pending",
  lastError: null,
  ...patch,
});

describe("offline outbox planning", () => {
  it("keeps the original operation id and server revision when an edit is repeated", () => {
    const plan = planOutboxChange(
      [operation({ clientOperationId: "first", baseRevision: 4, payload: { notes: "first" } })],
      operation({ clientOperationId: "second", baseRevision: 5, payload: { pnl: 12 } }),
    );

    expect(plan.deleteIds).toEqual([]);
    expect(plan.put).toEqual([
      operation({ clientOperationId: "first", baseRevision: 4, payload: { notes: "first", pnl: 12 } }),
    ]);
  });

  it("drops a never-synced create when that trade is deleted locally", () => {
    const plan = planOutboxChange(
      [
        operation({ clientOperationId: "create", operation: "create", entityId: "offline:1", baseRevision: null }),
        operation({ clientOperationId: "edit", operation: "update", entityId: "offline:1", baseRevision: 1 }),
      ],
      operation({ clientOperationId: "delete", operation: "delete", entityId: "offline:1", baseRevision: 2 }),
    );

    expect(plan.put).toEqual([]);
    expect(plan.deleteIds).toEqual(["create", "edit"]);
  });

  it("deletes from the original server revision and discards unsent edits", () => {
    const plan = planOutboxChange(
      [operation({ clientOperationId: "edit", baseRevision: 4 })],
      operation({ clientOperationId: "delete", operation: "delete", baseRevision: 5, payload: {} }),
    );

    expect(plan.deleteIds).toEqual(["edit"]);
    expect(plan.put[0]).toMatchObject({ operation: "delete", baseRevision: 4, clientOperationId: "delete" });
  });

  it("folds structured edits into a pending create and leaves notebook text as its own operation", () => {
    const structured = planOutboxChange(
      [operation({
        clientOperationId: "create",
        operation: "create",
        entityId: "offline:2",
        baseRevision: null,
        payload: { pair: "EUR/USD", notes: null },
      })],
      operation({
        clientOperationId: "edit",
        operation: "update",
        entityId: "offline:2",
        payload: { notes: "added" },
      }),
    );
    expect(structured.put[0]).toMatchObject({
      clientOperationId: "create",
      operation: "create",
      payload: { pair: "EUR/USD", notes: "added" },
    });

    const notebook = planOutboxChange(
      [operation({
        clientOperationId: "draft",
        operation: "create",
        entityType: "trade",
        entityId: "offline:3",
        baseRevision: null,
        payload: { kind: "notebook_draft" },
      })],
      operation({
        clientOperationId: "text",
        operation: "update",
        entityType: "notebook",
        entityId: "offline:3",
        baseRevision: 1,
        payload: { entry_reason: "Breakout" },
      }),
    );
    expect(notebook.put).toHaveLength(1);
    expect(notebook.put[0].clientOperationId).toBe("text");
  });

  it("does not rewrite an operation that is already syncing", () => {
    const plan = planOutboxChange(
      [operation({ clientOperationId: "inflight", status: "syncing", payload: { notes: "sending" } })],
      operation({ clientOperationId: "next", payload: { notes: "newer" } }),
    );
    expect(plan.deleteIds).toEqual([]);
    expect(plan.put[0].clientOperationId).toBe("next");
  });
});

describe("offline trade overlay", () => {
  it("shows local creates and pending edits ahead of the server copy", () => {
    const merged = mergeOfflineTrades(
      [{ id: "server-1", notes: "server" }],
      [
        { id: "offline:1", notes: "new" },
        { id: "server-1", notes: "local edit" },
      ],
      [
        operation({ clientOperationId: "create", operation: "create", entityId: "offline:1" }),
        operation({ clientOperationId: "edit", entityId: "server-1" }),
      ],
    );

    expect(merged).toEqual([
      { id: "offline:1", notes: "new" },
      { id: "server-1", notes: "local edit" },
    ]);
  });

  it("hides a trade with a pending local delete", () => {
    const merged = mergeOfflineTrades(
      [{ id: "server-1", notes: "server" }],
      [{ id: "server-1", notes: "server" }],
      [operation({ operation: "delete", entityId: "server-1", payload: {} })],
    );
    expect(merged).toEqual([]);
  });

  it("points a later edit at the revision returned by the earlier replay", () => {
    const next = withSyncedRevision(
      operation({ entityId: "server-1", baseRevision: 9 }),
      new Map([["server-1", 5]]),
    );
    expect(next.baseRevision).toBe(5);
  });
});
