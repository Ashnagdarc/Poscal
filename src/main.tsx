import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App.tsx";
import { convexReactClient } from "@/lib/convexClient";
import "./index.css";

const savedTheme = localStorage.getItem("theme");
document.documentElement.classList.toggle(
  "dark",
  savedTheme ? savedTheme === "dark" : true,
);

const root = (
  <StrictMode>
    {convexReactClient ? (
      <ConvexAuthProvider client={convexReactClient}>
        <App />
      </ConvexAuthProvider>
    ) : (
      <App />
    )}
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(root);
