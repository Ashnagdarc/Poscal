import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

interface UseLivePricesOptions {
  symbols: string[];
  enabled?: boolean;
  refetchInterval?: number; // in milliseconds
}

export const LIVE_PRICES_QUERY_KEY = ['live_prices'] as const;

/**
 * Fetch live prices from multiple free APIs using React Query
 * - ExchangeRate-API for forex (updates multiple times/day, free, no key)
 * - CoinGecko API for crypto (free, no key)
 * - Metals-dev-api for gold/silver (free, no key)
 * - Fallback static rates for indices and unsupported pairs
 */
export const useLivePricesQuery = ({ 
  symbols, 
  enabled = true,
  refetchInterval = 60000 // 60 seconds default
}: UseLivePricesOptions) => {
  return useQuery({
    queryKey: [...LIVE_PRICES_QUERY_KEY, symbols.sort().join(',')],
    queryFn: async (): Promise<Record<string, number>> => {
      if (symbols.length === 0) return {};

      try {
        const prices: Record<string, number> = {};
        
        // Categorize symbols
        const forexSymbols = symbols.filter(s => !isCrypto(s) && !isMetal(s) && !isIndex(s));
        const cryptoSymbols = symbols.filter(isCrypto);
        const metalSymbols = symbols.filter(isMetal);
        const indexSymbols = symbols.filter(isIndex);
        
        // Fetch forex rates (ExchangeRate-API)
        if (forexSymbols.length > 0) {
          const forexPrices = await fetchForexPrices(forexSymbols);
          Object.assign(prices, forexPrices);
        }
        
        // Fetch crypto prices (CoinGecko API)
        if (cryptoSymbols.length > 0) {
          const cryptoPrices = await fetchCryptoPrices(cryptoSymbols);
          Object.assign(prices, cryptoPrices);
        }
        
        // Fetch metal prices (Metals-dev-api)
        if (metalSymbols.length > 0) {
          const metalPrices = await fetchMetalPrices(metalSymbols);
          Object.assign(prices, metalPrices);
        }
        
        // Use fallback for indices
        for (const symbol of indexSymbols) {
          prices[symbol] = getStaticFallbackRate(symbol);
        }
        
        return prices;
      } catch (error) {
        logger.error('Error fetching live prices:', error);
        // Return fallback rates when APIs fail
        const fallbackPrices: Record<string, number> = {};
        for (const symbol of symbols) {
          fallbackPrices[symbol] = getStaticFallbackRate(symbol);
        }
        return fallbackPrices;
      }
    },
    enabled: enabled && symbols.length > 0,
    staleTime: refetchInterval / 2,
    gcTime: 1000 * 60,
    refetchInterval,
    refetchIntervalInBackground: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

// Helper functions
function isCrypto(symbol: string): boolean {
  return symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT');
}

function isMetal(symbol: string): boolean {
  return symbol.includes('XAU') || symbol.includes('XAG');
}

function isIndex(symbol: string): boolean {
  return symbol.includes('US30') || symbol.includes('US100') || 
         symbol.includes('SPX') || symbol.includes('NAS');
}

async function fetchForexPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  try {
    // Using ExchangeRate-API.com - more frequent updates than ECB, no key required
    // Free tier: 1,500 requests/month, updates multiple times per day
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    
    if (!response.ok) {
      throw new Error('ExchangeRate API failed');
    }
    
    const data = await response.json();
    const rates = data.rates as Record<string, number>;
    
    for (const symbol of symbols) {
      const [base, quote] = symbol.split('/');
      
      if (base === 'USD' && rates[quote]) {
        prices[symbol] = rates[quote];
      } else if (quote === 'USD' && rates[base]) {
        prices[symbol] = 1 / rates[base];
      } else if (rates[base] && rates[quote]) {
        prices[symbol] = rates[quote] / rates[base];
      } else {
        prices[symbol] = getStaticFallbackRate(symbol);
      }
    }
  } catch (err) {
    logger.warn('Forex API error, using fallbacks:', err);
    for (const symbol of symbols) {
      prices[symbol] = getStaticFallbackRate(symbol);
    }
  }
  
  return prices;
}

async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  try {
    const coinIds: string[] = [];
    if (symbols.some(s => s.includes('BTC'))) coinIds.push('bitcoin');
    if (symbols.some(s => s.includes('ETH'))) coinIds.push('ethereum');
    
    if (coinIds.length === 0) return prices;
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`
    );
    
    if (!response.ok) {
      throw new Error('CoinGecko API failed');
    }
    
    const data = await response.json();
    
    for (const symbol of symbols) {
      if (symbol.includes('BTC') && data.bitcoin) {
        prices[symbol] = data.bitcoin.usd;
      } else if (symbol.includes('ETH') && data.ethereum) {
        prices[symbol] = data.ethereum.usd;
      } else {
        prices[symbol] = getStaticFallbackRate(symbol);
      }
    }
  } catch (err) {
    logger.warn('Crypto API error, using fallbacks:', err);
    for (const symbol of symbols) {
      prices[symbol] = getStaticFallbackRate(symbol);
    }
  }
  
  return prices;
}

async function fetchMetalPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  try {
    const response = await fetch('https://metals-api.com/api/latest?base=USD&symbols=XAU,XAG');
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.rates) {
        for (const symbol of symbols) {
          if (symbol.includes('XAU') && data.rates.XAU) {
            prices[symbol] = 1 / data.rates.XAU;
          } else if (symbol.includes('XAG') && data.rates.XAG) {
            prices[symbol] = 1 / data.rates.XAG;
          } else {
            prices[symbol] = getStaticFallbackRate(symbol);
          }
        }
      }
    } else {
      throw new Error('Metals API failed');
    }
  } catch (err) {
    logger.warn('Metals API error, using fallbacks:', err);
    for (const symbol of symbols) {
      prices[symbol] = getStaticFallbackRate(symbol);
    }
  }
  
  return prices;
}

function getStaticFallbackRate(symbol: string): number {
  const fallbackRates: Record<string, number> = {
    // Major USD pairs
    'EUR/USD': 1.09,
    'GBP/USD': 1.27,
    'USD/JPY': 157,
    'USD/CHF': 0.85,
    'AUD/USD': 0.66,
    'USD/CAD': 1.44,
    'NZD/USD': 0.58,
    
    // JPY cross pairs
    'EUR/JPY': 171,
    'GBP/JPY': 211,
    'AUD/JPY': 103,
    'CAD/JPY': 109,
    'CHF/JPY': 185,
    'NZD/JPY': 91,
    
    // Other cross pairs
    'EUR/GBP': 0.86,
    'EUR/AUD': 1.65,
    'EUR/CAD': 1.57,
    'EUR/CHF': 0.93,
    'GBP/AUD': 1.92,
    'GBP/CAD': 1.83,
    'GBP/CHF': 1.08,
    'AUD/CAD': 0.95,
    'AUD/CHF': 0.56,
    'AUD/NZD': 1.14,
    'NZD/CAD': 0.83,
    'NZD/CHF': 0.49,
    
    // Commodities (Metals)
    'XAU/USD': 2650,
    'XAG/USD': 30.5,
    
    // Indices
    'US30': 42500,
    'US100': 19800,
    
    // Crypto
    'BTC/USD': 95000,
    'ETH/USD': 3300,
  };
  
  return fallbackRates[symbol] || 1;
}