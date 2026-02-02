/**
 * Trading Chart Configuration
 * Centralized config for all chart-related settings
 * No hardcoded values, all configurable
 */

export const CHART_CONFIG = {
  // Theme Colors
  colors: {
    background: '#09090b',
    text: '#9ca3af',
    gridLines: '#1f2937',
    border: '#334155',
    candleUp: '#10b981',
    candleDown: '#ef4444',
    line: '#3b82f6',
    area: {
      top: 'rgba(59, 130, 246, 0.4)',
      bottom: 'rgba(59, 130, 246, 0.0)',
    },
    indicator: '#f59e0b',
    priceLine: '#3b82f6',
  },

  // Chart Display Settings
  display: {
    height: 500,
    lineWidth: {
      default: 2,
      indicator: 1,
      priceLine: 2,
    },
    candleSettings: {
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    },
  },

  // Data Generation Settings
  dataGeneration: {
    volatility: 0.005, // ±0.5% daily movement
    priceDecimals: 5, // Forex uses 5 decimals
    mockApiDelay: 300, // ms - simulate API response time
  },

  // Base prices for forex pairs (mid-market rates)
  basePrices: {
    // Major Pairs
    'EUR/USD': 1.0800,
    'GBP/USD': 1.2650,
    'USD/JPY': 148.50,
    'USD/CHF': 0.8750,
    'AUD/USD': 0.6580,
    'USD/CAD': 1.3450,
    'NZD/USD': 0.6120,
    // Minor Pairs
    'EUR/GBP': 0.8530,
    'EUR/AUD': 1.6410,
    'EUR/CAD': 1.4690,
    'EUR/CHF': 0.9450,
    'EUR/JPY': 160.40,
    'EUR/NZD': 1.7650,
    'GBP/JPY': 188.20,
    'GBP/CHF': 1.1080,
    'GBP/AUD': 1.9230,
    'GBP/CAD': 1.7210,
    'GBP/NZD': 2.0680,
    'AUD/JPY': 97.80,
    'AUD/CAD': 0.9030,
    'AUD/CHF': 0.6080,
    'AUD/NZD': 1.0730,
    'CAD/JPY': 110.80,
    'CAD/CHF': 0.6510,
    'CHF/JPY': 170.20,
    'NZD/JPY': 162.50,
    'NZD/CAD': 0.8420,
    'NZD/CHF': 0.5670,
    // Exotic Pairs
    'USD/SGD': 1.3350,
    'USD/HKD': 7.8150,
    'USD/ZAR': 18.6200,
    'USD/THB': 35.4500,
    'USD/MXN': 17.0500,
    'USD/TRY': 32.8900,
    'EUR/TRY': 35.5100,
    'EUR/NOK': 11.4200,
    'EUR/SEK': 11.2650,
    'EUR/PLN': 4.3580,
    'GBP/SGD': 1.6850,
    'GBP/ZAR': 23.5100,
  } as Record<string, number>,

  // Range to days mapping
  rangeMapping: {
    '1D': 1,
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    'ALL': 730, // 2 years
  } as Record<string, number>,

  // Moving Average settings
  indicators: {
    ma20: {
      period: 20,
      color: '#f59e0b',
      lineWidth: 1,
    },
  },

  // API Configuration (use backend endpoints, not external APIs)
  api: {
    // All API calls should go through backend at VITE_API_URL
    // Backend endpoints handle rate limits, caching, and security
    historicalDataEndpoint: '/api/chart/historical',
    realtimeDataEndpoint: '/forex', // WebSocket namespace
  },
} as const;

// Helper function to get base price for a pair
export const getBasePrice = (pair: string): number => {
  return CHART_CONFIG.basePrices[pair] || 1.0;
};

// Helper function to get days from range
export const getDaysFromRange = (range: keyof typeof CHART_CONFIG.rangeMapping): number => {
  return CHART_CONFIG.rangeMapping[range] || CHART_CONFIG.rangeMapping['1M'];
};

export type ChartTheme = typeof CHART_CONFIG.colors;
export type ChartDisplay = typeof CHART_CONFIG.display;
