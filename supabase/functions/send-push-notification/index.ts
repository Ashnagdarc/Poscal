import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64 URL decode helper (for subscription keys)
function base64UrlDecode(input: string): Uint8Array {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) {
    if (pad === 1) throw new Error('Invalid base64url string');
    input += new Array(5 - pad).join('=');
  }
  const base64 = atob(input);
  const bytes = new Uint8Array(base64.length);
  for (let i = 0; i < base64.length; i++) {
    bytes[i] = base64.charCodeAt(i);
  }
  return bytes;
}

// Regular base64 decode helper (for VAPID keys)
function base64Decode(input: string): Uint8Array {
  const base64 = atob(input);
  const bytes = new Uint8Array(base64.length);
  for (let i = 0; i < base64.length; i++) {
    bytes[i] = base64.charCodeAt(i);
  }
  return bytes;
}

// Generate VAPID Authorization header
async function generateVAPIDHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const exp = Math.floor(Date.now() / 1000) + (12 * 60 * 60); // 12 hours
  const payload = btoa(JSON.stringify({ aud: audience, exp, sub: 'mailto:admin@poscal.app' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const unsignedToken = `${header}.${payload}`;
  
  // Decode the raw private key (VAPID keys are base64url encoded 32-byte raw keys)
  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  
  // Convert raw EC private key to JWK format for import
  const privateKeyJwk = {
    kty: 'EC',
    crv: 'P-256',
    d: btoa(String.fromCharCode(...privateKeyBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
    ext: true
  };
  
  // Import as JWK
  const key = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // Sign
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return `${unsignedToken}.${signatureBase64}`;
}

// HKDF-Expand function
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const iterations = Math.ceil(length / 32);
  const output = new Uint8Array(length);
  let t = new Uint8Array(0);
  let offset = 0;

  for (let i = 0; i < iterations; i++) {
    const combined = new Uint8Array(t.length + info.length + 1);
    combined.set(t);
    combined.set(info, t.length);
    combined[t.length + info.length] = i + 1;

    const key = await crypto.subtle.importKey(
      'raw',
      prk,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signed = await crypto.subtle.sign('HMAC', key, combined);
    t = new Uint8Array(signed);
    
    const copyLength = Math.min(t.length, length - offset);
    output.set(t.subarray(0, copyLength), offset);
    offset += copyLength;
  }

  return output;
}

// Encrypt payload using aes128gcm
async function encryptPayload(
  payload: string,
  userPublicKey: string,
  userAuthSecret: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; publicKey: Uint8Array }> {
  // Generate local key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  
  // Export local public key
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);
  
  // Import user public key
  const userPublicKeyBytes = base64UrlDecode(userPublicKey);
  const userPublicKeyCrypto = await crypto.subtle.importKey(
    'raw',
    userPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  
  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: userPublicKeyCrypto },
    localKeyPair.privateKey,
    256
  );
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Decode auth secret
  const authSecret = base64UrlDecode(userAuthSecret);
  
  // HKDF-Extract: derive PRK from auth secret and shared secret
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const ikmAuth = new Uint8Array(authSecret.length + sharedSecret.byteLength);
  ikmAuth.set(authSecret);
  ikmAuth.set(new Uint8Array(sharedSecret), authSecret.length);
  
  const authKey = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', authKey, ikmAuth));
  
  // HKDF-Expand: derive content encryption key
  const keyInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0P-256\0');
  const contentEncryptionKey = await hkdfExpand(prk, keyInfo, 16);
  
  // HKDF-Expand: derive nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0P-256\0');
  const nonce = await hkdfExpand(prk, nonceInfo, 12);
  
  // Import key for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey,
    'AES-GCM',
    false,
    ['encrypt']
  );
  
  // Encrypt with padding
  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 2);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // Padding delimiter
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    paddedPayload
  );
  
  return {
    ciphertext: new Uint8Array(ciphertext),
    salt,
    publicKey: localPublicKeyBytes
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    const { title, body, tag, data } = await req.json();

    if (!title) {
      throw new Error('Title is required');
    }

    console.log('=== PUSH NOTIFICATION REQUEST ===');
    console.log('Title:', title);
    console.log('Body:', body);

    // Fetch subscriptions
    const subsResponse = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const subscriptions = await subsResponse.json();
    console.log(`Found ${subscriptions.length} subscriptions`);

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

    for (const sub of subscriptions) {
      try {
        const isApple = sub.endpoint.includes('push.apple.com');
        const isGoogle = sub.endpoint.includes('fcm.googleapis.com');
        console.log(`\n=== Sending to ${isApple ? 'Apple' : isGoogle ? 'Google' : 'Other'} device ===`);
        console.log(`Endpoint: ${sub.endpoint.substring(0, 60)}...`);
        
        // Encrypt payload
        console.log('Encrypting payload...');
        const { ciphertext, salt, publicKey } = await encryptPayload(
          payload,
          sub.p256dh,
          sub.auth
        );
        console.log(`Encryption complete: salt=${salt.length}B, publicKey=${publicKey.length}B, ciphertext=${ciphertext.length}B`);
        
        // Generate VAPID header
        console.log('Generating VAPID JWT...');
        const jwt = await generateVAPIDHeader(sub.endpoint, vapidPublicKey, vapidPrivateKey);
        console.log(`VAPID JWT generated (${jwt.length} chars)`);
        
        // Prepare body
        const body = new Uint8Array([
          ...salt,
          0, 0, 0x10, 0, // Record size (4096)
          publicKey.length,
          ...publicKey,
          ...ciphertext
        ]);
        console.log(`Body size: ${body.length} bytes`);
        
        // Send push notification
        console.log('Sending HTTP POST...');
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
            'TTL': '86400',
          },
          body
        });

        console.log(`Response status: ${response.status} ${response.statusText}`);
        console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

        if (response.ok || response.status === 201) {
          successCount++;
          console.log(`✓ SUCCESS - Notification sent to ${isApple ? 'Apple' : isGoogle ? 'Google' : 'device'}`);
        } else {
          failCount++;
          const errorText = await response.text();
          console.error(`✗ FAILED - Status ${response.status}`);
          console.error(`Error body: ${errorText}`);
          console.error(`Subscription ID: ${sub.id}`);
        }
      } catch (err) {
        failCount++;
        console.error(`✗ EXCEPTION:`, err);
        console.error(`Subscription ID: ${sub.id}`);
        if (err instanceof Error) {
          console.error(`Error message: ${err.message}`);
          console.error(`Error stack: ${err.stack}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: failCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in send-push-notification:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
