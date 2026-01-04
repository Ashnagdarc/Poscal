import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIdentifier, createRateLimitHeaders, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Forex calculation constants
const STANDARD_LOT_SIZE = 100000;

// Dynamic pair configuration
function getPairConfig(pair: string) {
  const [base, quote] = pair.split('/');
  
  // Handle metals
  if (base === 'XAU' || base === 'XAG') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: base === 'XAU' ? 10 : 100,
      pipValueBase: base === 'XAU' ? 10 : 0.5,
    };
  }
  
  // Handle crypto
  if (base === 'BTC' || base === 'ETH') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: 10,
      pipValueBase: 1,
    };
  }
  
  // Handle JPY pairs
  if (quote === 'JPY') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: 100,
      pipValueBase: 9.09,
    };
  }
  
  // Default: Standard 4 decimal place pairs
  return {
    baseCurrency: base,
    quoteCurrency: quote,
    pipMultiplier: 10000,
    pipValueBase: 10,
  };
}

function calculatePips(price1: number, price2: number, pair: string): number {
  const config = getPairConfig(pair);
  return Math.abs(Math.round((price1 - price2) * config.pipMultiplier * 100) / 100);
}

function getPipValueInUSD(pair: string, currentPrice?: number): number {
  const config = getPairConfig(pair);
  const pipSize = 1 / config.pipMultiplier;

  // If quote currency is USD, pip value is straightforward
  if (config.quoteCurrency === 'USD') {
    return STANDARD_LOT_SIZE * pipSize;
  }

  // For USD-base pairs, calculate based on current price
  if (config.baseCurrency === 'USD' && currentPrice) {
    return (STANDARD_LOT_SIZE * pipSize) / currentPrice;
  }

  // Fallback to approximate value
  return config.pipValueBase;
}

function calculatePositionSize(
  riskAmount: number,
  stopLossPips: number,
  pair: string,
  currentPrice?: number
): number {
  const pipValueUSD = getPipValueInUSD(pair, currentPrice);
  const positionSize = riskAmount / (stopLossPips * pipValueUSD);
  return Math.round(positionSize * 100) / 100;
}

function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  positionSize: number,
  pair: string,
  direction: 'long' | 'short'
): number {
  const pips = calculatePips(entryPrice, exitPrice, pair);
  const pipValueUSD = getPipValueInUSD(pair, entryPrice);
  
  let pnl = positionSize * pips * pipValueUSD;
  
  // Adjust for direction
  if (direction === 'short') {
    if (exitPrice > entryPrice) {
      pnl = -pnl;
    }
  } else {
    if (exitPrice < entryPrice) {
      pnl = -pnl;
    }
  }
  
  return Math.round(pnl * 100) / 100;
}

interface TradingSignal {
  id: string;
  currency_pair: string;
  direction: 'buy' | 'sell';
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number | null;
  take_profit_3: number | null;
  pips_to_sl: number;
  pips_to_tp1: number;
  pips_to_tp2: number | null;
  pips_to_tp3: number | null;
  status: string;
  result: string | null;
  tp1_hit: boolean;
  tp2_hit: boolean;
  tp3_hit: boolean;
}

