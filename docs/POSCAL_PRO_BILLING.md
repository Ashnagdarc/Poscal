# Poscal Pro: beta, billing and launch runbook

Implementation and research reviewed on 7 October 2026. This change is a replacement billing system, not a production launch. **Billing stays off unless an authenticated admin explicitly enables it.** Production deployment, gateway testing and backed-up live migration are separate release steps.

## Product policy

| Feature | Open beta / Pro | Free after beta |
| --- | --- | --- |
| Position sizing, calculator and existing calculator history | Available | Available |
| Economic calendar, news and existing alert preferences | Available | Available |
| Editable active journals | 5 | 1, with a one-time choice each Free period |
| New manual trades + notebook drafts | Unlimited | 15 combined per UTC calendar month |
| Existing trades and notebooks | Readable | Readable, with editing only in the chosen Free journal |
| Screenshots | 500 within 1 GiB | 5 within 10 MiB |
| Maximum compressed screenshot size | 2 MiB | 2 MiB |
| Basic trade count, win rate and P&L | Available | Available |
| Full journal analytics | Available | Pro preview and upgrade action |
| CSV export | Available | Available |
| CSV import | Available | Pro required |

Price: **₦2,500 monthly or ₦25,000 annually**. Annual saves ₦5,000 against twelve monthly purchases. Purchases are prepaid calendar periods with **no automatic renewal**. Month/year end dates clamp to the last valid day and preserve the UTC time. Early renewal starts at the current paid expiry; expiry after failed renewal is unchanged. Delayed activation after a backend outage grants the full purchased period from recovery, so users do not lose paid days waiting for confirmation.

The beta toggle grants Pro feature access with Pro storage/journal caps; it does not invent paid transactions or subscriptions. Beta creations do not consume the initial launch month's Free creation allowance. Once billing is enabled, creations made while paid count toward that month's counter; after expiry an already exceeded Free allowance blocks further creations until renewal or the next UTC month. Deleting a draft/trade does not refill the allowance.

Downgrade never deletes journals, notebooks or images. Extra journals are visibly read-only and remain navigable. Above-limit images remain viewable/downloadable; new reservations stop until usage is below the limit or Pro is active. In the chosen Free journal existing notebooks remain editable regardless of the historical notebook count. The notebook editor retains its existing local draft and pauses autosave while locked. Archived journals retain their normal archived behavior. Uploads already reserved before expiry can finish; new uploads require current eligibility. Pro cannot create a sixth active journal: archive one first. CSV export stays Free so users can retrieve their data.

These limits are product decisions, not measured statements about current user behavior. No live usage analysis or database queries were performed to justify them. Review aggregate journal, entry and image usage before changing the limits.

## Gateway decision and price comparison

Recommend **Paystack for this release** because the existing app already uses it and the replacement uses its server initialization, resumable InlineJS v2 checkout, verification and signed webhooks. Keep provider calls inside `convex/proPayments.ts`, the product policy in `shared/proPolicy.ts`, and entitlement changes inside `convex/proBilling.ts`. An Interswitch adapter can later supply independently verified proof without changing feature gates.

| Published local-card fee | ₦2,500 purchase | ₦25,000 purchase |
| --- | --- | --- |
| Paystack: 1.5% + ₦100; fixed fee waived **under** ₦2,500; ₦2,000 cap | ₦137.50 | ₦475 |
| Interswitch: 1.5%, ₦2,000 cap; published VAT exclusive | ₦37.50 before VAT | ₦375 before VAT |

These are calculations from the published fee schedules, not merchant-specific quotes or settlement guarantees. Interswitch is cheaper on these published local-card figures. At a 20% early-bird discount the monthly charge is ₦2,000, and Paystack's published fixed-fee waiver applies: 1.5% is ₦30. Confirm actual gateway channels, account eligibility, fee payer and applicable taxes in the merchant dashboard before launch. Do not silently add gateway fees to the quoted order.

Paystack's automatic subscriptions have different channel/retry constraints. This release deliberately uses one-time payments without Paystack plan codes: a plan code can override a discounted amount. Automatic recurring billing would require an explicit future product and consent change.

