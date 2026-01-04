import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('🗑️ Starting database cleanup...');

    // Delete all journal entries
    const { error: journalError } = await supabase
      .from('trading_journal')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (journalError) {
      console.error('Error deleting journal entries:', journalError);
    } else {
      console.log('✅ Deleted all journal entries');
    }

    // Delete all taken trades
    const { error: tradesError } = await supabase
      .from('taken_trades')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (tradesError) {
      console.error('Error deleting taken trades:', tradesError);
    } else {
      console.log('✅ Deleted all taken trades');
    }

    // Delete all trading signals
    const { error: signalsError } = await supabase
      .from('trading_signals')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (signalsError) {
      console.error('Error deleting signals:', signalsError);
    } else {
      console.log('✅ Deleted all trading signals');
    }

    // Reset all trading account balances to initial balance
    const { data: accounts } = await supabase
      .from('trading_accounts')
      .select('id, initial_balance');

    if (accounts) {
      for (const account of accounts) {
        await supabase
          .from('trading_accounts')
          .update({
            current_balance: account.initial_balance,
            updated_at: new Date().toISOString()
          })
          .eq('id', account.id);
      }
      console.log(`✅ Reset ${accounts.length} trading account balances`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Database cleaned successfully!',
        details: {
          journal_entries: 'deleted',
          taken_trades: 'deleted',
          signals: 'deleted',
          accounts: 'reset to initial balance'
        }
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
