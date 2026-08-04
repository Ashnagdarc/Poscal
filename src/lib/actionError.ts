/**
 * Normalize thrown errors into user-facing copy for the action error dialog.
 */

export type ActionErrorInfo = {
  title: string;
  message: string;
  /** Optional "what to do next" guidance */
  whatToDo?: string;
  /** Short stable code for support screenshots */
  code?: string;
  /** Technical detail (collapsed); safe, stripped of stack noise */
  technical?: string;
};

const stripConvexWrapper = (raw: string): string => {
  const uncaught = raw.match(/Uncaught Error:\s*(.+?)(?:\n|$)/i)?.[1]?.trim();
  if (uncaught) return uncaught;
  // Convex client often prefixes Server Error text.
  const server = raw.match(/Server Error\s*(.+?)(?:\n|$)/i)?.[1]?.trim();
  if (server) return server;
  return raw.trim();
};

const isNoise = (text: string): boolean =>
  /\[CONVEX|VITE_|API_KEY|Request ID|@convex|\.ts:|\.js:|\n\s*at\s/i.test(text);

export function getErrorRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error ?? "");
}

/** Map common failures to title + message + next step. */
export function parseActionError(
  error: unknown,
  options: {
    title?: string;
    fallbackMessage?: string;
    code?: string;
  } = {},
): ActionErrorInfo {
  const title = options.title ?? "Something went wrong";
  const fallbackMessage =
    options.fallbackMessage ?? "That action didn’t complete. Please try again.";
  const raw = getErrorRawMessage(error);
  const candidate = stripConvexWrapper(raw);

  // Auth
  if (/not authenticated|unauthenticated|auth/i.test(candidate) && /sign|session|token|user/i.test(candidate)) {
    return {
      title: "Sign in required",
      message: "Your session expired or you’re signed out.",
      whatToDo: "Sign in again, then retry the action.",
      code: options.code ?? "AUTH",
      technical: candidate.length <= 240 ? candidate : undefined,
    };
  }
  if (/not authenticated/i.test(candidate)) {
    return {
      title: "Sign in required",
      message: "Please sign in again to continue.",
      whatToDo: "Open Sign in, then try again.",
      code: options.code ?? "AUTH",
    };
  }

  // Trade pair (journal) — may already include "Did you mean …"
  if (/unsupported trade pair|unsupported or invalid trade pair|trade pair is required/i.test(candidate)) {
    const suggestion = candidate.match(/Did you mean\s+([^?]+)\?/i)?.[1]?.trim();
    return {
      title: "Symbol not recognized",
      message: suggestion
        ? candidate
        : candidate.length <= 200
          ? candidate
          : "That trading symbol isn’t supported.",
      whatToDo: suggestion
        ? `Change the symbol to ${suggestion} and save again.`
        : "Use a full symbol Poscal supports (e.g. XAUUSD, EURUSD, BTCUSD).",
      code: options.code ?? "PAIR",
      technical: candidate,
    };
  }

  if (/journal not found/i.test(candidate)) {
    return {
      title: "Journal not found",
      message: "The selected journal is missing or no longer available.",
      whatToDo: "Switch to another journal, then try again.",
      code: options.code ?? "JOURNAL",
    };
  }

  if (/p&l|position size|risk percent|notes are too long|cannot be negative|must be between/i.test(candidate)) {
    return {
      title: "Check trade details",
      message: candidate.length <= 200 ? candidate : "One or more trade fields are invalid.",
      whatToDo: "Correct the highlighted values and save again.",
      code: options.code ?? "VALIDATION",
    };
  }

  if (/network|failed to fetch|offline|load failed|timeout/i.test(candidate)) {
    return {
      title: "Connection problem",
      message: "We couldn’t reach the server.",
      whatToDo: "Check your connection and try again.",
      code: options.code ?? "NETWORK",
      technical: !isNoise(candidate) && candidate.length <= 200 ? candidate : undefined,
    };
  }

  if (candidate && !isNoise(candidate) && candidate.length <= 200) {
    return {
      title,
      message: candidate,
      whatToDo: "Try again. If it keeps failing, screenshot this message and contact support.",
      code: options.code,
      technical: raw !== candidate ? raw.slice(0, 240) : undefined,
    };
  }

  return {
    title,
    message: fallbackMessage,
    whatToDo: "Try again. If it keeps failing, screenshot this message and contact support.",
    code: options.code ?? "UNKNOWN",
    technical: candidate && candidate.length <= 240 && !isNoise(candidate) ? candidate : undefined,
  };
}
