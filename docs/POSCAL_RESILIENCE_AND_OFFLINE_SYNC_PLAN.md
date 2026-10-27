# Poscal Resilience and Offline Sync Plan

**Status:** Application continuity is implemented in the working tree and is not deployed. Infrastructure limits, swap, and external monitoring are still manual VPS work and must not be applied by restarting production.  
**Date:** October 23, 2026  
**Applies to:** Poscal web/PWA, Openship hosting, and the self-hosted Convex production deployment  
**Production data authority:** `https://convex.poscalfx.com`  
**Cost constraint:** Remain within the existing free-tier infrastructure; no new recurring service is required by the immediate plan

## Decision

The recommended free-tier solution has two independent layers:

1. **Prevent infrastructure outages on the existing VPS** by enforcing resource boundaries, reducing background-job contention, bounding storage growth, and adding no-cost monitoring and recovery.
2. **Limit user impact when an outage still occurs** by adding an account-scoped local data snapshot and mutation outbox that lets a previously authenticated device continue safe journal work and synchronize it after Convex returns.

Neither layer is sufficient alone. A larger server does not protect users from every network or deployment failure, and offline support does not make an unstable backend acceptable.

Convex remains the authoritative system for accounts, ownership, trades, journals, subscriptions, quotas, and payments. Browser storage is a recovery and continuity layer, not a second transactional database.

Moving Convex to a dedicated server or managed deployment is a future paid option only. It is not required by the immediate plan and must not be used to avoid fixing unbounded CPU, memory, database I/O, or storage growth.

## Confirmed incident evidence

The October 23 outage was a host resource failure, not a DNS failure.

Observed before recovery:

- The VPS had approximately 12 GB of RAM, only about 365 MB available, and no swap.
- Load average was approximately 23.
- Docker commands stopped responding.
- The Convex backend used approximately 4.3 GB of resident memory.
- The Openship API used approximately 489 MB of resident memory.
- The host contained 266 zombie processes and 14 tasks stuck in uninterruptible I/O.
- Most zombies were health-check children of the Convex backend and Openship API containers.
- Both affected containers had no init/reaper process and no PID limit.
- The Convex container had a 6 GiB memory limit; the Openship API had no memory limit.
- Convex logged queued requests expiring and notification functions timing out while the deployment was saturated.

Restarting Docker cleared the zombies, released memory, and restored Openship, Convex, authentication, and Poscal. This confirms the immediate failure mechanism but is not a durable fix.

A separate stopped Poscal runtime container also fails with `EADDRINUSE` on `127.0.0.1:23000`. That stale/duplicate runtime should be reconciled, but it was not the cause of this Convex outage.

## Why the outage can recur

### One shared failure domain

The Openship control plane, routing, Convex, PostgreSQL, Redis, monitoring, and application services share one VPS. Memory or I/O saturation in one service can make the Docker daemon, control panel, authentication, database, and application unavailable together.

### Missing process and resource guardrails

The affected containers do not have an init process to reap exited child processes. Their recurring health checks can therefore leave zombies behind. PID limits are also absent, and the Openship API has no memory ceiling.

Zombie processes alone do not explain all memory usage, but their accumulation proves that the container process model is unhealthy and removes a safety margin during load spikes.

### Background work competes with interactive traffic

The current Convex cron schedule includes notification processing and trading-session alerts every minute, economic-calendar ingestion, journal reminders, and payment work. Notification implementations use bounded pages, but scheduled continuations can still compete with new cron ticks and interactive requests when the runtime is already behind.

Authentication, journal reads, and trade saves must remain available before optional notifications and analytics work.

### Health detection is not recovery

The containers have health checks, but the failed stack remained unavailable until Docker was restarted manually. A health status without a bounded recovery policy does not provide self-healing.

## Goals

- Prevent a single application process from exhausting the complete host.
- Keep sustained CPU, memory, disk, and database I/O below measured free-tier capacity with operating headroom.
- Shed or defer optional work before resources reach exhaustion.
- Keep authentication and normal journal operations ahead of optional background work.
- Recover automatically from a failed application container without immediately restarting the entire Docker daemon.
- Let a previously verified user on the same device reopen Poscal and continue safe work during a backend outage.
- Synchronize eligible offline changes exactly once after the backend and authenticated session return.
- Preserve all existing user data and maintain Convex as the sole server authority.
- Make offline, pending, synchronized, and conflicted states visible to the user.

## Non-goals and hard limits