## Architecture and payment lifecycle

- `proAccounts`: one canonical entitlement per authenticated user, paid expiry, payment environment, current open order and Free journal selection.
- `proOrders`: server-created tracking reference `ppro-<orderId>`, user, immutable quote, plan, coupon, test/live mode, initialization code, provider ID, verified timestamps, status and next recovery check.
- `proCoupons`: admin-created codes with expiry, usage budget, optional plan restriction, beta-account cutoff, first-purchase eligibility and atomic reservation/redemption counters.
- `proUsage` plus the existing `userStorageUsage`: authoritative monthly creations and transactional upload reservations.
- `proWebhookEvents`: durable inbox keyed by raw-body digest. Stores identifiers, not full gateway/card data.
- `proBillingAudit`: admin launch, discount and migration audit records.
- `proLegacyPayments`: archival evidence retained before removing original legacy ledger rows.
- Existing `notificationQueue`: deduplicated email/device push outbox, committed alongside payment changes and delivered separately.

Flow: quote on the server → atomically create/reuse order → initialize gateway with that reference → resume hosted secure checkout → server verify → atomically commit order, access, discount redemption and notifications → resume the saved safe in-app destination.

Status is `initializing`, `pending`, `paid`, `failed`, `abandoned`, `review` or `reversed`. Only an internal server verification transition can grant paid access. Browser callbacks merely request a check. Public verification checks ownership; an admin override requires a real verified admin role. Client-supplied prices, tiers, user IDs or clocks cannot grant access. Test payments never grant live entitlements.

| Situation | Behavior |
| --- | --- |
| Double click, concurrent tabs or repeated requests | UI click guard plus transactional one-open-order guard; reuse the same reference and initialize once |
| Browser closes, refreshes or loses connection | Order survives; `/pro` finds the active checkout and history; resume the access code or hosted link |
| Provider debits user but callback/database confirmation is lost | Signed webhook inbox and scheduled reconciliation retry; no instruction to pay again while unresolved |
| Database transaction fails after external payment | No partial entitlement/outbox commit; durable order and expiring verification lease allow the next check to retry |
| Provider outage | Remain unconfirmed; preserve reference and financial holds; retry with backoff |
| Initialization never produces an access code | Only a provider 404 after two minutes on an undelivered, never-granted checkout allows a fresh attempt |
| Popup says success but provider says failed | No activation; server transaction status is authoritative |
| Saved database success disagrees with provider proof | Remove that order's grant and recompute other verified grants; quarantine mismatched details |
| Wrong amount/currency/reference/metadata/environment | Review required; no access granted |
| Duplicate success/webhook/retry | One grant, one discount redemption and deduplicated notifications |
| Provider transaction reused for a different order | Quarantine rather than fulfil twice |
| Failed renewal | Previous verified period remains available |
| Expired access | Mutations enforce server expiry immediately; UI refreshes every 15 seconds and on focus; old data remains readable |
| Refund, partial refund or dispute | Hold the affected order, recompute other valid grants, check separate refund/dispute APIs before any restoration |
| Refund event precedes provider list visibility | Preserve the signed hold; an empty list, verification outage or check started before a newer signed event cannot clear it |
| Provider review exceeds bounded recovery limits | Fail closed and require operator investigation; never silently truncate a financial ledger |
| User opens a different person's reference | Return no order and deny verification |

Each successful proof must match `data.status`, exact minor-unit amount, NGN currency, reference, order metadata, transaction ID and test/live domain. API-level `status: true` is not a successful payment. Provider timestamps must be valid and not materially in the future. Paystack HMAC SHA-512 validation uses the exact raw body and secret key before capture. A webhook is acknowledged only after its inbox row and recovery job commit. Polling starts every minute for due orders; browser polling stops after ten minutes, server recovery continues with backoff. Closed failed/abandoned orders are checked for 72 hours; later signed events can still trigger checks. Paid orders are periodically checked for reversals/refunds/disputes.

