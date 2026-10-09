# Poscal production authentication recovery — Oct 9, 2026

**Status: migration gate ACTIVE. Do not merge until the source parity check passes.**

## What happened

A manual CLI deployment updated the live Vercel frontend and Convex backend to
Brevo email verification, without committing the matching sources to GitHub
`main`. GitHub `main` still imports Resend for email verification, password
reset, and welcome email. It also contains older verification UI code.
The existing production Vercel build script could automatically redeploy
Convex from `main`, replacing functions and schema/indexes in the live backend.

The October 9 login hotfix removed the sign-in-only 10-character password check,
which was wrongly rejecting existing passwords before server authentication.
**Keep 10-character rules for registration and password changes**, not sign-in.

## Verified read-only Vercel source recovery

The connected Vercel file-content action truncates large source files. Do not
copy its partial base64 output. To retrieve complete source without
reconstructing Brevo provider identifiers from memory:

1. On a machine with the official Vercel CLI and project access, run
   `npx vercel login` (do not send anyone a Vercel token).
2. Check out branch `fix/production-auth-signin-recovery`.
3. Run `node scripts/recover-vercel-production-auth.mjs`.
4. The script requests only the 11 pinned Oct 9 production auth source files
   using Vercel's authenticated deployment-file API. It verifies SHA-1 hashes
   against the live deployment before writing anything.
5. The verified files are saved **outside** the Git repository, by default
   to `~/poscal-brevo-recovery-2026-10-09`. The script refuses to overwrite
   an existing directory and never deploys or changes environment variables.
6. Review each file for embedded secrets, then copy only verified auth files
   into the dedicated recovery branch. Run
   `node scripts/check-production-brevo-parity.mjs` and compare all other
   runtime code/config against the production source manifest.
7. Keep this PR in draft until production-source parity and end-to-end
   account flows pass. Merge the separate quotation-precision PR only after
   the live auth baseline is versioned and deployment-safe.

If the Vercel API cannot return a complete file, use the **original local
checkout** that created the successful October 9 CLI deployment; validate it
with the same parity gate. Do not reconstruct auth files from memory.
Do not upload credentials, a user database, or a production `.env` file.

## Required exact source

The live **production** baseline is Vercel
`dpl_HzDqNJPgwhUKTuovf3cpKrvzs2H1`, with Convex
`helpful-sturgeon-546`. Use the **local project folder that produced this
manual deployment**, or a verified clean archive of that folder (exclude
`.env*`, `.vercel`, credentials, personal data, and `node_modules`).

Import the following exact files, preserving provider IDs and rate-limit
behaviour. Run `node scripts/check-production-brevo-parity.mjs`:

- `convex/BrevoOTP.ts`
- `convex/BrevoOTPPasswordReset.ts`
- `convex/lib/brevoEmail.ts`
- `convex/auth.ts`
- `convex/authRateLimit.ts`
- `convex/lib/welcomeEmailCopy.ts`
- `convex/lib/emailVerificationPolicy.ts`
- `convex/welcomeEmail.ts`
- `convex/schema.ts`
- `src/pages/VerifyEmail.tsx`
- `src/pages/ForgotPassword.tsx`

The parity script checks SHA-1 content IDs recorded by Vercel for these files.
It should be run before merging. The sign-in, AuthContext, and error-mapping
files from the reviewed hotfix are intentionally allowed to differ.

Also compare the other production-source files (especially `package.json`,
`package-lock.json`, `src/pages/SignUp.tsx`, and `src/App.tsx`) against
`main` for unrelated drift. Do not copy preview-billing code.

## Email-provider migration

- **Authentication:** use the exact production `BrevoOTP` and
  `BrevoOTPPasswordReset` providers. Do NOT change provider IDs, flow types,
  existing account IDs, hashes, pending verification state, or users table.
- **Welcome email:** restore Brevo implementation and verify it does not send
  duplicate welcome and OTP emails at signup.
- **Scheduled reminders:** `api/scheduled-reminder.ts` still uses Resend.
  Migrate this separately and test the cron before removing Resend completely.
  Do not disable reminders accidentally.
- **Secrets:** ensure `BREVO_API_KEY`, the authorized sender, and
  `REQUIRE_EMAIL_VERIFICATION=true` remain in production **Convex** env.
  Do not put these keys into `VITE_*`, Git, tests, or pull requests.
- Remove obsolete `convex/ResendOTP*.ts` only after restoring the exact
  Brevo sources and confirming no active references. Remove the `resend`
  npm package or legacy Vercel Resend env only once **all** consumers
  (including scheduled reminders) have migrated.

## Release gates

1. Preserve/record existing production deployment ID and current Convex
   deployment; confirm the rollback owner.
2. Pass `node scripts/check-production-brevo-parity.mjs`.
3. Pass `npm ci`, `npm run typecheck`, `npm run test`,
   `npm run gate:fx` and `npm run build`.
4. Test real login, wrong password, existing short password, email verification
   first attempt/resend/expired code, signup, welcome and forgot/reset password
   on a staging environment against an **isolated** backend when mutation is
   required. Do not create test accounts in live production.
5. Compare Convex schema/indexes with production. The app's Vercel build now
   deliberately **never deploys Convex automatically**.
   If a backend release is needed, review `npx convex deploy --dry-run`
   plus Convex dashboard changes under a separate release approval; do not
   permit deletion of any unexpected indexes/functions. Dry-run alone is not
   proof of safe schema migration.
6. Exclude `codex/poscal-pro-billing` and all preview-only Paystack/paywall
   changes.
7. Merge the reviewed auth PR only after source parity and checks pass.
   Vercel should build the **frontend only** from `main`; observe the
   production Vercel output and confirm it did NOT run `convex deploy`.
8. Smoke test production (desktop, mobile PWA, existing user with old password,
   already-verified user, unverified user, password reset). Monitor Convex
   auth logs and Brevo deliveries. Never ask users for passwords or codes.
9. If frontend regression: roll back Vercel to the recorded production
   deployment. If backend was changed separately, frontend rollback alone is
   insufficient: run the documented Convex recovery procedure too.
10. Once the production Brevo source is permanently versioned and reconciled,
    replace the one-time SHA gate with regression tests and a reviewed release
    manifest; retain the separate approval requirement for backend deployments.

## Work status

- Existing users confirmed they can log in on the controlled, patched preview
  `dpl_5G3xBa4dPKKGSAvnHg36189vsk3a`.
- The source-preserving preview passed 506 automated tests and frontend build.
- Production was not switched in that release because the production
  deployment action was blocked.
- Until the full Brevo source is versioned, auto-deploy from old `main`
  must remain blocked, not silently revert production auth.
