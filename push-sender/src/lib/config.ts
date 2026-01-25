import 'dotenv/config';

export interface BaseConfig {
  nestApiUrl: string;
  serviceToken: string;
}

export interface PriceIngestorConfig extends BaseConfig {
  finnhubApiKey: string;
  batchIntervalMs: number;
}

export interface NotificationWorkerConfig extends BaseConfig {
  pollIntervalMs: number;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getNumericEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }

  return parsed;
}

export function loadBaseConfig(): BaseConfig {
  return {
    nestApiUrl: process.env.NESTJS_API_URL || 'http://localhost:3001',
    serviceToken: requireEnv('NESTJS_SERVICE_TOKEN'),
  };
}

export function loadPriceIngestorConfig(): PriceIngestorConfig {
  const base = loadBaseConfig();

  return {
    ...base,
    finnhubApiKey: requireEnv('FINNHUB_API_KEY'),
    batchIntervalMs: getNumericEnv('BATCH_INTERVAL', 1000),
  };
}

export function loadNotificationWorkerConfig(): NotificationWorkerConfig {
  const base = loadBaseConfig();

  return {
    ...base,
    pollIntervalMs: getNumericEnv('POLL_INTERVAL', 30000),
    vapidPublicKey: requireEnv('VAPID_PUBLIC_KEY'),
    vapidPrivateKey: requireEnv('VAPID_PRIVATE_KEY'),
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:info@poscalfx.com',
  };
}