- A brand-new device cannot securely verify a password or establish its first session while the authentication backend is completely unavailable.
- Offline mode must not authorize billing, subscription, password, email, administrator, or account-deletion operations.
- Backups do not provide live availability. They protect recovery after data or infrastructure loss.
- Periodic copying to another Convex deployment is not active-active replication and must not create two writable production databases.
- Browser storage must not become the only copy of a change that the UI reports as synchronized.
- The immediate plan must not add a paid database, queue, cache, monitoring service, or second always-on server.

## Free-tier capacity policy

Capacity protection is proactive. Poscal must not wait for CPU, memory, disk, or database I/O to reach 100% before reducing optional work.

Initial operating thresholds should be measured against the VPS's actual CPU and disk allocation, then adjusted after a seven-day baseline:

| Resource | Normal target | Warning | Protective action |
| --- | --- | --- | --- |
| CPU | Below 60% sustained | Above 70% sustained | Stop starting optional batches; lengthen notification and ingestion intervals |
| Memory | At least 25% available | Less than 20% available | Pause optional jobs and prevent concurrent batches |
| Disk | Below 70% used | Above 75% used | Pause imports/uploads, rotate logs, and verify backup retention |
| Disk critical | Not applicable | Above 85% used | Reject nonessential storage growth while preserving login and existing-data access |
| Database I/O | Below the measured latency and throughput budget | Sustained I/O wait or query latency above baseline | Reduce polling/scans and pause nonessential backfills |
| Swap | Near zero during normal operation | Sustained swap activity | Treat as memory pressure and reduce workload; do not use swap as normal capacity |

These are operational targets, not provider guarantees. The seven-day baseline must record peak and sustained values before final limits are selected.

### CPU and database-I/O controls

- Allow only one active continuation chain per recurring job using a lease.
- Stagger minute-based jobs so notification processing, session alerts, and payment reconciliation do not start together.
- Increase intervals for nonessential notification work when the system is under pressure.
- Use bounded indexed reads and bounded batches; do not add whole-table polling.
- Skip expired notifications instead of processing a backlog that no longer benefits users.
- Do not run migrations, imports, analytics rebuilds, or backup exports concurrently with peak application traffic.
- Add a kill switch for optional notification, calendar-ingestion, analytics, and backfill work.
- Preserve authentication, journal reads, and ordinary trade saves when optional work is disabled.

The implemented switch is the Convex environment variable
`POSCAL_OPTIONAL_BACKGROUND_WORK_PAUSED`. Set it to `true` during backend
contention to stop optional notification delivery, calendar ingestion/alerts,
session and journal reminders, and analytics backfill continuations. Queued
records and backfill cursors are retained. Remove the variable or set it to
`false` after interactive query latency and host headroom have recovered.

### Disk and database-storage controls

- Configure Docker log rotation with bounded file size and file count.
- Alert on container writable-layer growth and persistent-volume growth separately.
- Keep backups off the VPS after successful transfer and enforce retention only after a newer backup is verified.
- Never keep multiple unverified local export archives on the production disk.
- Keep journal lists bounded and fetch large notebook bodies only when opened.
- Keep images in private R2 under the existing count and byte quotas; do not store image bodies in Convex.
- Store only minimal idempotency receipt data: operation ID, user ID, result reference, status, and timestamps—not a second copy of the complete payload.
- Delete expired operation receipts through bounded cleanup after the supported retry window.
- Bound IndexedDB snapshots per account and prune superseded cached versions on the user's device. Browser storage does not consume VPS disk.
- Apply upload/import admission limits before the server approaches its storage ceiling.

## Infrastructure remediation

### Phase I-A: container safety

Apply the following to the live Openship-managed definitions, not only to an ad-hoc running container:

- Enable an init/reaper process for the Convex backend and Openship API containers.
- Add PID limits to both containers.
- Add explicit memory limits to every major service, including the Openship API.
- Preserve several gigabytes of host headroom for PostgreSQL, Redis, Docker, routing, and the operating system.
- Add 2–4 GB of swap with low swappiness as an emergency buffer, not as normal capacity.
- Configure bounded Docker log rotation so application and health-check logs cannot fill the VPS disk.
- Reconcile or remove the duplicate Poscal runtime that attempts to bind port `23000`.

Exact memory and PID values must be selected from measured normal and peak usage, then load-tested. The invariant is more important than a guessed number: no application container may consume enough resources to make Docker and the database unmanageable.

### Phase I-B: external monitoring and recovery

Monitoring must run outside the production VPS using an existing or free monitor and check:

