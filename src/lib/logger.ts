/**
 * Development logger utility
 * Logs only in development mode to keep production clean
 */

const isDevelopment = import.meta.env.DEV;

type LogArgs = unknown[];

export const logger = {
  log: (...args: LogArgs): void => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: LogArgs): void => {
    if (isDevelopment) {
      console.error(...args);
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
