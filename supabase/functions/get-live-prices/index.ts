import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitHeaders, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceRequest {
  symbols: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Apply rate limiting
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.LIVE_PRICES);
    
    if (rateLimit.isLimited) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          ...createRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime)
        },
      });
    }

    const TWELVE_DATA_API_KEY = Deno.env.get('TWELVE_DATA_API_KEY');
    
    if (!TWELVE_DATA_API_KEY) {
      throw new Error('TWELVE_DATA_API_KEY is not configured');
    }
    
    const { symbols }: PriceRequest = await req.json();
    
    if (!symbols || symbols.length === 0) {
      return new Response(JSON.stringify({ prices: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Fetching prices for: ${symbols.join(', ')}`);
    
    // Format symbols for Twelve Data (remove slashes)
    const formattedSymbols = symbols.map(s => s.replace('/', '')).join(',');
    
    const url = `https://api.twelvedata.com/price?symbol=${formattedSymbols}&apikey=${TWELVE_DATA_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Twelve Data response:', data);
    
    const prices: Record<string, number> = {};
    
    // Handle single symbol response (returns object with price directly)
    if (symbols.length === 1) {
      if (data.price) {
        prices[symbols[0]] = parseFloat(data.price);
      }
    } else {
      // Handle multiple symbols (returns object with symbol keys)
      for (const symbol of symbols) {
        const formattedSymbol = symbol.replace('/', '');
        if (data[formattedSymbol]?.price) {
          prices[symbol] = parseFloat(data[formattedSymbol].price);
        }
      }
    }
    
    console.log('Parsed prices:', prices);
    
    // Get rate limit info for response headers
    const rateLimitHeaders = createRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime);
    
    return new Response(JSON.stringify({ prices }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        ...rateLimitHeaders
      },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching prices:', error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      prices: {}
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
