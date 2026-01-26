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
    try {
      if (navigator.serviceWorker.controller) {
        return; // Already controlling; avoid duplicate registration
      }
      // Add timeout to prevent SW registration from hanging the app
      const registerPromise = Promise.race([
        navigator.serviceWorker.register("/sw.js", { scope: "/" }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("SW register timeout")), 3000)
        )
      ]);
      registerPromise.catch((err) => console.error("[sw] register failed", err));
    } catch (error) {
      console.error("[sw] register error", error);
    }
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
