/**
 * Normalize stored media paths for display.
 * Nest/legacy uploads were saved as `/uploads/...` relative paths.
 */
export const resolveMediaUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
    if (/^https?:\/\//i.test(apiBase)) {
      try {
        return `${new URL(apiBase).origin}${trimmed}`;
      } catch {
        return trimmed;
      }
    }

    const siteUrl = String(import.meta.env.VITE_SITE_URL || "").replace(/\/$/, "");
    if (/^https?:\/\//i.test(siteUrl)) {
      try {
        return `${new URL(siteUrl).origin}${trimmed}`;
      } catch {
        return trimmed;
      }
    }
  }

  return trimmed;
};
