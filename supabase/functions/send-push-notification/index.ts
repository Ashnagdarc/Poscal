import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to convert Uint8Array to base64url
function uint8ArrayToBase64url(uint8Array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...uint8Array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate VAPID JWT token
async function generateVapidJwt(
  audience: string,
  vapidPrivateKey: string,
  vapidPublicKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  // JWT Header
  const header = { alg: 'ES256', typ: 'JWT' };
  const headerB64 = uint8ArrayToBase64url(encoder.encode(JSON.stringify(header)));
  
  // JWT Claims
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: 'mailto:admin@poscal.app',
  };
  const claimsB64 = uint8ArrayToBase64url(encoder.encode(JSON.stringify(claims)));
  
  const unsignedToken = `${headerB64}.${claimsB64}`;
  
  // Import the VAPID private key (should be 32 bytes raw EC private key)
  const privateKeyBytes = base64urlToUint8Array(vapidPrivateKey);
  
  // For ECDSA P-256, we need to use PKCS8 or JWK format
  // Convert raw 32-byte key to JWK format
  const publicKeyBytes = base64urlToUint8Array(vapidPublicKey);
  
  // The public key is 65 bytes: 0x04 prefix + 32 bytes X + 32 bytes Y
  const x = uint8ArrayToBase64url(publicKeyBytes.slice(1, 33));
  const y = uint8ArrayToBase64url(publicKeyBytes.slice(33, 65));
  const d = uint8ArrayToBase64url(privateKeyBytes);
  
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d,
  };
  
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(unsignedToken)
  );
  
  // Convert signature from DER to raw format (r || s)
  const sigArray = new Uint8Array(signature);
  const signatureB64 = uint8ArrayToBase64url(sigArray);
  
  return `${unsignedToken}.${signatureB64}`;
}

// Send Web Push notification (simplified - no encryption for payload)
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<Response> {
  const audience = new URL(subscription.endpoint).origin;
  
  const jwt = await generateVapidJwt(audience, vapidPrivateKey, vapidPublicKey);
  
  console.log('Sending push to:', subscription.endpoint);
  
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
      'Content-Type': 'text/plain',
      'TTL': '86400',
    },
    body: payload,
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Push failed:', response.status, text);
    throw new Error(`Push failed: ${response.status} - ${text}`);
  }
  
  return response;
}

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

    console.log('Sending push notification:', { title, body, tag });

    // Get all push subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

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
    const expiredSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        await sendWebPush(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );
        successCount++;
        console.log(`Successfully sent to subscription ${sub.id}`);
      } catch (err) {
        console.error(`Failed to send to subscription ${sub.id}:`, err);
        failCount++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('410') || errorMessage.includes('404')) {
          expiredSubscriptions.push(sub.id);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubscriptions);
      console.log(`Cleaned up ${expiredSubscriptions.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        cleaned: expiredSubscriptions.length,
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
