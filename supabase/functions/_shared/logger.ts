/**
 * Edge Function logger utility
 * Logs conditionally based on environment
 */

export const isDev = Deno.env.get('ENVIRONMENT') === 'development' || 
                     Deno.env.get('DENO_DEPLOYMENT_ID') === undefined;

type LogArgs = unknown[];

export const edgeLogger = {
  log: (...args: LogArgs): void => {
    if (isDev) {
      console.log('[DEV]', ...args);
    }
  },
  
  error: (...args: LogArgs): void => {
    // Always log errors, even in production
    console.error('[ERROR]', ...args);
  },
  
  warn: (...args: LogArgs): void => {
    if (isDev) {
      console.warn('[WARN]', ...args);
    }
  },
  
  info: (...args: LogArgs): void => {
    if (isDev) {
      console.info('[INFO]', ...args);
    }
  },
};
