import { ConvexHttpClient } from "convex/browser";
import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not configured.");
}

export const convexReactClient = new ConvexReactClient(convexUrl);
export const convexClient = new ConvexHttpClient(convexUrl);
export const createAuthenticatedConvexClient = (token?: string | null) => {
  const client = new ConvexHttpClient(convexUrl);
  if (token) {
    client.setAuth(token);
  }
  return client;
};

export const isConvexEnabled = () => convexClient !== null;
