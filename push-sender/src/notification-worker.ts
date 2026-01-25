import { NotificationWorker } from './workers/notificationWorker';
import { logger } from './lib/logger';

const worker = new NotificationWorker();
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  await worker.start();
  logger.info('Notification worker is running');
}

function shutdown(): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('Stopping notification worker');
  worker.stop();
  process.exit(0);
}

bootstrap().catch((error) => {
  logger.error('Notification worker failed to start', { error: (error as Error).message });
  process.exit(1);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
