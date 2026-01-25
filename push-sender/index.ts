import { logger } from './src/lib/logger';

logger.warn('This entry point is deprecated. Run src/notification-worker.ts or src/price-ingestor.ts instead.');

import('./src/notification-worker').catch((error) => {
  logger.error('Failed to start notification worker via legacy entry point', {
    error: (error as Error).message,
  });
  process.exit(1);
});