- `https://poscalfx.com`
- the Openship control-panel endpoint
- both Convex `/version` endpoints
- the authentication/OIDC path
- an authenticated synthetic journal read where safe
- host available memory, swap activity, load, disk space, I/O wait, and zombie count
- container health, restart count, and response latency
- Convex request queue expiry and isolate timeouts

Recovery should be staged:

1. Require several consecutive failures to avoid reacting to a transient request.
2. Restart only the affected application container.
3. Verify recovery and enforce a cooldown.
4. Restart Docker only if targeted recovery fails.
5. Alert a human immediately when Docker or the complete host is affected.

Recovery automation must have a restart-rate limit so it cannot create an endless crash loop.

### Phase I-C: workload protection

- Give each recurring notification or ingestion job a lease so a cron tick cannot overlap an unfinished continuation of the same job.
- Stagger recurring jobs instead of starting multiple jobs on the same minute boundary.
- Preserve existing bounded page sizes and add bounded retry/backoff behavior.
- Skip expired notification work instead of creating a catch-up burst after downtime.
- Pause or shed optional notifications when the queue or runtime is unhealthy.
- Keep trade saves and authentication ahead of notification, analytics, and backfill work.
- Record duration, documents read, documents written, scheduled continuations, and failures for every recurring job.
- Re-measure before increasing user cohorts or server limits.

### Future paid option: failure-domain isolation

Physical isolation is not part of the immediate free-tier plan. Consider it only if measurements show that bounded workloads and recovery controls cannot keep the existing VPS inside its safe capacity. Options would be:

- a dedicated, appropriately sized self-hosted Convex server with off-server backups; or
- a managed Convex deployment if its availability, cost, migration, and operational model are accepted.

Dedicated capacity would remove the shared failure domain, but it introduces recurring cost. No upgrade should be proposed until CPU, memory, disk, and database I/O have been measured after the free-tier controls are implemented.

## Current application behavior

Poscal already has useful pieces, but they do not form offline continuity:

- The service worker precaches the application shell and static assets.
- React Query caches some reads in memory for a short period, but the cache is not persisted across reloads.
- Convex Auth may retain session material, but `AuthContext` still requires a live `users.viewer` result before exposing a user.
- Protected routes wait for that server-derived user and can remain on a loading screen during an outage.
- Notebook text is copied to `localStorage` while editing, but the notebook page fetches the remote trade before it reads and hydrates the local draft.
- Notebook drafts are keyed by trade ID rather than account and trade ID.
- Journal and trade create/update/delete operations call the backend directly. There is no durable mutation outbox.

The existing notebook draft is a useful recovery aid. It should be migrated into the account-scoped offline store rather than expanded as an independent storage system.

## Offline continuity design

### Authentication state machine

Replace the current authenticated/not-authenticated assumption with explicit states:

| State | Meaning | Allowed behavior |
| --- | --- | --- |
| `checking` | Local and server session checks are in progress | Show bounded loading, then resolve to another state |
| `online_authenticated` | Convex has validated the session and viewer | Normal application access |
| `offline_verified_device` | This device has a recent account snapshot, but Convex cannot currently be reached | Cached reads and eligible local drafts only |
| `reauthentication_required` | The server returned and rejected or expired the session | Keep local work, block synchronization, request sign-in |
| `signed_out` | No usable online session or offline account snapshot | Public calculator/welcome experience only |

`offline_verified_device` is an offline unlock, not a claim that the server currently authenticates the user.

The cached account envelope should include only what the offline UI needs:

- stable account identifier
- display name and email needed for the local shell
- last successful verification time
- cache schema version
- active journal identifier
- last successful synchronization cursor/time

Do not store a password. Do not create a second plain-text JWT mirror. On reconnect, synchronization begins only after Convex validates or refreshes the session.

### Local storage

Use IndexedDB for structured, durable storage. Keep small visual preferences in `localStorage`.

Recommended IndexedDB stores:

| Store | Key | Purpose |
| --- | --- | --- |
| `accounts` | `accountId` | Last verified account envelope |
| `journals` | `[accountId, journalId]` | Cached journal metadata |
| `trades` | `[accountId, tradeId]` | Cached trade snapshot and server revision |
| `notebooks` | `[accountId, tradeId]` | Cached notebook body and revision |
| `calendarSnapshots` | `[accountId, period]` | Last successful calendar response and freshness |
| `outbox` | `[accountId, clientOperationId]` | Pending mutation operations |
| `syncState` | `accountId` | Cursor, timestamps, and last sync error |

Every private record must include `accountId`. Logout, account deletion, and account switching must clear the applicable records. Existing `poscal.tradeNotebookDraft.*` values need a one-time, account-aware migration and cleanup path.

