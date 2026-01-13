/**
 * Forex calculation utilities for accurate position sizing and P&L
 * Supports ALL currency pairs dynamically by detecting pair type
 */

// Constants
export const STANDARD_LOT_SIZE = 100000; // 1 standard lot = 100,000 units
export const MINI_LOT_SIZE = 10000;      // 1 mini lot = 10,000 units
export const MICRO_LOT_SIZE = 1000;      // 1 micro lot = 1,000 units

/**
 * Typical broker spreads in pips for major currency pairs
 * These are conservative estimates for retail brokers
 */
export const TYPICAL_SPREADS: Record<string, number> = {
  // Major pairs (lowest spreads)
  'EUR/USD': 1.0,
  'GBP/USD': 1.5,
  'USD/JPY': 1.0,
  'USD/CHF': 1.5,
  'AUD/USD': 1.5,
  'USD/CAD': 1.5,
  'NZD/USD': 2.0,
  
  // Cross pairs (higher spreads)
  'EUR/GBP': 2.0,
  'EUR/JPY': 2.0,
  'GBP/JPY': 3.0,
  'EUR/AUD': 3.0,
  'EUR/CHF': 2.0,
  'GBP/CHF': 3.0,
  'AUD/JPY': 2.5,
  'NZD/JPY': 3.0,
  'GBP/AUD': 3.5,
  'GBP/NZD': 4.0,
  'EUR/NZD': 4.0,
  'AUD/NZD': 3.0,
  'AUD/CAD': 2.5,
  'CAD/JPY': 2.5,
  'CHF/JPY': 3.0,
  
  // Exotic pairs (highest spreads)
  'USD/ZAR': 15.0,
  'USD/MXN': 10.0,
  'USD/TRY': 20.0,
  'EUR/TRY': 25.0,
  
  // Commodities
  'XAU/USD': 3.0, // Gold
  'XAG/USD': 3.5, // Silver
  
  // Indices (point spreads)
  'US30': 2.0, // Dow Jones
  'US100': 1.0, // Nasdaq
  'SPX': 0.5, // S&P 500
  'GER30': 2.0, // DAX
  'UK100': 1.5, // FTSE 100
  
  // Crypto (very high spreads)
  'BTC/USD': 50.0,
  'ETH/USD': 5.0,
  'LTC/USD': 10.0,
  'XRP/USD': 15.0,
  'ADA/USD': 20.0,
};

interface PairConfig {
  pipMultiplier: number; // How many to multiply price difference to get pips
  pipValueBase: number; // Base pip value for 1 standard lot
  quoteCurrency: string; // The second currency in the pair
  baseCurrency: string; // The first currency in the pair
  isMetalOrCrypto?: boolean;
  typicalSpread: number; // Typical spread in pips
}

/**
 * Dynamically determine configuration for ANY currency pair
 * Works for all XXX/YYY format pairs without hardcoding
 */
function getPairConfig(pair: string): PairConfig {
  const [base, quote] = pair.split('/');
  
  // Get typical spread for this pair (default 2.0 pips if unknown)
  const typicalSpread = TYPICAL_SPREADS[pair] || 2.0;
  
  // Handle indices (US30, US100, SPX, NAS100, etc.)
  if (base === 'US30' || base === 'US100' || base === 'SPX' || base === 'NAS100' || base === 'GER30' || base === 'UK100') {
    return {
      baseCurrency: base,
      quoteCurrency: quote || 'USD', // Indices typically quoted in USD
      pipMultiplier: 1, // 1 point = 1 pip for indices
      pipValueBase: 1,
      isMetalOrCrypto: true, // Use special handling flag
      typicalSpread
    };
  }
  
  // Handle metals (Gold, Silver)
  if (base === 'XAU' || base === 'XAG') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: base === 'XAU' ? 10 : 100,
      pipValueBase: base === 'XAU' ? 10 : 50,
      isMetalOrCrypto: true,
      typicalSpread
    };
  }
  
  // Handle crypto
  if (base === 'BTC' || base === 'ETH' || base === 'LTC' || base === 'XRP' || base === 'ADA') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: base === 'BTC' ? 1 : 10, // BTC uses 1 point, others use 0.1
      pipValueBase: 1,
      isMetalOrCrypto: true,
      typicalSpread
    };
  }
  
  // Handle JPY pairs (2 decimal places)
  if (quote === 'JPY') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: 100,
      pipValueBase: 9.09, // Approximate, should use live rate
      typicalSpread
    };
  }
  
  // Default: Standard 4 decimal place pairs
  return {
    baseCurrency: base,
    quoteCurrency: quote,
    pipMultiplier: 10000,
    pipValueBase: 10,
    typicalSpread
  };
}

