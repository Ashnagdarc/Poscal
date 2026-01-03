import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    
    // Use service role to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { signalId } = await req.json();
    
    if (!signalId) {
      throw new Error('signalId is required');
    }
    
    console.log(`Processing signal: ${signalId}`);
    
    // Get signal details
    const { data: signal, error: signalError } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('id', signalId)
      .single();
    
    if (signalError || !signal) {
      throw new Error(`Signal not found: ${signalError?.message}`);
    }
    
    console.log('Signal:', signal);
    
    // Get taken trades for this signal
    const { data: takenTrades, error: tradesError } = await supabase
      .from('taken_trades')
      .select('*')
      .eq('signal_id', signalId)
      .eq('status', 'open');
    
    if (tradesError) {
      throw new Error(`Error fetching trades: ${tradesError.message}`);
    }
    
    console.log(`Found ${takenTrades?.length || 0} open taken trades`);
    
    if (!takenTrades || takenTrades.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No open trades to process',
        signal 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const results = [];
    
    for (const trade of takenTrades) {
      console.log(`Processing trade ${trade.id}`);
      
      // Calculate P&L
      let pnl = 0;
      let pnlPercent = 0;
      let balanceAdjustment = 0;
      
      if (signal.result === 'win') {
        pnl = trade.risk_amount;
        pnlPercent = trade.risk_percent;
        balanceAdjustment = trade.risk_amount;
      } else if (signal.result === 'loss') {
        pnl = -trade.risk_amount;
        pnlPercent = -trade.risk_percent;
        balanceAdjustment = -trade.risk_amount;
      } else if (signal.result === 'breakeven') {
        pnl = 0;
        pnlPercent = 0;
        balanceAdjustment = 0;
      }
      
      console.log(`P&L: ${pnl}, Balance adjustment: ${balanceAdjustment}`);
      
      // Update taken trade
      const { error: updateTradeError } = await supabase
        .from('taken_trades')
        .update({
          status: 'closed',
          result: signal.result,
          pnl,
          pnl_percent: pnlPercent,
          closed_at: new Date().toISOString(),
          journaled: true
        })
        .eq('id', trade.id);
      
      if (updateTradeError) {
        console.error('Failed to update trade:', updateTradeError);
        results.push({ trade: trade.id, error: updateTradeError.message });
        continue;
      }
      
      // Get current account balance
      const { data: account, error: accountError } = await supabase
        .from('trading_accounts')
        .select('current_balance')
        .eq('id', trade.account_id)
        .single();
      
      if (accountError || !account) {
        console.error('Failed to fetch account:', accountError);
        results.push({ trade: trade.id, error: 'Account fetch failed' });
        continue;
      }
      
      // Update account balance
      const newBalance = account.current_balance + balanceAdjustment;
      console.log(`Updating balance: ${account.current_balance} -> ${newBalance}`);
      
      const { error: balanceError } = await supabase
        .from('trading_accounts')
        .update({
          current_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.account_id);
      
      if (balanceError) {
        console.error('Failed to update balance:', balanceError);
        results.push({ trade: trade.id, error: balanceError.message });
        continue;
      }
      
      // Create journal entry
      const exitPrice = signal.result === 'win' 
        ? signal.take_profit_1 
        : signal.result === 'loss' 
        ? signal.stop_loss 
        : signal.entry_price;
      
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
          risk_percent: trade.risk_percent,
          pnl,
          pnl_percent: pnlPercent,
          status: 'closed',
          notes: `Auto-closed from signal: ${signal.currency_pair} ${signal.direction.toUpperCase()} - ${signal.result?.toUpperCase()}`,
          entry_date: trade.created_at
        });
      
      if (journalError) {
        console.error('Failed to create journal entry:', journalError);
        results.push({ trade: trade.id, journal_error: journalError.message });
      } else {
        results.push({ 
          trade: trade.id, 
          success: true, 
          pnl, 
          newBalance,
          journaled: true 
        });
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${takenTrades.length} trades`,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
