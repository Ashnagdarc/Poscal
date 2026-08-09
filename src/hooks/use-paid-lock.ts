import { useEffect, useState } from "react";
import { featureFlagApi } from "@/lib/api";
import { isPaymentsEnabled } from "@/lib/paymentsConfig";

/**
 * Admin-controlled paid lock. Defaults to OFF so premium routes stay open
 * until an admin explicitly enables the wall.
 * When Paystack checkout is deactivated, the wall stays off so users are not trapped.
 */
export const usePaidLock = () => {
  const [paidLockEnabled, setPaidLockEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const paymentsEnabled = isPaymentsEnabled();

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    if (!paymentsEnabled) {
      setPaidLockEnabled(false);
      setIsLoading(false);
      return () => {
        mounted = false;
      };
    }

    setIsLoading(true);

    (async () => {
      try {
        const enabled = await featureFlagApi.getPaidLock();
        if (mounted) setPaidLockEnabled(!!enabled);
      } catch (err) {
        console.warn("Could not fetch paid lock flag; leaving payment wall off", err);
        if (mounted) setPaidLockEnabled(false);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    // If the flag API hangs, keep the wall off rather than locking free users out.
    timeoutId = setTimeout(() => {
      if (!mounted) return;
      setIsLoading(false);
      setPaidLockEnabled((current) => current);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [paymentsEnabled]);

  return { paidLockEnabled: paymentsEnabled ? paidLockEnabled : false, isLoading };
};
