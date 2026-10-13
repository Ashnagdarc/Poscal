import { ConvexHttpClient } from "convex/browser";
import { ConvexReactClient } from "convex/react";

import { getConvexAuthTokenMirror } from "@/lib/authTokenStore";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!convexUrl) {
  throw new Error("App configuration is incomplete. Please contact support.");
}

// Self-hosted VPS cutover uses a custom HTTPS origin (not *.convex.cloud).
const clientOpts = { skipConvexDeploymentUrlCheck: true as const };
export const convexReactClient = new ConvexReactClient(convexUrl, clientOpts);
export const convexClient = new ConvexHttpClient(convexUrl, clientOpts);

/** Keep the shared HTTP client in sync with Convex Auth (journal / progress / trades helpers). */
export const syncSharedConvexHttpAuth = (token?: string | null) => {
  if (token) {
    convexClient.setAuth(token);
  } else {
    convexClient.clearAuth();
  }
};

export const createAuthenticatedConvexClient = (token?: string | null) => {
  const client = new ConvexHttpClient(convexUrl, clientOpts);
  if (token) {
    client.setAuth(token);
  }
  return client;
};

/** Prefer an explicitly authenticated client; fall back to the shared (possibly synced) client. */
export const getAuthenticatedConvexHttpClient = () => {
  const token = getConvexAuthTokenMirror();
  return token ? createAuthenticatedConvexClient(token) : convexClient;
};

export const isConvexEnabled = () => convexClient !== null;
