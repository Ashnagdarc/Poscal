type ErrorContext = Record<string, unknown>;

type SentryLike = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: { extra?: ErrorContext }) => void;
};

let sentryInitialized = false;
let sentryModule: SentryLike | null = null;

async function ensureSentry(): Promise<SentryLike | null> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return null;
  if (sentryModule) return sentryModule;

  try {
    const Sentry = (await import("@sentry/react")) as unknown as SentryLike;
    if (!sentryInitialized) {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.1,
      });
      sentryInitialized = true;
    }
    sentryModule = Sentry;
    return Sentry;
  } catch (error) {
    console.error("[errorReporting] Failed to initialize Sentry", error);
    return null;
  }
}

/**
 * Report an error for production observability.
 * Always logs to console; sends to Sentry when VITE_SENTRY_DSN is set.
 */
export function reportError(error: unknown, context?: ErrorContext): void {
  const normalized =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");

  console.error("[errorReporting]", normalized, context ?? {});

  void ensureSentry().then((Sentry) => {
    Sentry?.captureException(normalized, context ? { extra: context } : undefined);
  });
}

export function initErrorReporting(): void {
  void ensureSentry();

  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason ?? new Error("Unhandled promise rejection"), {
      source: "unhandledrejection",
    });
  });
}