Refund/chargeback creation and dispute evidence submission are operator tasks in the gateway dashboard. This release does not automatically refund money or promise settlement. Financial reviews intentionally block re-payment on the same unresolved active order. For partial refunds, confirm the intended entitlement outcome before resolving the case.

## Discounts and early bird

Admin can create a case-insensitive code, 1–90% reduction, a future expiry, maximum uses and optional plan. The UI defaults to first-purchase and existing-beta-account eligibility. The beta cutoff is code creation time; create launch codes while the target beta cohort is known. Disable a code to stop new quotes. Codes apply to one purchase, do not stack, and do not permanently grandfather a renewal price. The server snapshots a quote at order creation; later code expiry or disabling does not change an already initialized charge.

Reservations use the same database transaction as order creation, including concurrent customers competing for the final slot. Terminal failures release a reservation exactly once. Real delayed successes are still honoured: if a failed/abandoned gateway session later changes to paid after its promotion slot was released, the ledger records and fulfils the payment even if the promotion's original budget has since filled. Operators must reconcile this rare late-payment exception rather than discard money received. Account history prevents ordinary reuse of a redeemed code, including after a refund.

Example early-bird offer: 20% on the first purchase, 30-day code expiry and 100 redemptions: monthly ₦2,000 / annual ₦20,000. Create it yourself in `/admin/billing`; no automatic promotion or billing activation is seeded.

## Checkout feel and continuation

A feature action opens an accessible Poscal Pro dialog describing the feature being unlocked. The same checkout is available on `/pro`; old `/upgrade` and `/pricing` URLs lead to this replacement. During beta it shows “Included during beta” and a Continue action, without a payment button. After launch it shows monthly/annual choices, discount application, final price, optional unfinished reminder and the no-auto-renewal statement.

Paystack opens only after a durable server order exists. The Poscal dialog closes first to avoid trapping focus around Paystack's iframe. Hosted checkout is the fallback. Pending/review screens display the immutable amount and reference, a status check and clear advice against paying twice. Confirmation appears after the backend reports paid. “Continue where you left off” uses the saved, sanitized internal path. Payment history is paginated and selection persists in the URL. Notebook local drafts survive the upgrade route; arbitrary unsaved calculator/manual trade forms are not newly persisted by this billing change.

## Emails and push

| Event | Delivery |
| --- | --- |
| Pending initialization/confirmation | Delayed ten minutes; suppressed if resolved first |
| Unfinished checkout | One reminder after one hour only when explicitly opted in |
| Verified success | Confirmation with plan, amount, expiry and reference |
| Verified failure/reversal | Status, reference and support/verification guidance |
| Refund/dispute/detail mismatch | Review notice; no false-success message |
| Expiring / expired | One-day warning and expiry notice; superseded renewals suppressed |

The email outbox is transactional and delivery uses the queue ID as a Resend idempotency key. Resend's idempotency retention is 24 hours; this is not a permanent exactly-once delivery guarantee. Device push uses the existing subscription and dedupe/tag handling; push requires browser permission and an active device subscription. Optional unfinished reminders use the same opt-in for both channels. Failed deliveries use the existing bounded retry/dead-letter behavior and must be monitored. No test emails or pushes were sent to real users during implementation.

## Configuration, deployment and safe legacy cleanup

