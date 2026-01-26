import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/lib/supabase-shim";
import App from "./App.tsx";
import "./index.css";

// Manually register the service worker in production to avoid repeated fetches of the auto-injected registerSW.js helper
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("[sw] register failed", err));
    },
    { once: true }
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