interface CheckResult extends Partial<TradingSignal> {
  shouldClose?: boolean;
  notificationType?: 'tp1' | 'tp2' | 'tp3' | 'sl';
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

async function handleCloseTakenTrades(
  supabase: any,
  signal: TradingSignal,
  signalResult: string
): Promise<void> {
  try {
    // Fetch all open taken trades for this signal
    const { data: takenTrades, error: fetchError } = await supabase
      .from('taken_trades')
      .select('*, trading_accounts(currency, current_balance)')
      .eq('signal_id', signal.id)
      .eq('status', 'open');

    if (fetchError) {
      console.error(`Error fetching taken trades for signal ${signal.id}:`, fetchError);
      return;
    }

    if (!takenTrades || takenTrades.length === 0) {
      console.log(`No open taken trades found for signal ${signal.id}`);
      return;
    }

    console.log(`Processing ${takenTrades.length} taken trades for signal ${signal.id}`);

    // Process each taken trade
    for (const trade of takenTrades) {
      console.log(`Processing trade ${trade.id} with risk: ${trade.risk_amount}`);
      
      // Calculate position size based on signal parameters
      const positionSize = calculatePositionSize(
        trade.risk_amount,
        signal.pips_to_sl,
        signal.currency_pair,
        signal.entry_price
      );
      
      console.log(`Position size: ${positionSize} lots for ${signal.currency_pair}`);
      
      let pnl = 0;
      let pnlPercent = 0;
      let balanceAdjustment = 0;
      let exitPrice = signal.entry_price;
      
      const direction = signal.direction === 'buy' ? 'long' : 'short';
      
      if (signalResult === 'win') {
        exitPrice = signal.take_profit_1;
        pnl = calculatePnL(
          signal.entry_price,
          signal.take_profit_1,
          positionSize,
          signal.currency_pair,
          direction
        );
        // Calculate pnl_percent based on account balance impact
        pnlPercent = trade.risk_percent * (pnl / trade.risk_amount);
        balanceAdjustment = pnl;
      } else if (signalResult === 'loss') {
        exitPrice = signal.stop_loss;
        pnl = -trade.risk_amount;
        pnlPercent = -trade.risk_percent;
        balanceAdjustment = pnl;
      } else if (signalResult === 'breakeven') {
        exitPrice = signal.entry_price;
        pnl = 0;
        pnlPercent = 0;
        balanceAdjustment = 0;
      }
      
      console.log(`P&L: ${pnl}, Balance adjustment: ${balanceAdjustment}`);

      // Update the taken trade
      const { error: updateTradeError } = await supabase
        .from('taken_trades')
        .update({
          status: 'closed',
          result: signalResult,
          pnl,
          pnl_percent: pnlPercent,
          closed_at: new Date().toISOString(),
          journaled: true
        })
        .eq('id', trade.id);

      if (updateTradeError) {
        console.error(`Failed to update taken trade ${trade.id}:`, updateTradeError);
        continue;
      }

      // Update account balance
      const newBalance = trade.trading_accounts.current_balance + balanceAdjustment;
      const { error: balanceError } = await supabase
        .from('trading_accounts')
        .update({ 
          current_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.account_id);

      if (balanceError) {
        console.error(`Failed to update account balance ${trade.account_id}:`, balanceError);
      }

      // Create journal entry
      const { error: journalError } = await supabase
        .from('trading_journal')
        .insert({
          user_id: trade.user_id,
          pair: signal.currency_pair,
          direction: signal.direction === 'buy' ? 'long' : 'short',
          entry_price: signal.entry_price,
          exit_price: exitPrice,
          stop_loss: signal.stop_loss,
          take_profit: signal.take_profit_1,
          position_size: positionSize,
          risk_percent: trade.risk_percent,
          pnl,
          pnl_percent: pnlPercent,
          status: 'closed',
          notes: `Auto-closed from signal: ${signal.currency_pair} ${signal.direction.toUpperCase()} - ${signalResult.toUpperCase()}`,
          entry_date: trade.created_at
        });

      if (journalError) {
        console.error(`Failed to create journal entry for trade ${trade.id}:`, journalError);
      } else {
        console.log(`✅ Successfully processed trade ${trade.id}: P&L ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}`);
      }
    }

    console.log(`Successfully processed ${takenTrades.length} taken trades for signal ${signal.id}`);
  } catch (err) {
    console.error(`Error closing taken trades for signal ${signal.id}:`, err);
  }
}

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

function checkLevels(signal: TradingSignal, currentPrice: number): CheckResult {
  const updates: CheckResult = {};
  const isBuy = signal.direction === 'buy';
  
  const hasTp3 = signal.take_profit_3 !== null;
  const hasTp2 = signal.take_profit_2 !== null;
  
  console.log(`Checking ${signal.currency_pair} (${signal.direction}): current=${currentPrice}, entry=${signal.entry_price}, SL=${signal.stop_loss}`);
  console.log(`  TPs: TP1=${signal.take_profit_1}, TP2=${signal.take_profit_2 || 'N/A'}, TP3=${signal.take_profit_3 || 'N/A'}`);
  console.log(`  Final target: ${hasTp3 ? 'TP3' : hasTp2 ? 'TP2' : 'TP1'}`);
  
  // Check Stop Loss
  if (isBuy) {
    if (currentPrice <= signal.stop_loss) {
      console.log(`🔴 STOP LOSS HIT for ${signal.currency_pair}`);
      updates.status = 'closed';
      updates.result = 'loss';
      updates.shouldClose = true;
      updates.notificationType = 'sl';
      return updates;
    }
  } else {
    if (currentPrice >= signal.stop_loss) {
      console.log(`🔴 STOP LOSS HIT for ${signal.currency_pair}`);
      updates.status = 'closed';
      updates.result = 'loss';
      updates.shouldClose = true;
      updates.notificationType = 'sl';
      return updates;
    }
  }
  
  // Check Take Profits
  if (isBuy) {
    // For BUY: price needs to go UP to hit TPs
    
    // Check TP3 (only if set)
    if (hasTp3 && !signal.tp3_hit && currentPrice >= signal.take_profit_3!) {
      console.log(`🏆 TP3 HIT (FINAL) for ${signal.currency_pair} - Closing as WIN`);
      updates.tp3_hit = true;
      updates.tp2_hit = true;
      updates.tp1_hit = true;
      updates.status = 'closed';
      updates.result = 'win';
      updates.shouldClose = true;
      updates.notificationType = 'tp3';
    } 
    // Check TP2 (only if set)
    else if (hasTp2 && !signal.tp2_hit && currentPrice >= signal.take_profit_2!) {
      console.log(`🟢 TP2 HIT for ${signal.currency_pair}`);
      updates.tp2_hit = true;
      updates.tp1_hit = true;
      updates.notificationType = 'tp2';
      
      if (!hasTp3) {
        console.log(`  ➡️ TP2 is FINAL target - Closing as WIN`);
        updates.status = 'closed';
        updates.result = 'win';
        updates.shouldClose = true;
      }
    } 
    // Check TP1
    else if (!signal.tp1_hit && currentPrice >= signal.take_profit_1) {
      console.log(`🟢 TP1 HIT for ${signal.currency_pair}`);
      updates.tp1_hit = true;
      updates.notificationType = 'tp1';
      
      if (!hasTp2 && !hasTp3) {
        console.log(`  ➡️ TP1 is FINAL target - Closing as WIN`);
        updates.status = 'closed';
        updates.result = 'win';
        updates.shouldClose = true;
      }
    }
  } else {
    // For SELL: price needs to go DOWN to hit TPs
    
    // Check TP3 (only if set)
    if (hasTp3 && !signal.tp3_hit && currentPrice <= signal.take_profit_3!) {
      console.log(`🏆 TP3 HIT (FINAL) for ${signal.currency_pair} - Closing as WIN`);
      updates.tp3_hit = true;
      updates.tp2_hit = true;
      updates.tp1_hit = true;
      updates.status = 'closed';
      updates.result = 'win';
      updates.shouldClose = true;
      updates.notificationType = 'tp3';
    } 
    // Check TP2 (only if set)
    else if (hasTp2 && !signal.tp2_hit && currentPrice <= signal.take_profit_2!) {
      console.log(`🟢 TP2 HIT for ${signal.currency_pair}`);
      updates.tp2_hit = true;
      updates.tp1_hit = true;
      updates.notificationType = 'tp2';
      
      if (!hasTp3) {
        console.log(`  ➡️ TP2 is FINAL target - Closing as WIN`);
        updates.status = 'closed';
        updates.result = 'win';
        updates.shouldClose = true;
      }
    } 
    // Check TP1
    else if (!signal.tp1_hit && currentPrice <= signal.take_profit_1) {
      console.log(`🟢 TP1 HIT for ${signal.currency_pair}`);
      updates.tp1_hit = true;
      updates.notificationType = 'tp1';
      
      if (!hasTp2 && !hasTp3) {
        console.log(`  ➡️ TP1 is FINAL target - Closing as WIN`);
        updates.status = 'closed';
        updates.result = 'win';
        updates.shouldClose = true;
      }
    }
  }
  
  return updates;
}

async function sendPushNotification(
  supabaseUrl: string,
  supabaseKey: string,
  title: string,
  body: string,
  tag: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    console.log(`📤 Sending push notification: ${title}`);
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, tag, data }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Push notification failed:', response.status, text);
    } else {
      const result = await response.json();
      console.log('Push notification result:', result);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Apply rate limiting (generous for internal cron jobs)
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.SIGNAL_MONITOR);
    
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
    
