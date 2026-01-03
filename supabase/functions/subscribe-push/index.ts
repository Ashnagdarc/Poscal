import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { edgeLogger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    edgeLogger.log('Creating Supabase client with URL:', supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    edgeLogger.log('Received body:', JSON.stringify(body));
    
    const { subscription, user_id } = body;

    if (!subscription || !subscription.endpoint) {
      edgeLogger.error('Invalid subscription data:', subscription);
      throw new Error('Invalid subscription data - missing endpoint');
    }

    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      edgeLogger.error('Invalid subscription keys:', subscription.keys);
      throw new Error('Invalid subscription data - missing keys');
    }

    edgeLogger.log('Saving push subscription for user:', user_id);
    edgeLogger.log('Endpoint:', subscription.endpoint);
    edgeLogger.log('Keys present:', { p256dh: !!subscription.keys.p256dh, auth: !!subscription.keys.auth });

    // Check if subscription already exists
    const { data: existing, error: selectError } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle();

    if (selectError) {
      edgeLogger.error('Error checking existing subscription:', selectError);
      throw selectError;
    }

    edgeLogger.log('Existing subscription:', existing);

    if (existing) {
      // Update existing subscription
      edgeLogger.log('Updating existing subscription:', existing.id);
      const { error } = await supabase
        .from('push_subscriptions')
        .update({
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_id: user_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('endpoint', subscription.endpoint);

      if (error) {
        edgeLogger.error('Error updating subscription:', error);
        throw error;
      }
      edgeLogger.log('Successfully updated existing subscription');
    } else {
      // Insert new subscription
      edgeLogger.log('Inserting new subscription');
      const { data: inserted, error } = await supabase
        .from('push_subscriptions')
        .insert({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_id: user_id || null,
        })
        .select('id')
        .single();

      if (error) {
        edgeLogger.error('Error inserting subscription:', error);
        throw error;
      }
      edgeLogger.log('Successfully created new subscription:', inserted);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    edgeLogger.error('Error in subscribe-push:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});