/**
 * Calculate pips between two prices for a given pair
 * Works for ALL currency pairs dynamically
 */
export function calculatePips(price1: number, price2: number, pair: string): number {
  const config = getPairConfig(pair);
  return Math.abs(Math.round((price1 - price2) * config.pipMultiplier * 100) / 100);
}

/**
 * Convert spread in pips to price units for a given pair
 * @param pair - Currency pair (e.g., 'EUR/USD')
 * @param spreadPips - Spread in pips
 * @returns Spread in price units
 */
export function spreadPipsToPrice(pair: string, spreadPips: number): number {
  const config = getPairConfig(pair);
  return spreadPips / config.pipMultiplier;
}

/**
 * Calculate ask price from mid-market price
 * Ask price = mid price + (spread / 2)
 * @param midPrice - Mid-market price
 * @param pair - Currency pair
 * @param spreadPips - Optional custom spread in pips (uses typical spread if not provided)
 * @returns Ask price
 */
export function getAskPrice(midPrice: number, pair: string, spreadPips?: number): number {
  const spread = spreadPips ?? getPairConfig(pair).typicalSpread;
  const halfSpreadInPrice = spreadPipsToPrice(pair, spread) / 2;
  return midPrice + halfSpreadInPrice;
}

/**
 * Calculate bid price from mid-market price
 * Bid price = mid price - (spread / 2)
 * @param midPrice - Mid-market price
 * @param pair - Currency pair
 * @param spreadPips - Optional custom spread in pips (uses typical spread if not provided)
 * @returns Bid price
 */
export function getBidPrice(midPrice: number, pair: string, spreadPips?: number): number {
  const spread = spreadPips ?? getPairConfig(pair).typicalSpread;
  const halfSpreadInPrice = spreadPipsToPrice(pair, spread) / 2;
  return midPrice - halfSpreadInPrice;
}

/**
 * Calculate pip value in USD for a given pair with live price support
 * For USD-quote pairs (EUR/USD, GBP/USD): pip value = $10 per standard lot
 * For USD-base pairs (USD/JPY, USD/CHF): pip value varies with current price
 * For cross pairs (EUR/GBP, EUR/JPY): requires conversion rate
 * 
 * @param pair - Currency pair (e.g., 'EUR/USD', 'GBP/JPY')
 * @param accountCurrency - Account currency (default 'USD')
 * @param currentPrice - Current market price of the pair (mid-market)
 * @param livePrices - Optional map of live exchange rates for cross pair conversion
 * @param useAskPrice - If true, uses ask price instead of mid for USD-base pairs (more accurate for position sizing)
 */
