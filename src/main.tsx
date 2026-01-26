import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/lib/supabase-shim";
import App from "./App.tsx";
import "./index.css";

// Temporary: disable automatic service worker registration to stop refresh loops.
// Re-enable by setting VITE_ENABLE_SW to "true" and redeploy.
const ENABLE_SW = import.meta.env.VITE_ENABLE_SW === "true";
if (ENABLE_SW && import.meta.env.PROD && "serviceWorker" in navigator) {
  const registerOnce = () => {
    if (navigator.serviceWorker.controller) {
      return; // Already controlling; avoid duplicate registration
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.error("[sw] register failed", err));
  };

  if (document.readyState === "complete") {
    registerOnce();
  } else {
    window.addEventListener("load", registerOnce, { once: true });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
