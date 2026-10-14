/**
 * Detect when the installed/tab shell is older than what the CDN is serving.
 * PWA service workers often keep users on a previous JS graph until logout forces a full load.
 */

export const BUILD_MISMATCH_EVENT = "poscal:build-mismatch";
export const STALE_BUILD_KEY = "poscal-stale-build";
/** After a user-triggered update, suppress the banner until the entry hash changes. */
export const UPDATE_DISMISS_ENTRY_KEY = "poscal-update-dismissed-entry";

/** Hash/list of module scripts currently running in this document. */
export function getLoadedBuildSignature(): string {
  if (typeof document === "undefined") return "";

  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'),
  )
    .map((el) => normalizeAssetUrl(el.src))
    .filter(Boolean)
    .sort();

  // Vite injects the entry as type=module; preloads also pin the chunk graph.
  const preloads = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href]'),
  )
    .map((el) => normalizeAssetUrl(el.href))
    .filter(Boolean)
    .sort();

  return [...scripts, ...preloads].join("|");
}

function normalizeAssetUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return "";
    // Keep pathname only so origin/protocol differences don't false-positive.
    return parsed.pathname;
  } catch {
    return "";
  }
}

/** Prefer the Vite entry chunk (`/assets/index-*.js`) for staleness checks. */
export function pickIndexEntry(signature: string): string | null {
  const parts = signature.split("|").filter(Boolean);
  const entry = parts.find((p) => /\/index-[^/]+\.js$/.test(p));
  return entry ?? null;
}

/** Extract asset paths from a freshly fetched index.html. */
export function extractBuildSignatureFromHtml(html: string): string {
  const assets = new Set<string>();

  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.js)["']/g)) {
    if (match[1]) assets.add(match[1]);
  }
  for (const match of html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+\/assets\/[^"']+\.js)["']/g)) {
    if (!match[1]) continue;
    try {
      const path = new URL(match[1]).pathname;
      if (path.startsWith("/assets/")) assets.add(path);
    } catch {
      // ignore
    }
  }

  return [...assets].sort().join("|");
}

