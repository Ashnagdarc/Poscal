/**
 * Logger utility.
 * Debug logs stay development-only; errors always surface (and can be reported).
 */

import { reportError } from "@/lib/errorReporting";

const isDevelopment = import.meta.env.DEV;

type LogArgs = unknown[];

export const logger = {
  log: (...args: LogArgs): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  error: (...args: LogArgs): void => {
    console.error(...args);
    const firstError = args.find((arg) => arg instanceof Error);
    if (firstError instanceof Error) {
      reportError(firstError, { source: "logger.error", args: args.filter((a) => a !== firstError) });
    } else if (args.length > 0) {
      reportError(new Error(String(args[0])), { source: "logger.error", args: args.slice(1) });
    }
  },

  warn: (...args: LogArgs): void => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  info: (...args: LogArgs): void => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
};