    // Fetch current prices for all pairs
    const priceMap: Record<string, number> = {};
    for (const pair of uniquePairs) {
      const price = await fetchPrice(pair, TWELVE_DATA_API_KEY);
      if (price !== null) {
        priceMap[pair] = price;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Process each signal
    const results: { signalId: string; updates: unknown }[] = [];
    const notifications: { type: string; pair: string }[] = [];
    
    for (const signal of signals) {
      const currentPrice = priceMap[signal.currency_pair];
      if (!currentPrice) {
        console.log(`No price available for ${signal.currency_pair}, skipping`);
        continue;
      }
      
      const updates = checkLevels(signal as TradingSignal, currentPrice);
      
      if (Object.keys(updates).length > 0) {
        const { shouldClose, notificationType, ...dbUpdates } = updates;
        
        if (shouldClose) {
          (dbUpdates as Record<string, unknown>).closed_at = new Date().toISOString();
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
          
          // If signal is closed, handle taken trades
          if (shouldClose && updates.result) {
            console.log(`Signal ${signal.id} closed with result: ${updates.result}`);
            await handleCloseTakenTrades(supabase, signal as TradingSignal, updates.result);
          }
          
          // Send push notification for TP/SL hits
          if (notificationType) {
            const pair = signal.currency_pair;
            let title = '';
            let body = '';
            
            if (notificationType === 'sl') {
              title = `🔴 Stop Loss Hit - ${pair}`;
              body = `${pair} ${signal.direction.toUpperCase()} signal hit stop loss at ${signal.stop_loss}`;
            } else if (notificationType === 'tp1') {
              title = `🟢 TP1 Hit - ${pair}`;
              body = `${pair} ${signal.direction.toUpperCase()} signal hit Take Profit 1 at ${signal.take_profit_1}`;
            } else if (notificationType === 'tp2') {
              title = `🟢 TP2 Hit - ${pair}`;
              body = `${pair} ${signal.direction.toUpperCase()} signal hit Take Profit 2 at ${signal.take_profit_2}`;
            } else if (notificationType === 'tp3') {
              title = `🏆 TP3 Hit - ${pair}`;
              body = `${pair} ${signal.direction.toUpperCase()} signal hit Take Profit 3 at ${signal.take_profit_3}`;
            }
            
            await sendPushNotification(
              SUPABASE_URL,
              SUPABASE_SERVICE_ROLE_KEY,
              title,
              body,
              'signal-update',
              { type: 'signal', signalId: signal.id, notificationType }
            );
            
            notifications.push({ type: notificationType, pair });
          }
        }
      }
    }
    
    console.log(`✅ Monitor complete. Updated ${results.length} signals, sent ${notifications.length} notifications`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${signals.length} signals, updated ${results.length}`,
      processed: signals.length,
      updated: results.length,
      notifications: notifications.length,
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
