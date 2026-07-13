/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// Limits
export const LIMITS = {
  MAX_PAIR_LENGTH: 20,
} as const;

// Intervals (in milliseconds)
export const INTERVALS = {
  LIVE_PRICE_REFRESH: 30000, // 30 seconds
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
  HAPTICS: 'hapticsEnabled',
  THEME: 'theme',
  POSITION_HISTORY: 'positionSizeHistory',
  JOURNAL_ENTRIES: 'journalEntries',
  SIGNALS: 'signals',
  PENDING_SIGNAL: 'pendingSignal',
  PUSH_ENABLED: 'pushEnabled',
  IN_APP_TOASTS: 'inAppToasts',
  SHOW_WELCOME: 'showWelcomeScreens',
} as const;

// Animation Durations (in milliseconds)
export const ANIMATION = {
  TOAST_DURATION: 3000,
  MODAL_TRANSITION: 200,
  HAPTIC_DURATION: 50,
} as const;
