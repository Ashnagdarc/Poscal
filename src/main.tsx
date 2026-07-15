import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App.tsx";
import { convexReactClient } from "@/lib/convexClient";
import "./index.css";

const SW_REGISTRATION_TIMEOUT_MS = 5000;

const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
};

const requestUpdateCheck = (registration: ServiceWorkerRegistration) => {
  void registration.update().catch((error) => {
    if (import.meta.env.DEV) console.warn("[sw] Update check failed:", error);
  });
};

const watchRegistrationForUpdates = (registration: ServiceWorkerRegistration) => {
  if (registration.waiting && navigator.serviceWorker.controller) {
    activateWaitingWorker(registration);
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        activateWaitingWorker(registration);
      }
    });
  });

  const checkWhenVisible = () => {
    if (document.visibilityState === "visible") {
      requestUpdateCheck(registration);
    }
  };

  window.addEventListener("online", () => requestUpdateCheck(registration));
  window.addEventListener("focus", () => requestUpdateCheck(registration));
  document.addEventListener("visibilitychange", checkWhenVisible);
};

// Register service worker for push notifications if enabled
const ENABLE_SW = import.meta.env.VITE_ENABLE_SW === "true";
if (ENABLE_SW && "serviceWorker" in navigator) {
  const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadServiceWorkerController) {
      window.location.reload();
    }
  });

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
      requestUpdateCheck(registration);
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
