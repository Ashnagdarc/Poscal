/**
 * Forex calculation utilities for accurate position sizing and P&L
 * Supports ALL currency pairs dynamically by detecting pair type
 */

// Constants
export const STANDARD_LOT_SIZE = 100000; // 1 standard lot = 100,000 units
export const MINI_LOT_SIZE = 10000;      // 1 mini lot = 10,000 units
export const MICRO_LOT_SIZE = 1000;      // 1 micro lot = 1,000 units

interface PairConfig {
  pipMultiplier: number; // How many to multiply price difference to get pips
  pipValueBase: number; // Base pip value for 1 standard lot
  quoteCurrency: string; // The second currency in the pair
  baseCurrency: string; // The first currency in the pair
  isMetalOrCrypto?: boolean;
}

/**
 * Dynamically determine configuration for ANY currency pair
 * Works for all XXX/YYY format pairs without hardcoding
 */
function getPairConfig(pair: string): PairConfig {
  const [base, quote] = pair.split('/');
  
  // Handle metals (Gold, Silver)
  if (base === 'XAU' || base === 'XAG') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: base === 'XAU' ? 10 : 100,
      pipValueBase: base === 'XAU' ? 10 : 0.5,
      isMetalOrCrypto: true
    };
  }
  
  // Handle crypto
  if (base === 'BTC' || base === 'ETH') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: 10,
      pipValueBase: 1,
      isMetalOrCrypto: true
    };
  }
  
  // Handle JPY pairs (2 decimal places)
  if (quote === 'JPY') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: 100,
      pipValueBase: 9.09 // Approximate, should use live rate
    };
  }
  
  // Default: Standard 4 decimal place pairs
  return {
    baseCurrency: base,
    quoteCurrency: quote,
    pipMultiplier: 10000,
    pipValueBase: 10
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
 * Calculate pip value in USD for a given pair with live price support
 * For USD-quote pairs (EUR/USD, GBP/USD): pip value = $10 per standard lot
 * For USD-base pairs (USD/JPY, USD/CHF): pip value varies with current price
 * For cross pairs (EUR/GBP, EUR/JPY): requires conversion rate
 * 
 * @param pair - Currency pair (e.g., 'EUR/USD', 'GBP/JPY')
 * @param accountCurrency - Account currency (default 'USD')
 * @param currentPrice - Current market price of the pair
 * @param livePrices - Optional map of live exchange rates for cross pair conversion
 */
export function getPipValueInUSD(
  pair: string, 
  accountCurrency: string = 'USD',
  currentPrice?: number,
  livePrices?: Record<string, number>
): number {
  const config = getPairConfig(pair);
  const pipSize = 1 / config.pipMultiplier;

  // If quote currency is USD, pip value is straightforward
  if (config.quoteCurrency === 'USD') {
    return STANDARD_LOT_SIZE * pipSize;
  }

  // For USD-base pairs (USD/XXX), calculate based on current price
  // Example: USD/JPY at 150.00 → pip value = 100,000 × 0.01 / 150.00 ≈ $6.67
  if (config.baseCurrency === 'USD' && currentPrice) {
    return (STANDARD_LOT_SIZE * pipSize) / currentPrice;
  }

  // For cross pairs (XXX/YYY where neither is USD), need conversion rate
  // Example: EUR/GBP needs GBP/USD rate to convert to USD
  if (config.quoteCurrency !== 'USD' && livePrices) {
    const conversionPair = `${config.quoteCurrency}/USD`;
    const conversionRate = livePrices[conversionPair];
    
    if (conversionRate) {
      return STANDARD_LOT_SIZE * pipSize * conversionRate;
    }
  }

  // Fallback: Return approximate value
  // This is used when live prices aren't available
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
