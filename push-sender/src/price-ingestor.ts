import { PriceIngestor } from './workers/priceIngestor';
import { logger } from './lib/logger';

const priceIngestor = new PriceIngestor();
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  await priceIngestor.start();
  logger.info('Price ingestor is running');
}

function shutdown(): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('Stopping price ingestor');
  priceIngestor.stop();
  process.exit(0);
}

bootstrap().catch((error) => {
  logger.error('Price ingestor failed to start', { error: (error as Error).message });
  process.exit(1);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