1. **Keep billing off.** The new key is `poscal_pro_paid_features_enabled`; absence or false means beta. Old `signals_paid_lock_enabled` never enables the replacement. Do not seed the new key to true in a deployment.
2. Create a separate Convex preview deployment. Vercel preview builds require a scoped `CONVEX_PREVIEW_DEPLOY_KEY`; they refuse to use production as a fallback. Preview uses `PRO_PAYMENT_MODE=test`, `sk_test_…` and an HTTPS preview `PRO_APP_ORIGIN`. The production origins `https://poscalfx.com` or `https://www.poscalfx.com` require `PRO_PAYMENT_MODE=live` and `sk_live_…`.
3. Configure **Convex** `PAYSTACK_SECRET_KEY`, `PRO_PAYMENT_MODE`, `PRO_APP_ORIGIN`, `RESEND_API_KEY`, verified `EMAIL_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`. The readiness indicator checks presence/environment, not a completed gateway/delivery test. Keep secrets out of `VITE_*` variables and source control.
4. Set the Paystack webhook to `https://<deployment>.convex.site/billing/paystack-webhook`. The previous Vercel `/api/paystack-webhook` URL is only a raw signed transport compatibility alias; it requires **Vercel** `CONVEX_SITE_URL` pointing at the correct environment. It cannot grant access itself. New checkout does not need a public Paystack key.
5. Run `npm ci`, `npm run gate:fx`, targeted billing lint, and `npm run build`. Authenticate Convex to run native codegen/backend deployment validation. The tracked generated API typing has been updated locally; authenticated codegen must regenerate it before release. The Vercel build runs tests/typechecking and a frontend compilation before production backend deployment, then compiles with the deployed Convex URL.
6. On preview, manually enable billing using the preview admin, verify test card/bank transfer paths, close/resume, pending payments, duplicate clicks/webhooks, wrong proofs, expired access, uploads, renewals, coupons, refunds/disputes, email delivery and a real permitted push device. Disable preview billing afterward. Tests must never use production transactions.
7. Before production deployment, export and verify a full backup of legacy `paymentRecords`, users, profiles and app settings. Keep the evidence for each historical payment. Deploy the replacement with billing off, then use `/admin/billing` → verified backup checkbox → migrate batches of twenty.
8. Migration verifies legacy references against Paystack and separate financial APIs. It accepts only the original USD monthly 500 / yearly 5880 minor-unit contract, matching owner/plan metadata and environment. A saved success is insufficient. Pending payments, outages and mismatched successful proofs retain the original rows for investigation. Failed/reversed original claims are archived as rejected and cannot grant Pro. Verified remaining legacy periods are preserved, capped to their original duration; archive and replacement access commit atomically before deletion.
9. After the original ledger is empty, scheduled batches remove old payment/tier/expiry fields from users/profiles and delete the old flag. Verify the cleanup jobs and exports. The optional old schema fields, old expiry index and empty `paymentRecords` schema definition deliberately remain during this migration release so a deploy cannot erase unarchived evidence. **Remove those schema definitions and the migration-only functions in a follow-up deployment only after verified completion.** Financial archives remain for reconciliation; do not purge paid evidence just to remove the old UI.
10. Audit the gateway dashboard for unmatched legacy references, cached old checkout pages and old refunded/disputed transactions. Unknown signed references are captured in the inbox but are not silently mapped into a new user's subscription. Migrated legacy periods do not have new Pro order IDs and require gateway/operator reconciliation for subsequent disputes. Resolve these before launch; rotate/restrict legacy public checkout credentials and remove unused old environment variables only after checking remaining gateway uses.
11. Inform beta users in advance about date, Free limits, choice of journal, preserved data and the first-purchase offer. `/admin/billing` blocks activation while original legacy rows remain and requires explicit launch confirmation plus credential readiness. **Only you should press “End beta and enable Pro paywall.”** Disabling that same switch reopens beta immediately; it does not refund or delete valid paid orders.

Old payment modal, upgrade prompt, paid-lock hook, restore/sync/verify API grant paths and payment-specific Vercel expiry/reminder crons are removed. News, prices, authentication, normal notification jobs and journal data are retained. Older cached frontend versions may fail calls to retired APIs until refreshed; they cannot grant paid access. Plan the production frontend/backend cutover and PWA refresh, and monitor errors. Do not roll back to an old payment writer after migrating its database fields.

## Verification status and launch monitoring

Local verification: 521 tests across 41 files, frontend/Node/Convex and changed API typechecking, required `gate:fx`, frontend build, repository lint (warnings, no errors), and the CI coverage thresholds. The coverage set now includes the replacement billing engine, entitlement helper and checkout alongside the existing calculator files: 73.14% lines, 72.05% statements, 70.65% functions and 65.8% branches, without lowering thresholds. Regression cases cover mode isolation, exact expiry, raw webhook signatures, duplicate creation/fulfilment, mismatch/failure/outage recovery, refund holds through outages and newer events, renewals, provider initialization contract, promotion races/repeated failures, quota reservation races, beta data preservation and safe legacy migration. UI component tests cover beta visibility, click dedupe and backend-only activation.

