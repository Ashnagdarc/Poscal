import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TradingSignal {
  id: string;
  currency_pair: string;
  direction: 'buy' | 'sell';
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number | null;
  take_profit_3: number | null;
  status: string;
  result: string | null;
  tp1_hit: boolean;
  tp2_hit: boolean;
  tp3_hit: boolean;
}

// Map currency pairs to Twelve Data symbols
const SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'EUR/USD',
  'GBP/USD': 'GBP/USD',
  'USD/JPY': 'USD/JPY',
  'USD/CHF': 'USD/CHF',
  'AUD/USD': 'AUD/USD',
  'USD/CAD': 'USD/CAD',
  'NZD/USD': 'NZD/USD',
  'EUR/GBP': 'EUR/GBP',
  'EUR/JPY': 'EUR/JPY',
  'GBP/JPY': 'GBP/JPY',
  'XAU/USD': 'XAU/USD',
  'BTC/USD': 'BTC/USD',
};

async function fetchPrice(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const formattedSymbol = symbol.replace('/', '');
    const url = `https://api.twelvedata.com/price?symbol=${formattedSymbol}&apikey=${apiKey}`;
    
    console.log(`Fetching price for ${symbol}...`);
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.price) {
      const price = parseFloat(data.price);
      console.log(`${symbol} current price: ${price}`);
      return price;
    }
    
    console.error(`No price data for ${symbol}:`, data);
    return null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}:`, error);
    return null;
  }
}

function checkLevels(signal: TradingSignal, currentPrice: number): Partial<TradingSignal> & { shouldClose?: boolean } {
  const updates: Partial<TradingSignal> & { shouldClose?: boolean } = {};
  const isBuy = signal.direction === 'buy';
  
  console.log(`Checking ${signal.currency_pair} (${signal.direction}): current=${currentPrice}, entry=${signal.entry_price}, SL=${signal.stop_loss}`);
  
  // Check Stop Loss
  if (isBuy) {
    if (currentPrice <= signal.stop_loss) {
      console.log(`🔴 STOP LOSS HIT for ${signal.currency_pair}`);
      updates.status = 'closed';
      updates.result = 'loss';
      updates.shouldClose = true;
      return updates;
    }
  } else {
    if (currentPrice >= signal.stop_loss) {
      console.log(`🔴 STOP LOSS HIT for ${signal.currency_pair}`);
      updates.status = 'closed';
      updates.result = 'loss';
      updates.shouldClose = true;
      return updates;
    }
  }
  
  // Check Take Profits (in order: TP3 -> TP2 -> TP1 for proper tracking)
  if (isBuy) {
    // For BUY: price needs to go UP to hit TPs
    if (signal.take_profit_3 && !signal.tp3_hit && currentPrice >= signal.take_profit_3) {
      console.log(`🟢 TP3 HIT for ${signal.currency_pair}`);
      updates.tp3_hit = true;
      updates.tp2_hit = true;
      updates.tp1_hit = true;
      updates.status = 'closed';
      updates.result = 'win';
      updates.shouldClose = true;
    } else if (signal.take_profit_2 && !signal.tp2_hit && currentPrice >= signal.take_profit_2) {
      console.log(`🟢 TP2 HIT for ${signal.currency_pair}`);
      updates.tp2_hit = true;
      updates.tp1_hit = true;
    } else if (!signal.tp1_hit && currentPrice >= signal.take_profit_1) {
      console.log(`🟢 TP1 HIT for ${signal.currency_pair}`);
      updates.tp1_hit = true;
    }
  } else {
    // For SELL: price needs to go DOWN to hit TPs
    if (signal.take_profit_3 && !signal.tp3_hit && currentPrice <= signal.take_profit_3) {
      console.log(`🟢 TP3 HIT for ${signal.currency_pair}`);
      updates.tp3_hit = true;
      updates.tp2_hit = true;
      updates.tp1_hit = true;
      updates.status = 'closed';
      updates.result = 'win';
      updates.shouldClose = true;
    } else if (signal.take_profit_2 && !signal.tp2_hit && currentPrice <= signal.take_profit_2) {
      console.log(`🟢 TP2 HIT for ${signal.currency_pair}`);
      updates.tp2_hit = true;
      updates.tp1_hit = true;
    } else if (!signal.tp1_hit && currentPrice <= signal.take_profit_1) {
      console.log(`🟢 TP1 HIT for ${signal.currency_pair}`);
      updates.tp1_hit = true;
    }
  }
  
  return updates;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWELVE_DATA_API_KEY = Deno.env.get('TWELVE_DATA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!TWELVE_DATA_API_KEY) {
      throw new Error('TWELVE_DATA_API_KEY is not configured');
    }
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('🔍 Starting signal monitor...');
    
    // Fetch all active signals
    const { data: signals, error: fetchError } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('status', 'active');
    
    if (fetchError) {
      throw new Error(`Failed to fetch signals: ${fetchError.message}`);
    }
    
    if (!signals || signals.length === 0) {
      console.log('No active signals to monitor');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active signals to monitor',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Found ${signals.length} active signals`);
    
    // Get unique currency pairs
    const uniquePairs = [...new Set(signals.map(s => s.currency_pair))];
    console.log(`Unique pairs to check: ${uniquePairs.join(', ')}`);
    
    // Fetch current prices for all pairs (with rate limiting consideration)
    const priceMap: Record<string, number> = {};
    for (const pair of uniquePairs) {
      const price = await fetchPrice(pair, TWELVE_DATA_API_KEY);
      if (price !== null) {
        priceMap[pair] = price;
      }
      // Small delay to avoid rate limiting (Twelve Data free tier: 8 req/min)
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Process each signal
    const results: { signalId: string; updates: any }[] = [];
    
    for (const signal of signals) {
      const currentPrice = priceMap[signal.currency_pair];
      if (!currentPrice) {
        console.log(`No price available for ${signal.currency_pair}, skipping`);
        continue;
      }
      
      const updates = checkLevels(signal as TradingSignal, currentPrice);
      
      if (Object.keys(updates).length > 0) {
        // Remove the shouldClose flag before updating
        const { shouldClose, ...dbUpdates } = updates;
        
        if (shouldClose) {
          (dbUpdates as any).closed_at = new Date().toISOString();
        }
        
        console.log(`Updating signal ${signal.id}:`, dbUpdates);
        
        const { error: updateError } = await supabase
          .from('trading_signals')
          .update(dbUpdates)
          .eq('id', signal.id);
        
        if (updateError) {
          console.error(`Failed to update signal ${signal.id}:`, updateError);
        } else {
          results.push({ signalId: signal.id, updates: dbUpdates });
        }
      }
    }
    
    console.log(`✅ Monitor complete. Updated ${results.length} signals`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${signals.length} signals, updated ${results.length}`,
      processed: signals.length,
      updated: results.length,
      updates: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in monitor-signals:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
