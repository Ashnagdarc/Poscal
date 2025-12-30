import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    console.log('Creating Supabase client with URL:', supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Received body:', JSON.stringify(body));
    
    const { subscription, user_id } = body;

    if (!subscription || !subscription.endpoint) {
      console.error('Invalid subscription data:', subscription);
      throw new Error('Invalid subscription data - missing endpoint');
    }

    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      console.error('Invalid subscription keys:', subscription.keys);
      throw new Error('Invalid subscription data - missing keys');
    }

    console.log('Saving push subscription for user:', user_id);
    console.log('Endpoint:', subscription.endpoint);
    console.log('Keys present:', { p256dh: !!subscription.keys.p256dh, auth: !!subscription.keys.auth });

    // Check if subscription already exists
    const { data: existing, error: selectError } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .maybeSingle();

    if (selectError) {
      console.error('Error checking existing subscription:', selectError);
      throw selectError;
    }

    console.log('Existing subscription:', existing);

    if (existing) {
      // Update existing subscription
      console.log('Updating existing subscription:', existing.id);
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
        console.error('Error updating subscription:', error);
        throw error;
      }
      console.log('Successfully updated existing subscription');
    } else {
      // Insert new subscription
      console.log('Inserting new subscription');
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
        console.error('Error inserting subscription:', error);
        throw error;
      }
      console.log('Successfully created new subscription:', inserted);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in subscribe-push:', err);
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