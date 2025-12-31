import "https://deno.land/std@0.224.0/dotenv/load.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64 URL decode helper
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
  
  // Import private key
  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
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
  
  // Derive encryption key using HKDF
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const authInput = new Uint8Array(authSecret.length + sharedSecret.byteLength);
  authInput.set(authSecret);
  authInput.set(new Uint8Array(sharedSecret), authSecret.length);
  
  const authSecretKey = await crypto.subtle.importKey(
    'raw',
    authInput,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk = await crypto.subtle.sign('HMAC', authSecretKey, authInfo);
  
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
    ...new Uint8Array(0)
  ]);
  const keyInput = new Uint8Array([...new Uint8Array(prk), ...keyInfo, 1]);
  const keyHmacKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(prk),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const ikm = await crypto.subtle.sign('HMAC', keyHmacKey, keyInfo);
  
  const contentEncryptionKey = new Uint8Array(ikm).slice(0, 16);
  
  // Derive nonce
  const nonceInfo = new Uint8Array([
    ...new TextEncoder().encode('Content-Encoding: nonce\0'),
    ...new Uint8Array(0)
  ]);
  const nonceInput = new Uint8Array([...new Uint8Array(prk), ...nonceInfo, 1]);
  const nonceHmacKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(prk),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const nonceIkm = await crypto.subtle.sign('HMAC', nonceHmacKey, nonceInfo);
  const nonce = new Uint8Array(nonceIkm).slice(0, 12);
  
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
        console.log(`\nSending to ${isApple ? 'Apple' : 'Android'} device...`);
        
        // Encrypt payload
        const { ciphertext, salt, publicKey } = await encryptPayload(
          payload,
          sub.p256dh,
          sub.auth
        );
        
        // Generate VAPID header
        const jwt = await generateVAPIDHeader(sub.endpoint, vapidPublicKey, vapidPrivateKey);
        
        // Send push notification
        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
            'TTL': '86400',
          },
          body: new Uint8Array([
            ...salt,
            0, 0, 0x10, 0, // Record size (4096)
            publicKey.length,
            ...publicKey,
            ...ciphertext
          ])
        });

        if (response.ok || response.status === 201) {
          successCount++;
          console.log(`✓ Success (${response.status})`);
        } else {
          failCount++;
          const errorText = await response.text();
          console.error(`✗ Failed (${response.status}): ${errorText}`);
        }
      } catch (err) {
        failCount++;
        console.error(`✗ Error sending to subscription:`, err);
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
