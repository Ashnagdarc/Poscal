/**
 * Checkout / Paystack is off by default until explicitly re-enabled.
 * Set VITE_PAYMENTS_ENABLED=true in the Vite env when ready to sell again.
 */

function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Whether Paystack checkout / upgrade purchase UI is active. */
export function isPaymentsEnabled(): boolean {
  return parseTruthyEnv(import.meta.env.VITE_PAYMENTS_ENABLED);
}