Native authenticated Convex deployment, full browser visuals and real gateway/email/device delivery remain release checks. This workspace has no authenticated Convex deployment credential; its browser download was unavailable and the remote browser cannot reach the local fixture. Local tests are not a claim of live end-to-end validation or zero defects. A pre-existing `no-control-regex` lint error in `convex/lib/welcomeEmailCopy.ts` was corrected with equivalent character filtering so the CI lint step can pass; other repository lint warnings remain.

The repository's Codacy instructions were checked, but no Codacy MCP tools are available in this session. Local lint/typechecking/tests and npm dependency audit are the available checks. To restore Codacy-specific analysis, reset the extension's MCP connection, check [GitHub Copilot MCP settings](https://github.com/settings/copilot/features) if using VSCode, and contact Codacy support if the connection remains unavailable. No Codacy check is represented as completed.

**Dependency audit is an additional release concern:** npm audit reports 54 findings (5 critical, 36 high, 13 moderate). Comparing every reported vulnerable package path and installed version against the original lockfile shows zero newly added vulnerable paths and zero changed vulnerable versions: the findings predate this billing change. Do not describe the whole app as vulnerability-free or activate real payment collection without reviewing the existing dependency findings. Broad forced upgrades were not applied because the suggested fixes include framework/tooling changes that need their own regression review.

The admin view exposes the latest 25 orders, codes and reference verification; customer history is paginated. This is not a complete billing conversion dashboard. Before launch, monitor the ledger/queue and gateway dashboard for: pending age, oldest recovery lease, unverified successes, refund/dispute holds, coupon reserved versus redeemed counts, failed deliveries and unmatched webhook references. Reconcile by payment reference and provider ID every day. Alert on paid-provider/unpaid-app disagreement and stop new payment collection if it grows.

For product analytics, define authenticated server outcomes rather than treating popup callbacks as revenue: checkout attempts, verified first purchases/renewals, time to activation, failed/abandoned/review outcomes, expired users, read-only journal usage, quota hits, renewal rate and discount net receipts. Actual funnel instrumentation, aggregate reporting and empirical Free-limit tuning are follow-up work; no measured conversion rate is asserted here.

Account deletion, billing-record retention and restore procedures must be reviewed alongside the existing account deletion flow before production launch. Keep financial records as required for support/accounting and avoid retaining full gateway payloads or card authorizations. Notification permission loss never changes paid access.

## Primary sources

- [Paystack Nigeria pricing](https://paystack.com/pricing)
- [Interswitch pricing and payment channels, 27 March 2026](https://interswitchgroup.com/blog/how-interswitch-payment-gateway-is-redefining-digital-payments-in-nigeria/)
- [Interswitch Web Checkout and server requery](https://docs.interswitchgroup.com/docs/web-checkout)
- [Paystack transaction initialization contract](https://paystack.com/docs/api/transaction/)
- [Paystack server verification and duplicate fulfilment guidance](https://paystack.com/docs/payments/verify-payments/)
- [Paystack signed webhooks and retries](https://paystack.com/docs/payments/webhooks/)
- [Paystack InlineJS initialization and resume](https://paystack.com/docs/developer-tools/inlinejs/)
- [Paystack subscriptions and channel/retry constraints](https://paystack.com/docs/payments/subscriptions/)
- [Paystack refund API](https://paystack.com/docs/api/refund/)
- [Paystack dispute API](https://paystack.com/docs/api/dispute/)
- [Paystack dispute handling](https://paystack.com/docs/payments/manage-disputes/)
- [Convex action transaction boundaries](https://docs.convex.dev/functions/actions)
- [Convex backend testing](https://docs.convex.dev/testing/convex-test)
- [Resend email idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
