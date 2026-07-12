import { ConvexHttpClient } from "convex/browser";
import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
export const convexReactClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
export const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;
export const createAuthenticatedConvexClient = (token?: string | null) => {
  if (!convexUrl) {
    return null;
  }

  const client = new ConvexHttpClient(convexUrl);
  if (token) {
    client.setAuth(token);
  }
  return client;
};

export const isConvexEnabled = () => convexClient !== null;
