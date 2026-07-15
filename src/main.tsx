import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App.tsx";
import { convexReactClient } from "@/lib/convexClient";
import "./index.css";

const SW_REGISTRATION_TIMEOUT_MS = 5000;
const UPDATE_EVENT_NAME = "poscal:pwa-update-available";

const notifyUpdateAvailable = (registration: ServiceWorkerRegistration) => {
  window.dispatchEvent(
    new CustomEvent(UPDATE_EVENT_NAME, {
      detail: { registration },
    }),
  );
};

const watchRegistrationForUpdates = (registration: ServiceWorkerRegistration) => {
  if (registration.waiting && navigator.serviceWorker.controller) {
    notifyUpdateAvailable(registration);
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        notifyUpdateAvailable(registration);
      }
    });
  });
};

// Register service worker for push notifications if enabled
const ENABLE_SW = import.meta.env.VITE_ENABLE_SW === "true";
if (ENABLE_SW && "serviceWorker" in navigator) {
  const registerServiceWorker = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("SW registration timeout")), SW_REGISTRATION_TIMEOUT_MS)
      );

      const existingRegistration = await navigator.serviceWorker.getRegistration("/");
      const registrationPromise = existingRegistration
        ? Promise.resolve(existingRegistration)
        : navigator.serviceWorker.register("/sw.js", { scope: "/" });

      const registration = await Promise.race([registrationPromise, timeoutPromise]) as ServiceWorkerRegistration;
      watchRegistrationForUpdates(registration);
      void registration.update();
      if (import.meta.env.DEV) console.log("[sw] Service worker registered successfully:", registration);
    } catch (error) {
      if (import.meta.env.DEV) console.error("[sw] Failed to register service worker:", error);
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
    <ConvexAuthProvider client={convexReactClient}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>
);