export async function fetchRemoteBuildSignature(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    // Cache-bust query only — keep path stable so CDN serves the current index.
    const response = await fetch(`/?__poscal_version=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    // Guard against SW/SPA mistakes serving non-HTML bodies.
    if (!html.includes("<html") && !html.includes("<script")) return null;
    const signature = extractBuildSignatureFromHtml(html);
    return signature || null;
  } catch {
    return null;
  }
}

/**
 * True only when the running Vite entry differs from the one on the CDN.
 * Avoid full asset-graph compares — DOM loads a subset of index modulepreloads,
 * which previously false-flagged "stale" forever and stuck the Update banner.
 */
export async function isClientBuildStale(): Promise<boolean> {
  const remote = await fetchRemoteBuildSignature();
  if (!remote) return false;

  const local = getLoadedBuildSignature();
  if (!local) return false;

  const remoteEntry = pickIndexEntry(remote);
  const localEntry = pickIndexEntry(local);

  if (localEntry && remoteEntry) {
    return localEntry !== remoteEntry;
  }

  // Fallback without entry names: only "stale" if a loaded local asset is gone remotely.
  const remoteParts = new Set(remote.split("|").filter(Boolean));
  const localParts = local.split("|").filter(Boolean);
  if (localParts.length === 0) return false;
  return localParts.some((part) => !remoteParts.has(part));
}

export function notifyBuildMismatch(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STALE_BUILD_KEY, "true");
  } catch {
    // ignore quota
  }
  window.dispatchEvent(new Event(BUILD_MISMATCH_EVENT));
}

export function clearBuildMismatchFlag(): void {
  try {
    localStorage.removeItem(STALE_BUILD_KEY);
  } catch {
    // ignore
  }
}

/** Remember which entry the user already refreshed onto so the banner stays down. */
export function dismissUpdateForCurrentBuild(): void {
  if (typeof window === "undefined") return;
  const entry = pickIndexEntry(getLoadedBuildSignature());
  if (!entry) return;
  try {
    sessionStorage.setItem(UPDATE_DISMISS_ENTRY_KEY, entry);
  } catch {
    // ignore
  }
}

export function isUpdateDismissedForCurrentBuild(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const dismissed = sessionStorage.getItem(UPDATE_DISMISS_ENTRY_KEY);
    if (!dismissed) return false;
    const current = pickIndexEntry(getLoadedBuildSignature());
    return Boolean(current && current === dismissed);
  } catch {
    return false;
  }
}

/**
 * Drop page/runtime caches, activate waiting SW if any, then hard-navigate.
 * Prefer this over logout — same outcome without clearing the session.
 *
 * Important: always ends in a document navigation. Early returns used to leave
 * the "Updating…" button spinning forever when a prior refresh was guarded
 * or when the SW failed the reload FetchEvent.
 */
let forceRefreshInFlight: Promise<void> | null = null;

/** Runtime caches that can keep a tab on an old index/shell after a deploy. */
function isStaleShellCacheName(cacheName: string): boolean {
  return (
    cacheName === "poscal-pages"
    || cacheName === "poscal-static-runtime"
    || cacheName.startsWith("poscal-assets")
    || cacheName.includes("workbox-precache")
  );
}

/**
 * Clear SW-backed shells so NetworkFirst cannot fall back to a previous
 * index.html that still points at old hashed modules.
 */
export async function clearStaleAppShellCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => isStaleShellCacheName(key))
        .map((key) => caches.delete(key).catch(() => false)),
    );
  } catch {
    // ignore — navigation still proceeds
  }
}

function cleanNavigationUrl(): string {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("__poscal_reload");
    url.searchParams.delete("__poscal_version");
    url.searchParams.delete("_");
    url.searchParams.delete("_t");
    return `${url.pathname}${url.search}${url.hash}` || "/";
  } catch {
    return "/";
  }
}

function hardNavigateAway(): void {
  const target = cleanNavigationUrl();
  try {
    // Bust intermediate caches without a sticky ?__poscal_reload param.
    window.location.replace(target);
  } catch {
    // ignore
  }
  // If the replace is swallowed by a broken SW (navigation never unloads),
  // escalate after a short delay.
  window.setTimeout(() => {
    try {
      window.location.reload();
    } catch {
      // ignore
    }
  }, 1_500);
  window.setTimeout(() => {
    try {
      window.location.href = "/";
    } catch {
      // ignore
    }
  }, 3_500);
}

export async function forceAppRefresh(): Promise<void> {
  if (forceRefreshInFlight) {
    return forceRefreshInFlight;
  }

  forceRefreshInFlight = (async () => {
    clearBuildMismatchFlag();
    try {
      localStorage.removeItem("poscal-pwa-pending-update");
    } catch {
      // ignore
    }

    // 1) Ask any waiting worker to become active, and poke update checks so a
    // just-deployed sw.js can move into waiting before we navigate.
    let hasWaiting = false;
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.update();
            } catch {
              // ignore
            }
            if (registration.waiting) {
              hasWaiting = true;
              registration.waiting.postMessage({ type: "SKIP_WAITING" });
            } else if (registration.installing) {
              // Give install a brief window to reach waiting, then SKIP_WAITING.
              await new Promise<void>((resolve) => {
                const worker = registration.installing;
                if (!worker) {
                  resolve();
                  return;
                }
                const done = () => {
                  worker.removeEventListener("statechange", onChange);
                  window.clearTimeout(timeoutId);
                  resolve();
                };
                const onChange = () => {
                  if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") {
                    done();
                  }
                };
                worker.addEventListener("statechange", onChange);
                const timeoutId = window.setTimeout(done, 1_500);
                if (worker.state === "installed" || worker.state === "activated") done();
              });
              if (registration.waiting) {
                hasWaiting = true;
                registration.waiting.postMessage({ type: "SKIP_WAITING" });
              }
            }
          }),
        );
      }
    } catch {
      // ignore
    }

    // 2) Give controllerchange a moment when we just SKIP_WAITED.
    if (hasWaiting && "serviceWorker" in navigator) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          navigator.serviceWorker.removeEventListener("controllerchange", onChange);
          window.clearTimeout(timeoutId);
          resolve();
        };
        const onChange = () => done();
        navigator.serviceWorker.addEventListener("controllerchange", onChange);
        const timeoutId = window.setTimeout(done, 2_000);
        // Already active / no controller yet — don't block the full 2s forever.
        if (!navigator.serviceWorker.controller) {
          window.setTimeout(done, 300);
        }
      });
    }

    // 3) Drop stale shells even when no new worker was waiting. Otherwise
    // NetworkFirst can time out and re-serve the previous index, so Update
    // looks like it "failed" while the old calculator copy stays on screen.
    await clearStaleAppShellCaches();

    // Dismiss only after caches are cleared so a failed stay-on-old-build can
    // still resurface the banner on the next version check.
    dismissUpdateForCurrentBuild();

    // Always leave this document. No silent return paths.
    hardNavigateAway();
  })().finally(() => {
    // Keep the promise sticky until unload; if still alive, allow a retry.
    window.setTimeout(() => {
      forceRefreshInFlight = null;
    }, 4_000);
  });

  return forceRefreshInFlight;
}
