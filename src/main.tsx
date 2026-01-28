import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications if enabled
const ENABLE_SW = import.meta.env.VITE_ENABLE_SW === "true";
if (ENABLE_SW && "serviceWorker" in navigator) {
  const registerServiceWorker = async () => {
    try {
      // Check if already registered
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        // Service worker already registered (normal on app reload)
        return;
      }

      // Register with a simple timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SW registration timeout")), 5000)
      );

      const registrationPromise = navigator.serviceWorker.register("/sw.js", { scope: "/" });
      
      const registration = await Promise.race([registrationPromise, timeoutPromise]);
      console.log("[sw] Service worker registered successfully:", registration);
    } catch (error) {
      console.error("[sw] Failed to register service worker:", error);
    }
  };

  // Register after DOM is ready
  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker, { once: true });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