### Eligible offline behavior

Allowed while offline:

- Run the position-size calculator.
- View cached journals, trades, progress notes, and notebook text.
- View a cached calendar with a clear last-updated timestamp.
- Create a trade or notebook draft locally.
- Edit locally cached trade and notebook fields.
- Mark a local item for deletion using a pending tombstone.

Unavailable while offline:

- First-time sign-in or sign-up.
- Password reset or email verification.
- Payment, subscription, entitlement, or quota changes.
- Profile security changes and account deletion.
- Administrator operations.
- Final screenshot upload or deletion.
- Any operation whose authorization or pricing must be checked live.

Attachments may be staged as local blobs in a later phase, but the UI must not call them uploaded until R2 and Convex metadata both confirm completion.

## Mutation outbox

Each eligible local write produces one durable operation:

```ts
type OfflineOperation = {
  accountId: string;
  clientOperationId: string;
  entityType: "trade" | "notebook" | "progress";
  entityId: string;
  journalId: string;
  operation: "create" | "update" | "delete";
  baseRevision: number | null;
  payload: unknown;
  createdAtMs: number;
  attemptCount: number;
  status: "pending" | "syncing" | "conflict" | "failed";
  lastError: string | null;
};
```

Requirements:

- Generate `clientOperationId` once and retain it through every retry.
- Keep operations ordered per entity.
- Coalesce unsent field edits to the same entity where safe.
- Never retry indefinitely; use bounded exponential backoff with jitter.
- Pause replay when the browser is offline, the session is invalid, or the server is overloaded.
- Do not remove an operation until the server returns a committed result or a prior receipt for the same operation ID.

## Server idempotency

Add a bounded Convex receipt table keyed by authenticated user and `clientOperationId`. A replay mutation should:

1. Derive the user identity from Convex Auth.
2. Look up an existing receipt by user and operation ID.
3. Return the previous result if the operation already committed.
4. Validate ownership, journal editability, limits, and `baseRevision`.
5. Apply the entity write and insert the receipt in the same Convex transaction.

The client must never send a user ID as authorization. Existing CSV `externalId` deduplication is useful for imports but is not a complete general mutation receipt system.

Receipt cleanup must be bounded and retain entries long enough to exceed the maximum supported offline/retry window.

## Conflict policy

Use explicit revisions rather than timestamps alone.

- **Create:** Idempotent by `clientOperationId`. A replay returns the existing created record.
- **Notebook text:** If the server revision still matches `baseRevision`, apply the patch. Otherwise preserve both versions and ask the user to review or merge.
- **Structured trade fields:** Reject stale changes as a conflict; show the server and local values instead of silently selecting last-write-wins.
- **Delete:** Use a pending tombstone. If the server record changed after `baseRevision`, require review before destructive deletion.
- **Server deletion:** Keep the local pending operation visible and explain that the record no longer exists; do not recreate it automatically.

Financial and journal records should not use silent last-write-wins when two devices edit the same fields.

## Reconnect and synchronization sequence

1. Detect network recovery, but do not treat `navigator.onLine` as proof that Convex is healthy.
2. Probe the actual Convex/auth path with a timeout.
3. Validate or refresh the session.
4. If authentication fails, enter `reauthentication_required` and preserve the outbox.
5. Pull server changes since the last successful cursor or bounded update time.
6. Reconcile server changes with local pending operations.
7. Replay the outbox in deterministic order.
8. Fetch committed records returned by the replay.
9. Mark receipts synchronized and update the local snapshot.
10. Surface conflicts and permanent failures to the user.

Multiple tabs must coordinate so only one tab acts as sync leader. Use a browser lock or equivalent lease; other tabs observe IndexedDB updates.

## User experience

Use plain, persistent status language:

- `Offline — showing saved data from 10:42 AM`
- `Saved on this device`
- `Syncing 3 changes…`
- `All changes synced`
- `Sign in again to sync 3 saved changes`
- `1 change needs review`

Do not show “Saved” for a local-only change without the qualifier “on this device.” Do not redirect a previously verified offline user to the sign-in page merely because `users.viewer` is temporarily unavailable.

The calculator can remain publicly usable. Protected server operations remain protected even when the cached application shell is available.

## Security and privacy

- Namespace all private cached data by account.
- Clear account data on explicit sign-out, account deletion, or a confirmed account switch.
- Preserve pending work if a session expires unexpectedly; require reauthentication before sync.
- Do not store passwords or a second plain-text access-token mirror.
- Treat browser data as recoverable by someone with access to an unlocked browser profile unless a separate local-encryption design is implemented.
- Exclude billing, roles, quotas, and server authorization decisions from offline authority.
- Keep attachment buckets private and preserve current ownership checks.
- Record no sensitive journal content in analytics, monitoring, or error messages.

