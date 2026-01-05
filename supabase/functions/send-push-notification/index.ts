import "https://deno.land/std@0.224.0/dotenv/load.ts";
import webpush from "npm:web-push@3.6.7";

import { edgeLogger } from "../_shared/logger.ts";
import { checkRateLimit, getClientIdentifier, createRateLimitHeaders, RATE_LIMITS } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Apply rate limiting
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(clientId, RATE_LIMITS.PUSH_NOTIFICATION);
    
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

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    // Configure web-push with VAPID details
    webpush.setVapidDetails(
      'mailto:admin@poscal.app',
      vapidPublicKey,
      vapidPrivateKey
    );

    const { title, body, tag, data, user_id } = await req.json();

    if (!title) {
      throw new Error('Title is required');
    }

    edgeLogger.log('=== PUSH NOTIFICATION REQUEST ===');
    edgeLogger.log('Title:', title);
    edgeLogger.log('Body:', body);
    edgeLogger.log('Target user:', user_id || 'all users');

    // Fetch subscriptions (optionally filter by user_id)
    let query = `${supabaseUrl}/rest/v1/push_subscriptions?select=*`;
    if (user_id) {
      query += `&user_id=eq.${user_id}`;
    }

    const subsResponse = await fetch(query, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const subscriptions = await subsResponse.json();
    edgeLogger.log(`Found ${subscriptions.length} subscriptions`);

    if (subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions', sent: 0, failed: 0 }),
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
    const failedEndpoints: string[] = [];

    // Send notifications in parallel for better performance
    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 86400, // 24 hours
          });
          
          edgeLogger.log(`✓ Sent to: ${sub.endpoint.substring(0, 60)}...`);
          return { success: true, endpoint: sub.endpoint };
        } catch (error: any) {
          edgeLogger.error(`✗ Failed to send to ${sub.endpoint.substring(0, 60)}:`, error);
          
          // Check if subscription is expired/invalid (410 Gone or 404)
          if (error?.statusCode === 410 || error?.statusCode === 404) {
            edgeLogger.log(`Removing invalid subscription: ${sub.id}`);
            // Delete invalid subscription
            await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
              method: 'DELETE',
              headers: {
                'apikey': supabaseKey!,
                'Authorization': `Bearer ${supabaseKey}`
              }
            });
          }
          
          return { success: false, endpoint: sub.endpoint, error };
        }
      })
    );

    // Count results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
      } else {
        failCount++;
        if (result.status === 'fulfilled' && result.value.endpoint) {
          failedEndpoints.push(result.value.endpoint);
        }
      }
    });

    edgeLogger.log(`\n=== RESULTS ===`);
    edgeLogger.log(`Success: ${successCount}`);
    edgeLogger.log(`Failed: ${failCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        failed: failCount,
        failedEndpoints: failedEndpoints.length > 0 ? failedEndpoints : undefined
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          ...createRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime)
        } 
      }
    );
  } catch (err) {
    edgeLogger.error('Error in send-push-notification:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
