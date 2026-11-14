// Build-time switch: the outage shell must not depend on the account server.
export const ACCOUNT_MAINTENANCE = import.meta.env.VITE_ACCOUNT_MAINTENANCE !== "false";

export const MAINTENANCE_MESSAGE =
  "We're experiencing server issues and are working to restore access. Login, sign-up and journaling are temporarily unavailable. You can still use the position size calculator without signing in.";
