import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Forex calculation constants
const STANDARD_LOT_SIZE = 100000;

function getPairConfig(pair: string) {
  const [base, quote] = pair.split('/');
  
  if (base === 'XAU' || base === 'XAG') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: base === 'XAU' ? 10 : 100,
      pipValueBase: base === 'XAU' ? 10 : 0.5,
    };
  }
  
  if (base === 'BTC' || base === 'ETH') {
    return {
      baseCurrency: base,
      quoteCurrency: quote,
      pipMultiplier: 1,
      pipValueBase: 1,
    };
  }
  
  return {
    baseCurrency: base,
    quoteCurrency: quote,
    pipMultiplier: quote === 'JPY' ? 100 : 10000,
    pipValueBase: 1,
  };
}

function calculatePositionSize(
  riskAmount: number,
  pipsToSL: number,
  pair: string,
  entryPrice: number
): number {
  const config = getPairConfig(pair);
  const pipValue = (STANDARD_LOT_SIZE / config.pipMultiplier) / entryPrice;
  const positionSize = riskAmount / (pipsToSL * pipValue);
  return positionSize;
}

function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  positionSize: number,
  pair: string,
  direction: 'long' | 'short'
): number {
  const config = getPairConfig(pair);
  const priceMove = direction === 'long' 
    ? (exitPrice - entryPrice) 
    : (entryPrice - exitPrice);
  
  const pips = priceMove * config.pipMultiplier;
  const pipValue = (STANDARD_LOT_SIZE * positionSize) / config.pipMultiplier / entryPrice;
  const pnl = pips * pipValue;
  
  return pnl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { signalId, signalResult } = await req.json();

    console.log(`Closing taken trades for signal ${signalId} with result: ${signalResult}`);

    // Fetch the signal details
    const { data: signal, error: signalError } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('id', signalId)
      .single();

    if (signalError || !signal) {
      throw new Error('Signal not found');
    }

    // Fetch all open taken trades for this signal
    const { data: takenTrades, error: fetchError } = await supabase
      .from('taken_trades')
      .select('*')
      .eq('signal_id', signalId)
      .eq('status', 'open');

    if (fetchError) {
      throw fetchError;
    }

    if (!takenTrades || takenTrades.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No open taken trades found', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${takenTrades.length} taken trades`);

    // Process each taken trade
    for (const trade of takenTrades) {
      const positionSize = calculatePositionSize(
        trade.risk_amount,
        signal.pips_to_sl,
        signal.currency_pair,
        signal.entry_price
      );

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
        pnlPercent = trade.risk_percent * (pnl / trade.risk_amount);
        balanceAdjustment = pnl;
      } else if (signalResult === 'loss') {
        exitPrice = signal.stop_loss;
        // Calculate actual loss based on stop loss price (not just risk amount)
        pnl = calculatePnL(
          signal.entry_price,
          signal.stop_loss,
          positionSize,
          signal.currency_pair,
          direction
        );
        pnlPercent = trade.risk_percent * (pnl / trade.risk_amount);
        balanceAdjustment = pnl;
      } else if (signalResult === 'breakeven') {
        exitPrice = signal.entry_price;
        pnl = 0;
        pnlPercent = 0;
        balanceAdjustment = 0;
      }

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
        console.error(`Failed to update trade ${trade.id}:`, updateTradeError);
        continue;
      }

      // Fetch current account balance
      const { data: accountData, error: accountFetchError } = await supabase
        .from('trading_accounts')
        .select('current_balance')
        .eq('id', trade.account_id)
        .single();

      if (accountFetchError || !accountData) {
        console.error(`Failed to fetch account ${trade.account_id}:`, accountFetchError);
        continue;
      }

      // Update account balance
      const newBalance = accountData.current_balance + balanceAdjustment;
      const { error: balanceError } = await supabase
        .from('trading_accounts')
        .update({
          current_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.account_id);

      if (balanceError) {
        console.error(`Failed to update account balance:`, balanceError);
      }

      // Create journal entry
      const { error: journalError } = await supabase
        .from('trading_journal')
        .insert({
          user_id: trade.user_id,
          account_id: trade.account_id,
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
        console.error(`Failed to create journal entry:`, journalError);
      } else {
        console.log(`✅ Processed trade ${trade.id}: P&L ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Successfully closed taken trades', 
        count: takenTrades.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
