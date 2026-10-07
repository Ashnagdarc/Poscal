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

Price: **₦2,500 monthly or ₦25,000 annually**. Annual saves ₦5,000 against twelve monthly purchases. Purchases are prepaid calendar periods. **Auto-renew is off by default and only activates when the user explicitly opts in and Paystack returns a verified reusable authorization.** Month/year end dates clamp to the last valid day and preserve the UTC time. Early renewal starts at the current paid expiry; expiry after failed renewal is unchanged. Delayed activation after a backend outage grants the full purchased period from recovery, so users do not lose paid days waiting for confirmation.

The beta toggle grants Pro feature access with Pro storage/journal caps; it does not invent paid transactions or subscriptions. Beta creations do not consume the initial launch month's Free creation allowance. Once billing is enabled, creations made while paid count toward that month's counter; after expiry an already exceeded Free allowance blocks further creations until renewal or the next UTC month. Deleting a draft/trade does not refill the allowance.

Downgrade never deletes journals, notebooks or images. Extra journals are visibly read-only and remain navigable. Above-limit images remain viewable/downloadable; new reservations stop until usage is below the limit or Pro is active. In the chosen Free journal existing notebooks remain editable regardless of the historical notebook count. The notebook editor retains its existing local draft and pauses autosave while locked. Archived journals retain their normal archived behavior. Uploads already reserved before expiry can finish; new uploads require current eligibility. Pro cannot create a sixth active journal: archive one first. CSV export stays Free so users can retrieve their data.

These limits are product decisions, not measured statements about current user behavior. No live usage analysis or database queries were performed to justify them. Review aggregate journal, entry and image usage before changing the limits.

## Gateway decision: Paystack

**Paystack is the production payment provider for this architecture.** Checkout uses server initialization, resumable InlineJS v2 checkout, server verification and signed webhooks. Automatic renewal uses Paystack reusable authorizations and `/transaction/charge_authorization`; it does not use Paystack plan codes, because a gateway plan can override Poscal's server-owned quoted amount and discount logic.

Published Nigeria local-card pricing at review time is 1.5% + ₦100, with the fixed ₦100 waived for transactions under ₦2,500 and a ₦2,000 cap. At ₦2,500 the published fee calculation is ₦137.50. At ₦25,000 it is ₦475. At a 20% early-bird monthly price of ₦2,000, the fixed fee is waived under the published rule and 1.5% is ₦30. These are public fee calculations, not a merchant-specific settlement guarantee. Confirm the merchant dashboard before launch.

For recurring charges, only a **verified authorization with `reusable: true`** can be stored for auto-renew. Store the authorization token and the original payment email required by Paystack. Never store PAN, CVV or PIN. Automatic renewal creates a normal immutable `proOrder`, charges using the stored authorization, then independently verifies that same order reference before granting or extending access.

Auto-renew consent is price-specific. The opt-in shows the standard renewal price separately from any discount on the first purchase. `proAccounts` stores the consented renewal amount and billing policy version. An automatic charge is permitted only while that saved amount still exactly matches the server-owned current price and policy version. A price/policy change disables auto-renew and erases the reusable authorization, requiring a fresh explicit payment opt-in. Turning auto-renew off also erases the stored reusable authorization locally; re-enabling therefore requires a new explicit Paystack payment. Repeated terminal renewal failures and stale renewal state eventually fail closed and erase the authorization rather than leaving a dormant debit credential.

A network timeout during an automatic charge is treated as financially ambiguous. Poscal does not create a new debit immediately. It keeps the same order/reference and verifies that reference first. If the provider confirms the reference is absent after the recovery window, the attempt can become terminal and a later bounded retry may be scheduled. A charge already submitted to Paystack before cancellation/account deletion may still settle; if account deletion has started, any later verified settlement is quarantined for operator review/refund instead of restoring access.
## Architecture and payment lifecycle

