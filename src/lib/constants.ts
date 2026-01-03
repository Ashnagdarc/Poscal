/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// Pagination
export const PAGINATION = {
  SIGNALS_PER_PAGE: 5,
  TRADES_PER_PAGE: 10,
  USERS_PER_PAGE: 20,
  HISTORY_ITEMS_PER_PAGE: 20,
} as const;

// Limits
export const LIMITS = {
  MAX_TRADES_PER_IMPORT: 1000,
  MAX_SCREENSHOTS_PER_TRADE: 5,
  MAX_FILE_SIZE_MB: 5,
  MAX_NOTES_LENGTH: 1000,
  MAX_PAIR_LENGTH: 20,
} as const;

// Intervals (in milliseconds)
export const INTERVALS = {
  LIVE_PRICE_REFRESH: 30000, // 30 seconds
  SIGNAL_CHECK: 60000, // 1 minute
  NOTIFICATION_COOLDOWN: 5000, // 5 seconds
} as const;

// Forex
export const FOREX = {
  STANDARD_LOT_SIZE: 100000,
  MINI_LOT_SIZE: 10000,
  MICRO_LOT_SIZE: 1000,
} as const;

// Risk Management
export const RISK = {
  MIN_RISK_PERCENT: 0.1,
  MAX_RISK_PERCENT: 10,
  DEFAULT_RISK_PERCENT: 1,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  ACCOUNT_CURRENCY: 'accountCurrency',
  DEFAULT_RISK: 'defaultRisk',
  NOTIFICATIONS: 'notifications',
  HAPTICS: 'hapticsEnabled',
  THEME: 'theme',
  ONBOARDING: 'hasSeenOnboarding',
  POSITION_HISTORY: 'positionSizeHistory',
  PUSH_SUBSCRIPTION: 'pushSubscription',
} as const;

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy HH:mm',
  ISO: 'yyyy-MM-dd',
  TIME_ONLY: 'HH:mm',
} as const;

// Currency Pairs
export const COMMON_PAIRS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'AUD/USD',
  'USD/CAD',
  'NZD/USD',
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY',
  'XAU/USD',
  'BTC/USD',
] as const;

// Platforms
export const PLATFORMS = [
  'MetaTrader 4',
  'MetaTrader 5',
  'cTrader',
  'TradingView',
  'NinjaTrader',
  'Other',
] as const;

// Animation Durations (in milliseconds)
export const ANIMATION = {
  TOAST_DURATION: 3000,
  MODAL_TRANSITION: 200,
  HAPTIC_DURATION: 50,
} as const;