export function getPipValueInUSD(
  pair: string, 
  accountCurrency: string = 'USD',
  currentPrice?: number,
  livePrices?: Record<string, number>,
  useAskPrice: boolean = true
): number {
  const config = getPairConfig(pair);
  const pipSize = 1 / config.pipMultiplier;

  // Special handling for metals, crypto, and indices
  if (config.isMetalOrCrypto) {
    // Indices (US30 = Dow Jones, US100 = Nasdaq, etc.)
    if (config.baseCurrency === 'US30') {
      // US30/Dow Jones: 1 contract = $5 per point
      return 5;
    }
    if (config.baseCurrency === 'US100') {
      // US100/Nasdaq: 1 contract = $2 per point
      return 2;
    }
    if (config.baseCurrency === 'SPX' || config.baseCurrency === 'GER30' || config.baseCurrency === 'UK100') {
      // Other major indices: typically $10-25 per point, use conservative $10
      return 10;
    }
    
    // Metals
    if (config.baseCurrency === 'XAU') {
      // Gold (XAU/USD): 1 lot = 100 oz, 1 pip = $0.10 move = $10 per lot
      return 10;
    }
    if (config.baseCurrency === 'XAG') {
      // Silver (XAG/USD): 1 lot = 5,000 oz, 1 pip = $0.01 move = $50 per lot
      return 50;
    }
    
    // Crypto
    if (config.baseCurrency === 'BTC') {
      // Bitcoin: 1 lot = 1 BTC, 1 pip = $1 move = $1 per lot (BTC/USD uses whole dollars)
      return 1;
    }
    if (config.baseCurrency === 'ETH') {
      // Ethereum: 1 lot = 1 ETH, 1 pip = $0.10 move = $0.10 per lot
      return 0.10;
    }
    if (config.baseCurrency === 'LTC' || config.baseCurrency === 'XRP' || config.baseCurrency === 'ADA') {
      // Other crypto: 1 lot = 1 unit, 1 pip = $0.10 move = $0.10 per lot
      return 0.10;
    }
  }

  // If quote currency is USD, pip value is straightforward
  if (config.quoteCurrency === 'USD') {
    return STANDARD_LOT_SIZE * pipSize;
  }

  // For USD-base pairs (USD/XXX), calculate based on current price
  // Use ask price for more accurate position sizing (the price you actually pay)
  // Example: USD/JPY at 150.00 → pip value = 100,000 × 0.01 / 150.00 ≈ $6.67
  if (config.baseCurrency === 'USD' && currentPrice) {
    const priceToUse = useAskPrice ? getAskPrice(currentPrice, pair) : currentPrice;
    return (STANDARD_LOT_SIZE * pipSize) / priceToUse;
  }

  // For cross pairs (XXX/YYY where neither is USD), need conversion rate
  // Example: GBP/JPY needs GBP/USD rate to convert pip value to USD
  // Example: EUR/GBP needs GBP/USD rate to convert pip value to USD
  if (config.quoteCurrency !== 'USD' && livePrices) {
    // For JPY pairs, pip value in JPY is 1000 per standard lot (0.01 × 100,000)
    // For other pairs, pip value in quote currency is 10 per standard lot (0.0001 × 100,000)
    const pipValueInQuoteCurrency = STANDARD_LOT_SIZE * pipSize;
    
    // For JPY as quote currency, we need to divide by USD/JPY rate
    if (config.quoteCurrency === 'JPY') {
      const usdJpyRate = livePrices['USD/JPY'];
      if (usdJpyRate) {
        // pip value in USD = pip value in JPY / USD/JPY rate
        return pipValueInQuoteCurrency / usdJpyRate;
      }
    } else {
      // For other quote currencies, we need the quote/USD rate
      const conversionPair = `${config.quoteCurrency}/USD`;
      const conversionRate = livePrices[conversionPair];
      
      if (conversionRate) {
        return pipValueInQuoteCurrency * conversionRate;
      }
    }
  }

  // Fallback: Return approximate value when live prices aren't available
  // For JPY pairs, calculate using realistic mid-range USD/JPY rate
  if (config.quoteCurrency === 'JPY') {
    // Use realistic USD/JPY rate (recent range: 140-160)
    const fallbackUsdJpyRate = 157;
    return (STANDARD_LOT_SIZE * pipSize) / fallbackUsdJpyRate;
  }
  
  // For other quote currencies, return a generic pip value
  // This will be less accurate but better than returning 0
  return config.pipValueBase;
}

/**
 * Calculate position size (lot size) based on risk parameters
 * @param riskAmount - Amount willing to risk in account currency
 * @param stopLossPips - Distance to stop loss in pips
 * @param pair - Currency pair
 * @param accountCurrency - Account currency (default USD)
 * @param currentPrice - Current market price (needed for some pairs)
 * @returns Position size in standard lots
 */
export function calculatePositionSize(
  riskAmount: number,
  stopLossPips: number,
  pair: string,
  accountCurrency: string = 'USD',
  currentPrice?: number
): number {
  const pipValueUSD = getPipValueInUSD(pair, accountCurrency, currentPrice);
  
  // Position size = Risk Amount / (Stop Loss Pips × Pip Value)
  const positionSize = riskAmount / (stopLossPips * pipValueUSD);
  
  return Math.round(positionSize * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate P&L in USD for a trade
 * @param entryPrice - Entry price
 * @param exitPrice - Exit price
 * @param positionSize - Position size in lots
 * @param pair - Currency pair
 * @param direction - 'long' or 'short'
 * @returns P&L in USD
 */
export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  positionSize: number,
  pair: string,
  direction: 'long' | 'short'
): number {
  const pips = calculatePips(entryPrice, exitPrice, pair);
  const pipValueUSD = getPipValueInUSD(pair, 'USD', entryPrice);
  
  let pnl = positionSize * pips * pipValueUSD;
  
  // For short positions, reverse the P&L if price moved up
  if (direction === 'short') {
    if (exitPrice > entryPrice) {
      pnl = -pnl;
    }
  } else {
    // For long positions, reverse if price moved down
    if (exitPrice < entryPrice) {
      pnl = -pnl;
    }
  }
  
  return Math.round(pnl * 100) / 100;
}

/**
 * Calculate Risk-Reward ratio
 */
export function calculateRiskRewardRatio(
  pipsToStopLoss: number,
  pipsToTakeProfit: number
): number {
  if (pipsToStopLoss === 0) return 0;
  return Math.round((pipsToTakeProfit / pipsToStopLoss) * 100) / 100;
}