- `proAccounts`: one canonical entitlement per authenticated user, paid expiry, current open order, Free journal selection, and optional Paystack auto-renew authorization plus exact consented renewal amount/policy state.
- `proOrders`: server-created tracking reference `ppro-<orderId>` for checkout or `ppro-auto-<orderId>` for auto-renew, user, immutable quote, source, plan, coupon, test/live mode, provider ID, verified timestamps, status and next recovery check.
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
| Failed manual renewal | Previous verified period remains available |
| Auto-renew timeout | Keep the same order/reference and verify it before any retry; never create an immediate second debit |
| Auto-renew failure | Retry is bounded; after repeated failures auto-renew is disabled, the reusable authorization is erased, and existing paid access remains valid until expiry |
| Auto-renew price/policy mismatch | Do not charge; disable auto-renew, erase the reusable authorization and require fresh consent |
| User cancels auto-renew | Stop future scheduled debits and erase the reusable authorization locally; a charge already submitted may still complete |
| Admin billing kill switch | Stops new checkout initialization and due auto-renew charges; existing verified access remains valid |
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

A feature action opens an accessible Poscal Pro dialog describing the feature being unlocked. The same checkout is available on `/pro`; old `/upgrade` and `/pricing` URLs lead to this replacement. During beta it shows “Included during beta” and a Continue action, without a payment button. After launch it shows monthly/annual choices, discount application, final price, optional unfinished reminder and a separate auto-renew opt-in. Auto-renew is never preselected. The opt-in states the exact standard amount that future automatic renewals may charge, even when the current checkout is discounted, and explains that a later price-policy change requires fresh consent.

Paystack opens only after a durable server order exists. The Poscal dialog closes first to avoid trapping focus around Paystack's iframe. Hosted checkout is the fallback. Pending/review screens display the immutable amount and reference, a status check and clear advice against paying twice. Confirmation appears after the backend reports paid. “Continue where you left off” uses the saved, sanitized internal path. Payment history is paginated and selection persists in the URL. Notebook local drafts survive the upgrade route; arbitrary unsaved calculator/manual trade forms are not newly persisted by this billing change.

## Emails and push

| Event | Delivery |
| --- | --- |
| Pending initialization/confirmation | Delayed ten minutes; suppressed if resolved first |
| Unfinished checkout | One reminder after one hour only when explicitly opted in |
| Verified success | Confirmation with plan, amount, expiry, reference and whether auto-renew was successfully enabled |
| Auto-renew failure | Payment status plus bounded retry/disable behavior; no false success |
| Verified failure/reversal | Status, reference and support/verification guidance |
| Refund/dispute/detail mismatch | Review notice; no false-success message |
| Expiring / expired | One-day warning and expiry notice; superseded renewals suppressed |

The email outbox is transactional and delivery uses the queue ID as a Resend idempotency key. Resend's idempotency retention is 24 hours; this is not a permanent exactly-once delivery guarantee. Device push uses the existing subscription and dedupe/tag handling; push requires browser permission and an active device subscription. Optional unfinished reminders use the same opt-in for both channels. Failed deliveries use the existing bounded retry/dead-letter behavior and must be monitored. No test emails or pushes were sent to real users during implementation.

## Cookies, analytics and consent

Poscal uses a versioned consent record and separates **Necessary**, **Preferences**, **Analytics** and **Marketing** categories. Necessary storage remains available for authentication, security, core app behavior and the consent record itself. Optional categories default off until the user chooses.

- Vercel Analytics is mounted only after Analytics consent.
- Sentry initialization and exception transmission are gated by Analytics consent.
- Payment-sensitive URL parameters such as `reference`, `trxref`, `access_code`, `token`, `returnTo` and `redirectPath` are removed from analytics event URLs before transmission.
- The optional sidebar preference cookie is written only after Preferences consent and uses `SameSite=Lax; Secure`.
- The Privacy page provides a control to reopen privacy choices.
- Marketing consent is separate and is not required to use Poscal.
- Auto-renew consent, unfinished-checkout reminder consent and analytics/marketing consent are separate decisions.

This consent layer does not replace a legal review of Poscal's full storage inventory, cross-border processing, retention schedule or jurisdiction-specific obligations.

## Journal and account deletion safety

Whole-journal deletion is asset-aware and resumable. The client calls `/api/journal-book`; the server marks the journal for deletion, prepares bounded trade batches, deletes each R2 object idempotently, finalizes trade/notebook/attachment metadata, cleans bounded history/session rows and projections, then removes the parent only when child cleanup is complete. Cached clients cannot use the old destructive shortcut on non-empty journals.

