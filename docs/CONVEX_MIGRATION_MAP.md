# Convex Migration Map

This is now a legacy import note for old Postgres-era data.

## Migration Order

1. `calculatorHistory`
   - Lowest risk.
   - Already has localStorage fallback.
   - Good first proof that Convex can hold user-owned app data.
2. `profiles`
   - Needed before user-owned tables can be trusted.
3. `tradingAccounts`
   - Keep external IDs so old journal rows can still link during transition.
4. `tradingJournal`
   - Move after profiles/accounts are verified.
5. `notificationQueue`
   - Move after worker behavior is updated.
6. `priceSnapshots`
   - Store only latest price state, not tick history.

## Table Mapping

| Current source | Convex table | Notes |
| --- | --- | --- |
| `users` + `profiles` + `user_roles` | `profiles` | Preserve old user UUID as `externalUserId`. Keep email as the stable lookup. |
| `trading_accounts` | `tradingAccounts` | Preserve old account UUID as `externalId`. If this table is absent, skip. |
| `trading_journal` | `tradingJournal` | Preserve old row UUID as `externalId`. Use old `user_id` as `userId` until auth is migrated. |
| localStorage `positionSizeHistory` | `calculatorHistory` | Uses `clientId` for idempotent migration. |
| `price_cache` | `priceSnapshots` | Latest snapshot only. Disposable and can be rebuilt from Finnhub. |
| `push_notification_queue` + `email_queue` | `notificationQueue` | Normalize channel/status before importing. |

## Field Conversion Rules

- Convert timestamps to milliseconds since epoch with `Date.parse(value)`.
- Convert numeric strings from Postgres decimals to JavaScript numbers.
- Store old UUIDs in `externalId` or `externalUserId`.
- Keep user-owned rows keyed by the current backend `user.id` until auth migration is done.
- Do not import `password_hash` into Convex.
- Do not import high-frequency market ticks into Convex.

## First Feature Cutover

Calculator history is now wired as:

- signed-in user + `VITE_CONVEX_URL`: save/read/clear through Convex
- guest user or missing Convex URL: localStorage fallback
- old localStorage rows: one-time migration to Convex on `/history`

## Import Workflow

1. Export Postgres tables:

```bash
POSTGRES_EXPORT_DATABASE_URL="postgresql://..." ./scripts/export-postgres-for-convex.sh
```

2. Inspect generated JSONL files in `exports/convex`.
3. Transform rows into Convex shape before importing production data.

```bash
node scripts/transform-postgres-export-for-convex.mjs
```

4. Import one table into dev first:

```bash
npm run convex:data
npx convex import --table profiles exports/convex/profiles.jsonl --format jsonLines --append
```

Or import all transformed tables into dev:

```bash
./scripts/import-convex-ready-data.sh
```

5. Verify counts and sample rows.
6. Repeat on production only after dev is correct.

## Production Rule

Never run `--replace` or `--replace-all` on production unless a fresh backup exists and the migration has already been tested on dev.
