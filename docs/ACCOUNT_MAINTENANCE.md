# Account maintenance rollout

The frontend defaults to account maintenance while this server incident is being resolved. It does not mount authentication, journal, subscription, push or offline replay providers. Existing sessions, account caches and journal data are not deleted. No database migration or Convex deployment is required for this UI change.

Both `/` and `/calculator` show the existing sizing calculator plus a maintenance notice. Terms and privacy remain available. All other frontend routes, including saved journal links, authentication forms, billing and administration, show the account maintenance screen and a calculator link. The calculator profile action is hidden and journal saving is disabled. It still uses the existing static broker specifications and public conversion-rate feeds, with the existing manual rate inputs if feeds fail.

## Openship

1. Deploy this branch's frontend build to the existing **Poscal** project, using its current self-hosted URLs and normal `npm run build:openship` / `npm run start:openship` commands. Do not deploy to Convex cloud.
2. `VITE_ACCOUNT_MAINTENANCE=true` explicitly keeps the outage shell enabled. It is enabled when unset as well, so the emergency build needs no backend configuration changes.
3. Check `/`, `/calculator`, `/signin`, `/signup`, `/forgot-password`, `/verify-email`, `/journal`, a saved trade URL and an existing signed-in browser. Verify the calculator is usable without any account-server responses. Installed PWAs need to accept the update/reload to receive the new shell.
4. Once the backend is healthy, set `VITE_ACCOUNT_MAINTENANCE=false` in the **frontend build environment** and rebuild/redeploy. This restores the normal application. Changing a runtime variable alone does not change a Vite bundle.

This is a frontend access pause. It does not revoke tokens or disable Convex authentication endpoints for old clients or direct requests. Backend-wide shutdown would require a separate server-side control and deployment. The frontend itself must still be served for the notice and calculator to be reachable; if the entire VPS is unreachable, recover serving or use an existing alternative frontend host first.

Validation: `npm run typecheck`, `npm run build`, `npm run build:server`, and `CONVEX_URL=https://convex.poscalfx.com VITE_CONVEX_URL=https://convex.poscalfx.com npm test`. The unit suite uses mocks and local data; these URLs supply configuration only. Dedicated browser checks: `npx playwright test --config playwright.maintenance.config.ts` against a maintenance build. This workspace could not launch Chromium because local socket creation was denied, so browser checks must be run in an environment that permits it.