Account deletion uses the same principle through `/api/account-delete`. The first step records an explicit deletion session and **immediately disables auto-renew and erases the reusable Paystack authorization**, before slower journal/R2 cleanup begins. The endpoint then removes journals and orphan entries in resumable bounded batches. Final user deletion is refused while any journal, trade or attachment remains.

Open payment records are not allowed to recreate an account or entitlement after deletion starts. A payment that settles after the deletion marker exists is quarantined in `review` for operator investigation/refund. Historical `proOrders` may remain as a minimal financial ledger for accounting, dispute and legal evidence, but the reusable authorization lives only on `proAccounts` and is removed when deletion begins. The exact financial-record retention period still requires an accounting/legal retention policy before production launch.
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

The branch gate is intentionally fail-closed. Vercel runs `gate:fx`, TypeScript checks and the full Vitest suite before it attempts any Convex preview deployment. Completed branch builds during this review have proven the gate can reach and run the test suite; subsequent defects found during review were reproduced by that gate and corrected rather than waived. **The final release count must be taken from the latest head build, not copied from an older commit.**

The preview deployment itself is still blocked until a dedicated `CONVEX_PREVIEW_DEPLOY_KEY` is configured. That is deliberate: the billing preview must never fall back to the production Convex backend. Therefore browser-to-Convex-to-Paystack end-to-end behavior, real Paystack test checkout/authorization, signed webhook delivery, scheduled auto-renew, refund/dispute handling, Resend delivery and a permitted real push device remain mandatory release checks.

GitGuardian has reported no committed secrets on reviewed PR commits. GitHub Actions has also shown a separate runner/job-start failure in which the quality job produced no executable steps and Playwright was skipped; available logs do not establish a code failure for that runner issue. Do not waive it: restore a green GitHub CI path before merge so the repository has an independent required check in addition to Vercel.

**Dependency security remains a release concern.** A prior audit in this runbook recorded 54 findings (5 critical, 36 high, 13 moderate). This review did not independently establish that every finding predates the billing branch, so that claim is not relied on. Re-run the dependency audit on the final lockfile, determine reachability of every critical/high finding, remediate or explicitly accept each risk, and re-run regression tests before enabling live billing.

The admin view exposes the latest orders, codes and reference verification; customer history is paginated. This is not a complete billing conversion dashboard. Before launch, monitor the ledger/queue and Paystack dashboard for pending age, oldest recovery lease, unverified successes, refund/dispute holds, coupon reserved versus redeemed counts, auto-renew attempts/failures, failed deliveries and unmatched webhook references. Reconcile by payment reference and provider ID every day. Alert on paid-provider/unpaid-app disagreement and stop new payment collection if it grows.

For product analytics, define authenticated server outcomes rather than treating popup callbacks as revenue: checkout attempts, verified first purchases/renewals, time to activation, failed/abandoned/review outcomes, expired users, read-only journal usage, quota hits, renewal rate and discount net receipts. Actual funnel instrumentation, aggregate reporting and empirical Free-limit tuning are follow-up work; no measured conversion rate is asserted here.

## Primary sources

- [Paystack Nigeria pricing](https://paystack.com/pricing)
- [Paystack transaction initialization contract](https://paystack.com/docs/api/transaction/)
- [Paystack server verification and duplicate fulfilment guidance](https://paystack.com/docs/payments/verify-payments/)
- [Paystack signed webhooks and retries](https://paystack.com/docs/payments/webhooks/)
- [Paystack InlineJS initialization and resume](https://paystack.com/docs/developer-tools/inlinejs/)
- [Paystack recurring charges and reusable authorizations](https://paystack.com/docs/payments/recurring-charges/)
- [Paystack charge authorization API](https://paystack.com/docs/api/transaction/#charge-authorization)
- [Paystack refund API](https://paystack.com/docs/api/refund/)
- [Paystack dispute API](https://paystack.com/docs/api/dispute/)
- [Paystack dispute handling](https://paystack.com/docs/payments/manage-disputes/)
- [Convex action transaction boundaries](https://docs.convex.dev/functions/actions)
- [Convex backend testing](https://docs.convex.dev/testing/convex-test)
- [Resend email idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [ICO cookies and similar technologies guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/)
- [Vercel Analytics sensitive-data redaction](https://vercel.com/docs/analytics/redacting-sensitive-data)
