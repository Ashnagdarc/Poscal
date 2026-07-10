import { ConvexHttpClient } from "convex/browser";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

export const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

export const isConvexEnabled = () => convexClient !== null;
