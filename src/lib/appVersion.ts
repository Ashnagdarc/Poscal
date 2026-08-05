/**
 * Detect when the installed/tab shell is older than what the CDN is serving.
 * PWA service workers often keep users on a previous JS graph until logout forces a full load.
 */

export const BUILD_MISMATCH_EVENT = "poscal:build-mismatch";
export const STALE_BUILD_KEY = "poscal-stale-build";

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
    const signature = extractBuildSignatureFromHtml(html);
    return signature || null;
  } catch {
    return null;
  }
}

export async function isClientBuildStale(): Promise<boolean> {
  const remote = await fetchRemoteBuildSignature();
  if (!remote) return false;

  const local = getLoadedBuildSignature();
  if (!local) return false;

  // Compare entry-ish assets: local may only include the entry module + preloads;
  // remote index lists all modulepreloads. If every local asset is present remotely
  // and remote has a different entry graph, still count as stale when signatures differ.
  if (local === remote) return false;

  // Require the main entry chunk in local to appear in remote to avoid partial HTML parses.
  const localParts = local.split("|").filter(Boolean);
  const remoteParts = new Set(remote.split("|").filter(Boolean));
  const shared = localParts.filter((part) => remoteParts.has(part));
  // Stale if the page lost more than half its current asset graph against the new index.
  if (shared.length === localParts.length && localParts.length > 0) {
    // Local is a subset of remote — usual when remote has more preloads. Not stale yet
    // unless remote introduced a NEW index entry that local doesn't know.
    // Check index entry scripts (non-chunk names often start with index-).
    const remoteEntries = remote.split("|").filter((p) => /\/index-[^/]+\.js$/.test(p));
    const localEntries = localParts.filter((p) => /\/index-[^/]+\.js$/.test(p));
    if (remoteEntries.length > 0 && localEntries.length > 0) {
      return remoteEntries.some((entry) => !localEntries.includes(entry));
    }
    return false;
  }

  return true;
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

/**
 * Drop page/runtime caches, activate waiting SW if any, then hard-reload.
 * Prefer this over logout — same outcome without clearing the session.
 */
export async function forceAppRefresh(): Promise<void> {
  const GUARD_KEY = "poscal-last-force-refresh";
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) || "0");
    if (Date.now() - last < 15_000) {
      // Avoid reload loops when SW activate + controllerchange both fire.
      return;
    }
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — continue
  }

  clearBuildMismatchFlag();
  try {
    localStorage.removeItem("poscal-pwa-pending-update");
  } catch {
    // ignore
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          try {
            await registration.update();
          } catch {
            // ignore
          }
        }),
      );
    }
  } catch {
    // ignore
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.includes("poscal")
              || key.includes("workbox")
              || key.includes("precache")
              || key.startsWith("pages-")
              || key === "poscal-pages"
              || key === "poscal-static-runtime",
          )
          .map((key) => caches.delete(key)),
      );
    }
  } catch {
    // ignore
  }

  // Cache-bust navigation so NetworkFirst / CDN cannot reuse the old shell tab state.
  const url = new URL(window.location.href);
  // Drop prior bounce markers, then add a fresh one once.
  url.searchParams.delete("__poscal_reload");
  url.searchParams.set("__poscal_reload", String(Date.now()));
  window.location.replace(url.toString());
}
