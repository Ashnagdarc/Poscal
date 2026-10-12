# Beta architecture rules

Status: engineering policy and implementation plan, October 10, 2026. These rules do not mean the listed improvements are already deployed. Preserve existing users and data. The beta has no budget for new recurring services.

## Service boundaries

| Data or work | Home | Rule |
| --- | --- | --- |
| Accounts, ownership, trades, payments, quotas | Convex | Keep one authoritative record. Enforce permissions and limits on the server. |
| Chart images | Private R2 | Upload directly using short-lived authorization; keep ownership, size and object references in Convex. |
| Journal notes | Convex initially | Fetch only when opened. Separate large bodies from list records before considering another store. |
| Downloadable exports | Browser initially | Generate small exports locally; use private R2 with expiry for server-generated large exports if needed. |
| Public market/calendar snapshots | Shared cache candidate | Cache only where upstream terms allow. Include source time, freshness and failure state. |
| Static frontend | Vercel today | Cloudflare static hosting is a candidate, not a required migration. Move only after existing API routes and authentication are verified. |
| Reliable background work | Existing Convex scheduling | Bound batches, retry safely and avoid adding another queue without a measured need. |

Do not add a second transactional database, a custom load balancer or a cache of private responses to hide expensive queries. A proxy cannot increase Convex plan allowances. Moving a function to Workers does not remove the Convex calls it still makes.

## Reads and analytics

1. Browse trades with cursor pagination. Start with 25–50 rows. Preserve filters and access to older rows; never replace complete results with a silent truncation.
2. Query the selected date range on the server. Filtering only the loaded browser page is not a complete search.
3. Keep list records small. Returning a smaller object after reading a large database row reduces response size but does not remove the database read cost. Separate bulky content when measurements justify it.
4. Read notes and attachments only when the user opens them. Do not fetch the legacy 500-row list alongside the paginated feed.
5. Keep total counts and P&L independent of loaded pages. Update additive summaries in the same transaction as trade creation, editing and deletion.
6. Treat drawdown, streaks and historical edits separately from additive totals. Recompute affected ordered ranges in bounded work; expose a rebuilding state rather than presenting partial totals as final.
7. Use bounded daily/monthly summaries for charts. Backfills are for migration and repair, not the default response to every new trade.
8. Subscribe only to data used by the active screen. Reuse existing client caches. Clear account-scoped cached data on logout or account changes.
9. Paginate administration and bulk maintenance. Audit indexes against actual callers before removing any index.

## Image rules

Current implementation compresses every image before upload. It targets about 1 MiB, accepts up to 2 MiB, and limits a user to 50 ready images and 50 MiB. It reserves quota before upload. These per-user limits do not establish a global zero-cost storage budget.

1. Optimize from the first upload, not after the tenth or fiftieth image.
2. Trial a 250–400 KiB target for new chart uploads, subject to visual checks on small labels, prices and annotations. This is a target, not a deployed setting or a promise that every image can meet it.
3. Preserve aspect ratio and legibility. If an image cannot fit the available quota at acceptable quality, explain the limit and offer crop/replacement; do not silently make the chart unreadable.
4. Do not automatically recompress existing user images when their count grows. Any migration writes a new object, verifies it, switches the reference, and retains the old object for a defined rollback period before deletion.
5. Enforce both byte and count limits server-side. Include pending uploads, replacements and temporary migration copies in capacity planning.
6. Add a global upload budget with safety headroom. Avoid one globally contended counter on every upload: allocate bounded byte reservations to users or cohorts and reconcile actual bucket usage. Expire unused reservations.
7. Keep the bucket private. Public caching must never bypass ownership checks. Reuse authorized URLs only within their validity and account scope.
8. Retry failed object deletion through bounded cleanup work. Reconcile pending/deleted metadata with objects; do not depend only on the user uploading again.
9. Never store base64 image data in trade rows. Do not add paid image transformation services for work the browser can perform.

R2's 10 GB-month free storage allowance is global, not per user. Even 50 images at 300 KB each across 10,000 users is approximately 150 GB. Compression alone cannot make that entitlement free.

## What may move later

Large, infrequently edited notebook bodies are candidates for R2 only if measurements show they dominate storage or reads. Keep ownership, preview, revision and object reference in Convex. Use immutable object versions and a compare-and-set revision when publishing a new reference. Reject stale edits, retry orphan cleanup, and retain rollback copies temporarily. R2 and Convex do not share one transaction. Do not move ordinary trade fields or frequently edited small notes merely because R2 storage is cheaper.

Public, identical responses are candidates for a Cloudflare cache. Set a freshness policy for each dataset. Daily reference FX rates must not be presented as live executable prices. Caching calculator conversion feeds currently fetched directly from vendors would reduce vendor traffic, not Convex database reads.

## Quotas and overload

1. Make entry, note-size, upload and import limits configurable and server-enforced. Define entry limits across all journals for one user so creating another journal cannot bypass them.
2. Preserve all existing records when introducing a lower allowance. Explain restrictions on new content; retain existing viewing, export and permitted edits.
3. Debounce draft saves, detect unchanged content and make retried creates/imports idempotent. Bound retries with backoff. Show whether a draft is saved, pending or failed.
4. Keep browser drafts as recovery aids, not the only copy of a saved trade. Scope them to the account and clear sensitive caches appropriately.
5. Limit bursts and expensive imports. Protect normal trade saves before optional analytics refreshes and background work.
6. Admit beta users in measured cohorts. Configure admission and upload switches before a promotion. Pause growth before provider hard limits, not after writes fail.
7. Budget for database storage, I/O, function calls, actions, R2 operations, uploads and email together. A zero-cost promise requires every service to fit its allowance.

## Validation and rollout

Measure current storage, monthly usage, peak sessions and bytes/calls for representative workflows before selecting a maximum account count. Forecast accumulated storage through the full three-to-six-month beta. Use roughly 30% planning headroom; this is an internal target, not a provider guarantee.

Use synthetic staging data to test pagination boundaries, concurrent edits, quota reservations, failed uploads, retry safety, account isolation and summary reconciliation. Increase load gradually with realistic think time. A local test checks correctness but does not prove hosted capacity. Hosted tests also consume allowances.

Deploy additive, backwards-compatible changes first. Compare replacement summaries against existing results before switching readers. Use a feature switch and rollback path. Do not delete old fields or records until migration and recovery have been checked. Do not deliberately break production to learn its limits.

## Code and writing

Use concrete names and plain language. Comments explain non-obvious constraints or reasons; remove stale claims and comments that only repeat the next line. Preserve useful safety and financial-calculation explanations. Keep implementation detail out of product copy. Clean touched files as part of focused changes; keep unrelated repository-wide rewrites separate from performance fixes.

## Implementation order

1. Record baseline usage and add growth/upload switches.
2. Remove duplicate journal reads and maintain additive statistics incrementally.
3. Complete list/detail separation, bounded charts and admin pagination.
4. Tune new-image compression with visual verification; add global storage reservations and reliable cleanup.
5. Enforce configured content quotas and retry-safe saves/imports.
6. Test realistic load and admit the next cohort.
7. Consider public caching, frontend migration or notebook-body offloading only when measurements show enough benefit to justify the added failure paths.

## Provider references

- [Convex resource limits](https://docs.convex.dev/production/state/limits)
- [Cloudflare R2 pricing and free allowances](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare static hosting billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

Provider allowances must be rechecked before deployment decisions.
