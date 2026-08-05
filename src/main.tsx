import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App.tsx";
import { convexReactClient } from "@/lib/convexClient";
import { initErrorReporting } from "@/lib/errorReporting";
import { isClientBuildStale, notifyBuildMismatch } from "@/lib/appVersion";
import { notifyPwaUpdateAvailable } from "@/lib/pwa-update";
import "./index.css";

initErrorReporting();

// Recover tabs stranded on failed update cache-bust URLs (ERR_FAILED after
// concurrent SW navigate + location.replace with ?__poscal_reload=...).
try {
  const stranded = new URL(window.location.href);
  if (stranded.searchParams.has("__poscal_reload")) {
    stranded.searchParams.delete("__poscal_reload");
    stranded.searchParams.delete("__poscal_version");
    const clean = `${stranded.pathname}${stranded.search}${stranded.hash}` || "/";
    window.location.replace(clean);
  }
} catch {
  // ignore
}

const SW_REGISTRATION_TIMEOUT_MS = 5000;
/** Check CDN + SW for a new release more often so sessions don't stick to a stale shell. */
const UPDATE_POLL_MS = 60 * 1000;

const requestUpdateCheck = (registration: ServiceWorkerRegistration) => {
  void registration.update().catch((error) => {
    if (import.meta.env.DEV) console.warn("[sw] Update check failed:", error);
  });
  void isClientBuildStale()
    .then((stale) => {
      if (stale) notifyBuildMismatch();
    })
    .catch(() => undefined);
};

const watchRegistrationForUpdates = (registration: ServiceWorkerRegistration) => {
  // A waiting or installing worker means a new build is ready — prompt the user
  // instead of silently swapping without a reload (strands PWAs mid-session).
  if ((registration.waiting || registration.installing) && navigator.serviceWorker.controller) {
    notifyPwaUpdateAvailable(registration);
  }

  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing;
    if (!installingWorker) return;

    installingWorker.addEventListener("statechange", () => {
      if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
        notifyPwaUpdateAvailable(registration);
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
} else if (import.meta.env.PROD) {
  // No SW: still detect deploys so tabs aren't stuck until the user re-auths.
  const check = () => {
    void isClientBuildStale()
      .then((stale) => {
        if (stale) notifyBuildMismatch();
      })
      .catch(() => undefined);
  };
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.setInterval(check, UPDATE_POLL_MS);
  window.setTimeout(check, 4_000);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={convexReactClient}>
      <App />
    </ConvexAuthProvider>
  </StrictMode>,
);
