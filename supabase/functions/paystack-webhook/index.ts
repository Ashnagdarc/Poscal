import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const PAYSTACK_WEBHOOK_SECRET = Deno.env.get('PAYSTACK_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: {
      userId?: string;
      tier?: string;
      [key: string]: any;
    };
    fees?: number;
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: Record<string, any>;
      risk_action: string;
    };
    authorization?: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
      account_name: string | null;
    };
  };
}

// Verify Paystack webhook signature
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!PAYSTACK_WEBHOOK_SECRET) {
    console.error('[webhook] PAYSTACK_WEBHOOK_SECRET not set');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(PAYSTACK_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return computedSignature === signature;
  } catch (error) {
    console.error('[webhook] Error verifying signature:', error);
    return false;
  }
}

serve(async (req) => {
  try {
    // Get signature from headers
    const signature = req.headers.get('x-paystack-signature');
    
    if (!signature) {
      console.error('[webhook] No signature in request');
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get raw body for signature verification
    const rawBody = await req.text();
    
    // Verify signature
    const isValid = await verifySignature(rawBody, signature);
    
    if (!isValid) {
      console.error('[webhook] Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse webhook event
    const event: PaystackWebhookEvent = JSON.parse(rawBody);
    
    console.log(`[webhook] Received event: ${event.event}, reference: ${event.data.reference}`);

    // Initialize Supabase admin client
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Log webhook event
    await supabase.from('paystack_webhook_logs').insert({
      event_type: event.event,
      reference: event.data.reference,
      status: event.data.status,
      payload: event,
    });

    // Handle charge.success event
    if (event.event === 'charge.success' && event.data.status === 'success') {
      console.log(`[webhook] Processing successful charge: ${event.data.reference}`);

      // Extract userId and tier from reference
      // Format: poscal_{userId}_{tier}_{timestamp}
      const refParts = event.data.reference.split('_');
      const userId = refParts[1];
      const tier = refParts[2];

      if (!userId || !tier) {
        console.error('[webhook] Could not extract userId or tier from reference');
        return new Response(JSON.stringify({ error: 'Invalid reference format' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Calculate subscription expiry (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      // Update user's subscription
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          payment_status: 'paid',
          subscription_tier: tier,
          subscription_expires_at: expiryDate.toISOString(),
          payment_reference: event.data.reference,
          payment_date: new Date().toISOString(),
          paystack_customer_code: event.data.customer.customer_code,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[webhook] Error updating profile:', updateError);
        return new Response(JSON.stringify({ error: 'Database update failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Insert or update payment record
      const { error: paymentError } = await supabase.from('payments').insert({
        user_id: userId,
        amount: event.data.amount / 100, // Convert kobo to naira
        currency: event.data.currency,
        status: 'success',
        payment_method: 'paystack',
        paystack_reference: event.data.reference,
        paystack_customer_code: event.data.customer.customer_code,
        tier,
        subscription_start: new Date().toISOString(),
        subscription_end: expiryDate.toISOString(),
        metadata: {
          channel: event.data.channel,
          ip_address: event.data.ip_address,
          fees: event.data.fees || 0,
          authorization: event.data.authorization,
          gateway_response: event.data.gateway_response,
          webhook_event: event.event,
        },
      });

      if (paymentError) {
        console.error('[webhook] Error inserting payment:', paymentError);
        // Don't fail - profile is already updated
      }

      console.log(`[webhook] Successfully processed payment for user ${userId}`);
    }

    // Return 200 to acknowledge receipt
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[webhook] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
