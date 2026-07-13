import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("CONVEX_URL is not configured");
}

export const convexServerClient = new ConvexHttpClient(convexUrl);
export const createConvexServerClient = (token?: string) => {
  const client = new ConvexHttpClient(convexUrl);
  if (token) {
    client.setAuth(token);
  }
  return client;
};
export { api };
