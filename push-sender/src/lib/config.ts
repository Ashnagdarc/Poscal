import 'dotenv/config';

export interface BaseConfig {
  nestApiUrl: string;
  serviceToken: string;
}

export type PriceProviderMode = 'finnhub';
export type OandaEnvironment = 'practice' | 'live';

export interface PriceIngestorConfig extends BaseConfig {
  priceProviderMode: PriceProviderMode;
  oandaEnvironment: OandaEnvironment;
  finnhubApiKey?: string;
  oandaApiKey?: string;
  oandaAccountId?: string;
  oandaApiUrl: string;
  oandaInstrumentChunkSize: number;
  liveForexSymbolLimit: number;
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

function requireNonPlaceholderEnv(key: string): string {
  const value = requireEnv(key).trim();
  const normalized = value.toLowerCase();

  const placeholderValues = new Set([
    'your_finnhub_api_key_here',
    'your-finnhub-api-key-here',
    'finnhub_api_key_here',
    'changeme',
    'replace_me',
    'replace-me',
    'placeholder',
  ]);

  if (
    placeholderValues.has(normalized) ||
    normalized.includes('your_') ||
    normalized.includes('your-') ||
    normalized.includes('placeholder') ||
    normalized.includes('finnhub_api_key_here') ||
    normalized.includes('example') ||
    normalized.startsWith('<') ||
    normalized.endsWith('>')
  ) {
    throw new Error(`Environment variable ${key} appears to be a placeholder. Set a real API key.`);
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

function getPriceProviderModeEnv(): PriceProviderMode {
  const raw = (process.env.PRICE_PROVIDER_MODE || process.env.PRICE_PROVIDER || 'finnhub').toLowerCase();
  if (raw === 'finnhub') {
    return 'finnhub';
  }

  // OANDA and hybrid live modes are deprecated in favor of the shared Finnhub stream path.
  return 'finnhub';
}

function getOandaEnvironmentEnv(): OandaEnvironment {
  const raw = (process.env.OANDA_ENV || 'practice').toLowerCase();
  if (raw === 'practice' || raw === 'live') {
    return raw;
  }

  throw new Error(`Unsupported OANDA_ENV: ${raw}`);
}

export function loadBaseConfig(): BaseConfig {
  return {
    nestApiUrl: process.env.NESTJS_API_URL || 'http://localhost:3001',
    serviceToken: requireEnv('NESTJS_SERVICE_TOKEN'),
  };
}

export function loadPriceIngestorConfig(): PriceIngestorConfig {
  const base = loadBaseConfig();
  const priceProviderMode = getPriceProviderModeEnv();
  const oandaEnvironment = getOandaEnvironmentEnv();
  const defaultOandaApiUrl = oandaEnvironment === 'live'
    ? 'https://api-fxtrade.oanda.com'
    : 'https://api-fxpractice.oanda.com';

  return {
    ...base,
    priceProviderMode,
    oandaEnvironment,
    finnhubApiKey: requireNonPlaceholderEnv('FINNHUB_API_KEY'),
    oandaApiKey: process.env.OANDA_API_KEY,
    oandaAccountId: process.env.OANDA_ACCOUNT_ID,
    oandaApiUrl: process.env.OANDA_API_URL || defaultOandaApiUrl,
    oandaInstrumentChunkSize: getNumericEnv('OANDA_INSTRUMENT_CHUNK_SIZE', 25),
    liveForexSymbolLimit: getNumericEnv('LIVE_FOREX_SYMBOL_LIMIT', 50),
    batchIntervalMs: getNumericEnv('BATCH_INTERVAL', 10000),
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
