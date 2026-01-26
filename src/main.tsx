import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/lib/supabase-shim";
import App from "./App.tsx";
import "./index.css";

// Manually register the service worker in production to avoid repeated fetches of the auto-injected registerSW.js helper.
// Skip registration if a controller already exists to prevent duplicate installs/restarts.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
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
