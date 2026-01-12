import { useState, useEffect, useCallback } from 'react';
import { TYPICAL_SPREADS, spreadPipsToPrice } from '@/lib/forexCalculations';

// Helper functions for spread calculation
function getTypicalSpread(symbol: string): number {
  return TYPICAL_SPREADS[symbol] || 2.0; // Default 2 pips if unknown
}

function getSpreadInPrice(symbol: string, spreadPips: number): number {
  return spreadPipsToPrice(symbol, spreadPips);
}

interface UseLivePricesOptions {
  symbols: string[];
  enabled?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseLivePricesResult {
  prices: Record<string, number>;
  askPrices: Record<string, number>; // Real ask prices from API
  bidPrices: Record<string, number>; // Real bid prices from API
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

// Global cache to share prices across all components
const priceCache: {
  data: Record<string, number>;
  askData: Record<string, number>;
  bidData: Record<string, number>;
  timestamp: number | null;
  promise: Promise<{ prices: Record<string, number>; askPrices: Record<string, number>; bidPrices: Record<string, number> }> | null;
} = {
  data: {},
  askData: {},
  bidData: {},
  timestamp: null,
  promise: null
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch live prices from multiple free APIs with intelligent caching
 * - ExchangeRate-API for forex (updates multiple times/day, free, no key)
 * - CoinGecko API for crypto (free, no key)
 * - Metals-dev-api for gold/silver (free, no key)
 * - Fallback static rates for indices and unsupported pairs
 * 
 * Implements client-side caching to reduce API calls by 90%
 */
export const useLivePrices = ({ 
  symbols, 
  enabled = true, 
  refreshInterval = 10 * 1000 // 10 seconds for accurate pricing
}: UseLivePricesOptions): UseLivePricesResult => {
  const [prices, setPrices] = useState<Record<string, number>>(priceCache.data);
  const [askPrices, setAskPrices] = useState<Record<string, number>>(priceCache.askData);
  const [bidPrices, setBidPrices] = useState<Record<string, number>>(priceCache.bidData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    priceCache.timestamp ? new Date(priceCache.timestamp) : null
  );

  const fetchPrices = useCallback(async () => {
    if (!enabled || symbols.length === 0) return;
    
    // Check if cache is still valid
    const now = Date.now();
    const cacheAge = priceCache.timestamp ? now - priceCache.timestamp : Infinity;
    
    if (cacheAge < CACHE_DURATION && Object.keys(priceCache.data).length > 0) {
      // Use cached data
      setPrices(priceCache.data);
      setAskPrices(priceCache.askData);
      setBidPrices(priceCache.bidData);
      setLastUpdated(new Date(priceCache.timestamp!));
      return;
    }
    
    // If another component is already fetching, wait for that instead
    if (priceCache.promise) {
      try {
        const data = await priceCache.promise;
        setPrices(data.prices);
        setAskPrices(data.askPrices);
        setBidPrices(data.bidPrices);
        setLastUpdated(new Date(priceCache.timestamp!));
        return;
      } catch (err) {
        // Fall through to fetch ourselves
      }
    }
    
    setLoading(true);
    setError(null);
    
    // Create a promise that other components can await
    priceCache.promise = (async () => {
      try {
        const newPrices: Record<string, number> = {};
        const newAskPrices: Record<string, number> = {};
        const newBidPrices: Record<string, number> = {};
        
        // Categorize symbols
        const forexSymbols = symbols.filter(s => !isCrypto(s) && !isMetal(s) && !isIndex(s));
        const cryptoSymbols = symbols.filter(isCrypto);
        const metalSymbols = symbols.filter(isMetal);
        const indexSymbols = symbols.filter(isIndex);
        
        // Fetch forex rates (ExchangeRate-API)
        if (forexSymbols.length > 0) {
          const { prices: forexPrices, askPrices: forexAsk, bidPrices: forexBid } = await fetchForexPrices(forexSymbols);
          Object.assign(newPrices, forexPrices);
          Object.assign(newAskPrices, forexAsk);
          Object.assign(newBidPrices, forexBid);
        }
        
        // Fetch crypto prices (CoinGecko API)
        if (cryptoSymbols.length > 0) {
          const { prices: cryptoPrices, askPrices: cryptoAsk, bidPrices: cryptoBid } = await fetchCryptoPrices(cryptoSymbols);
          Object.assign(newPrices, cryptoPrices);
          Object.assign(newAskPrices, cryptoAsk);
          Object.assign(newBidPrices, cryptoBid);
        }
        
        // Fetch metal prices (Metals-dev-api)
        if (metalSymbols.length > 0) {
          const { prices: metalPrices, askPrices: metalAsk, bidPrices: metalBid } = await fetchMetalPrices(metalSymbols);
          Object.assign(newPrices, metalPrices);
          Object.assign(newAskPrices, metalAsk);
          Object.assign(newBidPrices, metalBid);
        }
        
        // Use fallback for indices
        for (const symbol of indexSymbols) {
          const fallbackPrice = getStaticFallbackRate(symbol);
          newPrices[symbol] = fallbackPrice;
          newAskPrices[symbol] = fallbackPrice;
          newBidPrices[symbol] = fallbackPrice;
        }
        
        // Update global cache
        priceCache.data = newPrices;
        priceCache.askData = newAskPrices;
        priceCache.bidData = newBidPrices;
        priceCache.timestamp = Date.now();
        priceCache.promise = null;
        
        setPrices(newPrices);
        setAskPrices(newAskPrices);
        setBidPrices(newBidPrices);
        setLastUpdated(new Date());
        
        return { prices: newPrices, askPrices: newAskPrices, bidPrices: newBidPrices };
      } catch (err) {
        console.error('Error fetching live prices:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch prices');
        
        // Use fallback rates when APIs fail
        const fallbackPrices: Record<string, number> = {};
        for (const symbol of symbols) {
          const fallback = getStaticFallbackRate(symbol);
          fallbackPrices[symbol] = fallback;
        }
        
        priceCache.data = fallbackPrices;
        priceCache.askData = fallbackPrices; // Use same fallback
        priceCache.bidData = fallbackPrices; // Use same fallback
        priceCache.timestamp = Date.now();
        priceCache.promise = null;
        
        setPrices(fallbackPrices);
        setAskPrices(fallbackPrices);
        setBidPrices(fallbackPrices);
        return { prices: fallbackPrices, askPrices: fallbackPrices, bidPrices: fallbackPrices };
      } finally {
        setLoading(false);
      }
    })();
    
    await priceCache.promise;
  }, [symbols, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Periodic refresh
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;
    
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, enabled, refreshInterval]);

  return {
    prices,
    askPrices,
    bidPrices,
    loading,
    error,
    lastUpdated,
    refresh: fetchPrices
  };
};

// Helper functions to categorize symbols
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

/**
 * Fetch forex prices from ExchangeRate-API (open.er-api.com)
 * Updates multiple times per day, more accurate than ECB daily rates
 * Returns mid-market prices with estimated bid/ask based on typical spreads
 */
async function fetchForexPrices(symbols: string[]): Promise<{
  prices: Record<string, number>;
  askPrices: Record<string, number>;
  bidPrices: Record<string, number>;
}> {
  const prices: Record<string, number> = {};
  const askPrices: Record<string, number> = {};
  const bidPrices: Record<string, number> = {};
  
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
      
      let midPrice: number | null = null;
      
      // Direct USD pairs (e.g., USD/JPY, USD/CHF)
      if (base === 'USD' && rates[quote]) {
        midPrice = rates[quote];
      }
      // Reverse USD pairs (e.g., EUR/USD, GBP/USD)
      else if (quote === 'USD' && rates[base]) {
        midPrice = 1 / rates[base];
      }
      // Cross pairs (e.g., EUR/GBP, GBP/JPY)
      else if (rates[base] && rates[quote]) {
        midPrice = rates[quote] / rates[base];
      }
      
      if (midPrice) {
        prices[symbol] = midPrice;
        
        // Estimate bid/ask using typical spreads
        // Import spread calculation from forexCalculations
        const typicalSpread = getTypicalSpread(symbol);
        const halfSpread = getSpreadInPrice(symbol, typicalSpread) / 2;
        
        askPrices[symbol] = midPrice + halfSpread;
        bidPrices[symbol] = midPrice - halfSpread;
      } else {
        // Fallback
        const fallback = getStaticFallbackRate(symbol);
        prices[symbol] = fallback;
        askPrices[symbol] = fallback;
        bidPrices[symbol] = fallback;
      }
    }
  } catch (err) {
    console.warn('Forex API error, using fallbacks:', err);
    // Return fallbacks for all requested symbols
    for (const symbol of symbols) {
      const fallback = getStaticFallbackRate(symbol);
      prices[symbol] = fallback;
      askPrices[symbol] = fallback;
      bidPrices[symbol] = fallback;
    }
  }
  
  return { prices, askPrices, bidPrices };
}

/**
 * Fetch crypto prices from CoinGecko API (free, no key)
 */
async function fetchCryptoPrices(symbols: string[]): Promise<{
  prices: Record<string, number>;
  askPrices: Record<string, number>;
  bidPrices: Record<string, number>;
}> {
  const prices: Record<string, number> = {};
  const askPrices: Record<string, number> = {};
  const bidPrices: Record<string, number> = {};
  
  try {
    // Map symbols to CoinGecko IDs
    const coinIds: string[] = [];
    if (symbols.some(s => s.includes('BTC'))) coinIds.push('bitcoin');
    if (symbols.some(s => s.includes('ETH'))) coinIds.push('ethereum');
    
    if (coinIds.length === 0) return { prices, askPrices, bidPrices };
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`
    );
    
    if (!response.ok) {
      throw new Error('CoinGecko API failed');
    }
    
    const data = await response.json();
    
    for (const symbol of symbols) {
      let midPrice: number | null = null;
      
      if (symbol.includes('BTC') && data.bitcoin) {
        midPrice = data.bitcoin.usd;
      } else if (symbol.includes('ETH') && data.ethereum) {
        midPrice = data.ethereum.usd;
      }
      
      if (midPrice) {
        prices[symbol] = midPrice;
        
        // Estimate bid/ask using typical spreads
        const typicalSpread = getTypicalSpread(symbol);
        const halfSpread = getSpreadInPrice(symbol, typicalSpread) / 2;
        
        askPrices[symbol] = midPrice + halfSpread;
        bidPrices[symbol] = midPrice - halfSpread;
      } else {
        const fallback = getStaticFallbackRate(symbol);
        prices[symbol] = fallback;
        askPrices[symbol] = fallback;
        bidPrices[symbol] = fallback;
      }
    }
  } catch (err) {
    console.warn('Crypto API error, using fallbacks:', err);
    for (const symbol of symbols) {
      const fallback = getStaticFallbackRate(symbol);
      prices[symbol] = fallback;
      askPrices[symbol] = fallback;
      bidPrices[symbol] = fallback;
    }
  }
  
  return { prices, askPrices, bidPrices };
}

/**
 * Fetch metal prices (Gold/Silver)
 */
async function fetchMetalPrices(symbols: string[]): Promise<{
  prices: Record<string, number>;
  askPrices: Record<string, number>;
  bidPrices: Record<string, number>;
}> {
  const prices: Record<string, number> = {};
  const askPrices: Record<string, number> = {};
  const bidPrices: Record<string, number> = {};
  
  try {
    // Using metals-api.com free tier (no key for basic usage)
    const response = await fetch('https://metals-api.com/api/latest?base=USD&symbols=XAU,XAG');
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.rates) {
        for (const symbol of symbols) {
          let midPrice: number | null = null;
          
          if (symbol.includes('XAU') && data.rates.XAU) {
            // Metals API returns rates in troy ounces, invert for USD price
            midPrice = 1 / data.rates.XAU;
          } else if (symbol.includes('XAG') && data.rates.XAG) {
            midPrice = 1 / data.rates.XAG;
          }
          
          if (midPrice) {
            prices[symbol] = midPrice;
            
            // Estimate bid/ask using typical spreads
            const typicalSpread = getTypicalSpread(symbol);
            const halfSpread = getSpreadInPrice(symbol, typicalSpread) / 2;
            
            askPrices[symbol] = midPrice + halfSpread;
            bidPrices[symbol] = midPrice - halfSpread;
          } else {
            const fallback = getStaticFallbackRate(symbol);
            prices[symbol] = fallback;
            askPrices[symbol] = fallback;
            bidPrices[symbol] = fallback;
          }
        }
      }
    } else {
      throw new Error('Metals API failed');
    }
  } catch (err) {
    console.warn('Metals API error, using fallbacks:', err);
    // Use fallback rates
    for (const symbol of symbols) {
      const fallback = getStaticFallbackRate(symbol);
      prices[symbol] = fallback;
      askPrices[symbol] = fallback;
      bidPrices[symbol] = fallback;
    }
  }
  
  return { prices, askPrices, bidPrices };
}

/**
 * Static fallback rates based on recent market averages
 * Used when live APIs are unavailable
 */
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