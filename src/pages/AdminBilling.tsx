import { useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminBilling() {
  const overview = useQuery(api.proBilling.adminOverview, {});
  const setEnabled = useMutation(api.proBilling.setEnabled);
  const createCoupon = useMutation(api.proBilling.createCoupon);
  const toggleCoupon = useMutation(api.proBilling.toggleCoupon);
  const migrate = useAction(api.proPayments.migrateLegacyBatch);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [migrationResult, setMigrationResult] = useState("");
  const checkPayment = useAction(api.proPayments.checkPayment);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("20");
  const [uses, setUses] = useState("100");
  const [expiry, setExpiry] = useState("");
  const [betaOnly, setBetaOnly] = useState(true);
  const [reference, setReference] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
      toast.success("Billing settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!overview) return <main className="p-6">Loading billing controls…</main>;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <div>
        <h1 className="text-2xl font-bold">Poscal Pro billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {overview.enabled
            ? "Paid features are enabled."
            : "Beta is open. The paywall and payments are off."}
        </p>
      </div>
      <section className="space-y-3 rounded-2xl border border-border p-5">
        <h2 className="font-semibold">End beta when you are ready</h2>
        <p className="text-sm text-muted-foreground">
          Free will allow one editable journal, 15 new entries each UTC month, 5
          screenshots within 10 MB and basic analytics. Extra data stays
          readable. Pro is ₦2,500 monthly or ₦25,000 yearly with no automatic
          charge.
        </p>
        <p className="text-sm">
          Gateway, email and push configuration:{" "}
          {overview.ready ? "Ready for testing" : "Incomplete"}
        </p>
        {overview.legacyPresent && (
          <p className="text-sm text-destructive">
            Legacy payments need migration and independent verification before
            launch.
          </p>
        )}
        {!overview.enabled && (
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have tested checkout and informed beta users of the Free limits.
          </label>
        )}
        <Button
          disabled={
            busy ||
            (!overview.enabled &&
              (!confirmed || !overview.ready || overview.legacyPresent))
          }
          onClick={() =>
            void run(() =>
              setEnabled({
                enabled: !overview.enabled,
                confirmLaunch: confirmed,
              }),
            )
          }
        >
          {overview.enabled
            ? "Switch billing off and reopen beta"
            : "End beta and enable Pro paywall"}
        </Button>
      </section>
      {
        <section className="space-y-3 rounded-2xl border border-border p-5">
          <h2 className="font-semibold">Migrate the legacy ledger</h2>
          <p className="text-sm text-muted-foreground">
            Exports must be backed up first. Each payment is verified against
            Paystack, refunds and disputes before it is archived. Provider
            outages or unresolved cases keep the original record in place.
          </p>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={backupConfirmed}
              onChange={(e) => setBackupConfirmed(e.target.checked)}
            />
            I have exported and verified the database backup.
          </label>
          <Button
            disabled={busy || !backupConfirmed}
            onClick={() =>
              void run(async () => {
                const result = await migrate({ backupConfirmed });
                setMigrationResult(
                  `${result.archived} archived. ${result.remaining ? "More records remain." : "Migration complete."} ${result.errors.join(" ")}`,
                );
              })
            }
          >
            Verify and migrate next 20 payments
          </Button>
          {migrationResult && (
            <p className="break-all text-sm" role="status">
              {migrationResult}
            </p>
          )}
        </section>
      }
      <section className="space-y-3 rounded-2xl border border-border p-5">
        <h2 className="font-semibold">Discount and early-bird codes</h2>
        <p className="text-sm text-muted-foreground">
          Codes apply once per account to a purchase. They do not stack. Renewal
          uses the current published price.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Code
            <input
              className="mt-1 w-full rounded-lg border bg-background p-2"
              value={code}
              maxLength={32}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Percentage off
            <input
              type="number"
              min={1}
              max={90}
              className="mt-1 w-full rounded-lg border bg-background p-2"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Maximum uses
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border bg-background p-2"
              value={uses}
              onChange={(e) => setUses(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Valid until
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border bg-background p-2"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </label>
        </div>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={betaOnly}
            onChange={(e) => setBetaOnly(e.target.checked)}
          />
          Early-bird: only accounts existing when this code is created
        </label>
        <Button
          disabled={busy || !code || !expiry}
          onClick={() =>
            void run(() =>
              createCoupon({
                code,
                percentOff: Number(percent),
                maxUses: Number(uses),
                validUntilMs: new Date(expiry).getTime(),
                firstPurchaseOnly: true,
                betaUsersOnly: betaOnly,
              }),
            )
          }
        >
          Create code
        </Button>
        {overview.coupons.map((coupon) => (
          <div
            key={coupon._id}
            className="flex items-center justify-between gap-3 border-t pt-3 text-sm"
          >
            <span>
              {coupon.code}: {coupon.percentOff}% · {coupon.redeemedUses}/
              {coupon.maxUses} used · {coupon.reservedUses} pending
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  toggleCoupon({ id: coupon._id, enabled: !coupon.enabled }),
                )
              }
            >
              {coupon.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        ))}
      </section>
      <section className="space-y-3 rounded-2xl border border-border p-5">
        <h2 className="font-semibold">Find and recheck a payment</h2>
        <div className="flex gap-2">
          <input
            aria-label="Payment reference"
            className="min-w-0 flex-1 rounded-lg border bg-background p-2"
            value={reference}
            maxLength={150}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ppro-…"
          />
          <Button
            disabled={busy || !reference}
            onClick={() =>
              void run(() => checkPayment({ reference, admin: true }))
            }
          >
            Verify
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="py-2">Reference</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {overview.orders.map((order) => (
                <tr key={order._id} className="border-t">
                  <td className="break-all py-3">
                    {order.reference}
                    <span className="block text-muted-foreground">
                      {order.reviewReason}
                    </span>
                  </td>
                  <td>{order.status}</td>
                  <td>₦{(order.amount / 100).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
