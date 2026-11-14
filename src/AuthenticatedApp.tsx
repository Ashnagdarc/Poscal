import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convexReactClient } from "@/lib/convexClient";
import App from "./App";

export default function AuthenticatedApp() {
  return <ConvexAuthProvider client={convexReactClient}><App /></ConvexAuthProvider>;
}
