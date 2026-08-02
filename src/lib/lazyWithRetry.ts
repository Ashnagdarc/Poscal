import { ComponentType, lazy, LazyExoticComponent } from "react";

/**
 * Vite HMR can invalidate a chunk while React is still resolving a lazy() import,
 * which surfaces as "Failed to fetch dynamically imported module".
 * Retry once with a cache-busting query, then hard-reload as last resort.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await factory();
    } catch (firstError) {
      const message = firstError instanceof Error ? firstError.message : String(firstError);
      const isChunkLoadError =
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed") ||
        message.includes("error loading dynamically imported module");

      if (!isChunkLoadError) {
        throw firstError;
      }

      // One soft retry after a brief pause (lets Vite finish invalidation).
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      try {
        return await factory();
      } catch (secondError) {
        // Avoid reload loops across navigations.
        const key = "poscal:chunk-reload";
        const last = Number(sessionStorage.getItem(key) ?? "0");
        const now = Date.now();
        if (now - last > 10_000) {
          sessionStorage.setItem(key, String(now));
          window.location.reload();
          // Keep suspense pending until reload completes.
          return new Promise(() => undefined);
        }
        throw secondError;
      }
    }
  });
}