## Delivery phases

### Phase 0: measure and guard

- Capture seven days of host and per-container baseline usage.
- Add external endpoint and host monitoring.
- Add init/reaper, PID, memory, swap, and targeted recovery controls.
- Add CPU thresholds, Docker log rotation, disk alerts, and optional-work kill switches.
- Stagger recurring work and ensure only one continuation chain runs per job.
- Reconcile the duplicate Poscal runtime.
- Add recurring-job duration and overlap telemetry.

### Phase 1: honest degraded mode

- Add backend reachability and sync-state indicators.
- Introduce the authentication state machine.
- Persist the last verified account and journal metadata.
- Stop infinite loading and incorrect sign-in redirects during outages.
- Keep this phase read-only offline.

### Phase 2: persisted reads

- Persist bounded journal, trade, notebook, progress, and calendar snapshots in IndexedDB.
- Add cache schema migrations and account cleanup.
- Make notebook local drafts readable before attempting the network request.
- Display freshness and offline status.

### Phase 3: offline writes

- Add the outbox and sync leader.
- Add server operation receipts and entity revisions.
- Enable offline create/update for trades, notebooks, and progress.
- Add conflict review and reauthentication recovery.
- Keep billing, security, admin, and attachments online-only.

### Phase 4: free-tier recovery drill and capacity decision

- Verify off-server backups.
- Rehearse container failure, Docker failure, complete VPS loss, and isolated restore.
- Record measured recovery-point and recovery-time results.
- Review seven-day and peak CPU, memory, disk, and database-I/O measurements.
- Consider paid isolation only if the measured free-tier system still cannot preserve the required headroom.

## Testing and acceptance criteria

### Infrastructure

- Zombie count remains zero or stable during a 24-hour health-check and load test.
- Convex or Openship API memory exhaustion cannot make Docker unresponsive.
- A failed application container recovers without restarting unrelated database services.
- Overlapping cron ticks do not run two copies of the same paginated job.
- Authentication and a normal trade save remain responsive during notification backlog tests.
- External monitoring detects a complete VPS outage.
- Sustained CPU stays below the agreed warning threshold during representative traffic.
- Disk usage and Docker logs remain bounded during a seven-day soak test.
- Optional jobs stop or slow before CPU, memory, disk, or database I/O reaches a critical threshold.

### Offline continuity

- A previously authenticated user loads the installed PWA with Convex stopped.
- The user sees cached journals and freshness information rather than an indefinite spinner.
- The user creates and edits a trade and notebook while offline.
- Reloading or closing the browser does not lose the pending changes.
- Restoring Convex replays each operation exactly once.
- Repeating the same network request cannot create duplicate records.
- An expired session preserves pending work and requests reauthentication before replay.
- Conflicting edits from two devices are surfaced and neither version is silently lost.
- Signing out removes the correct account cache and does not expose it to the next account.
- A new device receives a clear service-unavailable message instead of pretending offline login is possible.

### Recovery and data safety

- Docker restart, VPS reboot, and container restart do not corrupt Convex data.
- A backup restore is tested in an isolated deployment, never directly in production first.
- Restored counts and representative auth, journal, subscription, and attachment records match expectations.
- Offline operations created before an outage remain valid after the matching backend version returns.

## Rollout controls

- Implement additive schema changes first.
- Guard offline writes with a feature flag.
- Start with internal accounts, then a small beta cohort.
- Preserve the existing direct-online mutation path as the rollback route.
- Do not delete old fields or local-draft formats until migration and rollback are verified.
- Do not test production resilience by intentionally exhausting or corrupting the live deployment.

## Success definition

This plan is successful when:

1. Normal container or workload failures no longer take down the complete Openship host.
2. Previously verified users can continue safe journal work during a Convex outage.
3. Every offline change is either synchronized exactly once or visibly requires review.
4. No local cache can bypass Convex authorization, entitlements, quotas, or ownership.
5. A full infrastructure loss has a tested, measured recovery path.

## Related repository policy

- `docs/BETA_ARCHITECTURE_RULES.md`
- `docs/DATABASE_RELEASE_AND_RECOVERY.md`
- `docs/SERVER_MIGRATION_RUNBOOK.md`
- `convex/crons.ts`
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/TradeNotebook.tsx`
- `public/sw.js`

