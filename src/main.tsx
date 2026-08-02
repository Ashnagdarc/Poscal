import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App.tsx";
import { convexReactClient } from "@/lib/convexClient";
import { initErrorReporting } from "@/lib/errorReporting";
import "./index.css";

initErrorReporting();

const SW_REGISTRATION_TIMEOUT_MS = 5000;
const UPDATE_EVENT_NAME = "poscal:pwa-update-available";
const UPDATE_POLL_MS = 5 * 60 * 1000;

const notifyUpdateAvailable = (registration: ServiceWorkerRegistration) => {
  if (!registration.waiting) return;
  window.dispatchEvent(
    new CustomEvent(UPDATE_EVENT_NAME, {
      detail: { registration },
    }),
  );
};

const requestUpdateCheck = (registration: ServiceWorkerRegistration) => {
  void registration.update().catch((error) => {
    if (import.meta.env.DEV) console.warn("[sw] Update check failed:", error);
  });
};

const watchRegistrationForUpdates = (registration: ServiceWorkerRegistration) => {
  // A waiting worker means a new build is ready — prompt the user instead of
  // silently swapping (which can strand PWAs on a half-applied cache).
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

  const checkWhenVisible = () => {
    if (document.visibilityState === "visible") {
      requestUpdateCheck(registration);
    }
  };

  window.addEventListener("online", () => requestUpdateCheck(registration));
  window.addEventListener("focus", () => requestUpdateCheck(registration));
  document.addEventListener("visibilitychange", checkWhenVisible);
  window.setInterval(() => requestUpdateCheck(registration), UPDATE_POLL_MS);
};

// Enable SW in production by default so installed PWAs keep receiving updates.
// Locally require an explicit opt-in to avoid noisy HMR/service-worker fights.
const ENABLE_SW =
  import.meta.env.VITE_ENABLE_SW === "true"
  || (import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW !== "false");

if (ENABLE_SW && "serviceWorker" in navigator) {
  const registerServiceWorker = async () => {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SW registration timeout")), SW_REGISTRATION_TIMEOUT_MS),
      );

      const existingRegistration = await navigator.serviceWorker.getRegistration("/");
      const registrationPromise = existingRegistration
        ? Promise.resolve(existingRegistration)
        : navigator.serviceWorker.register("/sw.js", { scope: "/" });

      const registration = await Promise.race([
        registrationPromise,
        timeoutPromise,
      ]) as ServiceWorkerRegistration;

      // Always re-register against the latest URL so Vercel deploys can replace
      // a stale worker that was installed from an older build.
      if (existingRegistration) {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }

      const latest = (await navigator.serviceWorker.getRegistration("/")) ?? registration;
      watchRegistrationForUpdates(latest);
      requestUpdateCheck(latest);
      if (import.meta.env.DEV) console.log("[sw] Service worker registered:", latest);
    } catch (error) {
      if (import.meta.env.DEV) console.error("[sw] Failed to register service worker:", error);
    }
  };

  if (document.readyState === "complete") {
    void registerServiceWorker();
  } else {
    window.addEventListener("load", () => void registerServiceWorker(), { once: true });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convexReactClient}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
);
