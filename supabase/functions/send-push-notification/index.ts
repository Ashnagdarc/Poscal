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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      throw new Error('VAPID keys not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { title, body, tag, data } = await req.json();

    if (!title) {
      throw new Error('Title is required');
    }

    console.log('=== PUSH NOTIFICATION REQUEST ===');
    console.log('Title:', title);
    console.log('Body:', body);
    console.log('Tag:', tag);
    console.log('VAPID keys configured:', {
      publicKey: !!vapidPublicKey,
      privateKey: !!vapidPrivateKey
    });

    // Get all push subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);
    
    if (subscriptions && subscriptions.length > 0) {
      subscriptions.forEach((sub, index) => {
        const endpoint = sub.endpoint;
        const isApple = endpoint.includes('push.apple.com');
        const isGoogleFCM = endpoint.includes('fcm.googleapis.com');
        console.log(`Subscription ${index + 1}: ${isApple ? 'Apple' : isGoogleFCM ? 'Google FCM' : 'Other'}`);
        console.log(`  Endpoint: ${endpoint.substring(0, 50)}...`);
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions found', sent: 0, failed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      tag: tag || 'general',
      data: data || {},
      icon: '/pwa-192x192.png',
      badge: '/favicon.png',
    });

    let successCount = 0;
    let failCount = 0;

    // Use web-push-deno library
    try {
      const webPushModule = await import('https://deno.land/x/web_push@0.0.2/mod.ts');
      
      webPushModule.setVapidDetails(
        'mailto:admin@poscal.app',
        vapidPublicKey,
        vapidPrivateKey
      );

      for (const sub of subscriptions) {
        const isApple = sub.endpoint.includes('push.apple.com');
        console.log(`\n--- Sending push to ${isApple ? 'Apple' : 'Other'} device ---`);
        console.log(`Subscription ID: ${sub.id}`);
        
        try {
          await webPushModule.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload
          );
          successCount++;
          console.log(`✓ Successfully sent to subscription ${sub.id}`);
        } catch (err) {
          console.error(`✗ Failed to send to subscription ${sub.id}:`, err);
          failCount++;
        }
      }
    } catch (importErr) {
      console.error('Failed to import web-push module:', importErr);
      throw new Error(`Web push module error: ${importErr instanceof Error ? importErr.message : 'Unknown'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in send-push-notification:', err);
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
