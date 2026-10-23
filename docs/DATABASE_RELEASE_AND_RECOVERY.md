# Database release and recovery policy

Poscal production data lives in the self-hosted Convex deployment at
`https://convex.poscalfx.com`. Branch testing, schema rehearsal and migration
development must never use that deployment.

## Environment boundaries

| Environment | Backend | Data | Purpose |
| --- | --- | --- | --- |
| Development | local Convex or a developer-only self-hosted deployment | synthetic data | normal implementation work |
| Staging | a separate self-hosted Convex installation | synthetic or explicitly approved snapshot | release and migration rehearsal |
| Production | `https://convex.poscalfx.com` on Openship | live user data | reviewed releases only |
| Cloud DR standby | `helpful-sturgeon-546` in the existing `Poscalfx` project | daily replace-all snapshot | recovery only; never normal app traffic |

Convex Cloud is not a normal Poscal deployment target. The repository guards
continue to reject `*.convex.cloud` for builds, releases and application
functions. The only exception is the dedicated data-only DR workflow, whose
separate guard pins the source and destination exactly.

The current Openship host is not an appropriate place for another permanent
Convex installation without a capacity change: staging should run on a separate
server so a production host outage cannot take out both environments.

## Required release flow

1. Open a pull request. CI must pass lint, typecheck, unit tests and the browser
   smoke test.
2. Review every schema or data change for backward compatibility. Use additive
   fields/indexes first; make backfills resumable and idempotent.
3. Deploy the exact commit to the isolated staging Convex deployment with
   `npm run convex:deploy:staging`.
4. Rehearse any import/backfill in staging. Record table counts and critical
   invariants before and after the rehearsal.
5. Test the staging frontend against the staging backend. Production URLs are
   rejected by the build guard.
6. Merge only after review. Before a production backend release, create and
   verify a fresh off-server backup.
7. For the approved release invocation only, set
   `POSCAL_PRODUCTION_APPROVAL=deploy:convex.poscalfx.com`, then run
   `npm run convex:deploy:production`.
8. Verify sign-in, user counts, journal reads/writes, billing access and error
   logs. Roll forward or restore using the incident flow below.

The production approval variable is intentionally action-scoped. Do not save it
in an environment file or CI secret.

## Staging environment file

Copy `.env.staging.example` to `.env.staging.local` and fill it with the
isolated self-hosted staging URL and admin key. Completed environment files are
gitignored. A staging deploy fails if its URL equals production or if it points
to Convex Cloud.

## Backup policy

Production has two distinct backup needs:

1. **Infrastructure recovery:** Openship snapshots the Convex backend's
   persistent volumes to the private `r2-poscal-backups` destination.
2. **Portable data recovery:** a Convex logical export can be imported into a
   separate compatible deployment. Logical exports must include Convex file
   storage where it is used.

The Openship volume policy must be enabled with:

- daily schedule;
- seven successful restore points retained;
- R2 as the off-server destination;
- a pre-deploy snapshot once the backup duration is proven acceptable;
- pruning only after a newer backup has succeeded.

Never delete the only known-good restore point. Retention cleanup is allowed
only after the newest run is `Succeeded`, has a non-zero archive size, and the
R2 destination verification is current. At least two successful copies must
remain after any manual deletion.

## Convex Cloud DR refresh

The `Convex Cloud DR refresh` GitHub Actions workflow runs at 04:30 Africa/Lagos,
after the Openship backup window. It exports the self-hosted production data and
file storage directly to an ephemeral GitHub runner, validates the ZIP, imports
it atomically with `--replace-all` into `helpful-sturgeon-546`, and compares
critical table counts. The ZIP is never uploaded as a GitHub artifact and is
deleted from the runner after the job.

Required GitHub Actions secrets:

- `POSCAL_SELF_HOSTED_CONVEX_ADMIN_KEY`: the self-hosted production admin key;
- `POSCAL_CLOUD_DR_DEPLOY_KEY`: a key scoped to `helpful-sturgeon-546` with only
  data view and backup import access.

The workflow deliberately does not deploy Convex functions or environment
variables to Cloud. This prevents scheduled jobs, email, notification and
billing side effects while the standby is being refreshed. A failover requires
a reviewed runbook step to deploy the matching code and secrets, switch routing,
and preserve the single-writer rule.

## Verification and restore drills

A green upload is necessary but not sufficient. Monthly:

1. Provision a throwaway, isolated self-hosted Convex deployment.
2. Restore the selected backup or import the logical export there, never into
   production.
3. Deploy the matching Git revision and environment-variable set.
4. Compare table counts and verify representative auth, user, journal,
   subscription and file-storage records.
5. Record recovery time and failures, then destroy the throwaway deployment.

The target objectives are a 24-hour recovery point (daily backups) and a
four-hour recovery time once the restore drill is automated and proven.

## Incident recovery

1. Stop writers or put the frontend in maintenance mode.
2. Preserve the damaged state with a new backup if the incident permits it.
3. Select a verified restore point and restore into isolation first.
4. Confirm counts and invariants, then explicitly approve the destructive
   production restore.
5. Restore code and environment variables separately; Convex data snapshots do
   not contain either.
6. Re-enable traffic gradually and monitor errors, authentication and writes.

## Cloud failover limitation

Periodic export/import is a backup and standby refresh, not live replication.
Running two writable Convex deployments would create divergent IDs, auth state,
scheduled jobs and application data. Poscal therefore has one writable
production deployment. A future managed-cloud failover requires an explicit
architecture change, tested cutover routing and a single-writer procedure; it
must not be described as automatic sync until those are implemented and tested.
