const HIDDEN_PREFIXES = [
  "/signin",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/welcome",
  "/terms",
  "/privacy",
];

export function shouldShowPushEnablePrompt(args: {
  pathname: string;
  isAuthenticated: boolean;
  authLoading: boolean;
  checked: boolean;
  isSupported: boolean;
  isConfigured: boolean;
  isSubscribed: boolean;
  dismissedThisVisit: boolean;
}): boolean {
  if (args.dismissedThisVisit || args.authLoading || !args.isAuthenticated) return false;
  if (!args.checked || !args.isSupported || !args.isConfigured || args.isSubscribed) return false;
  return !HIDDEN_PREFIXES.some(
    (prefix) => args.pathname === prefix || args.pathname.startsWith(`${prefix}/`),
  );
}
