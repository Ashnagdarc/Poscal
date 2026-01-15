import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
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
    metadata: Record<string, any>;
    fees: number;
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
    authorization: {
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
    plan: string | null;
  };
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Parse request body
    const { reference, userId, tier } = await req.json();

    if (!reference || !userId || !tier) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing required fields: reference, userId, or tier',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify with Paystack API
    console.log(`[verify-payment] Verifying payment reference: ${reference}`);
    
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!paystackResponse.ok) {
      console.error('[verify-payment] Paystack API error:', paystackResponse.status);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to verify payment with Paystack',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const paystackData: PaystackVerifyResponse = await paystackResponse.json();

    if (!paystackData.status || paystackData.data.status !== 'success') {
      console.log('[verify-payment] Payment not successful:', paystackData.data.status);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Payment status: ${paystackData.data.status}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

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

    // Calculate subscription expiry (30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // Update user's subscription in profiles table
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        payment_status: 'paid',
        subscription_tier: tier,
        subscription_expires_at: expiryDate.toISOString(),
        payment_reference: reference,
        payment_date: new Date().toISOString(),
        paystack_customer_code: paystackData.data.customer.customer_code,
      })
      .eq('id', userId);

    if (updateError) {
      console.error('[verify-payment] Error updating profile:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Failed to update user subscription',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      user_id: userId,
      amount: paystackData.data.amount / 100, // Convert kobo to naira
      currency: paystackData.data.currency,
      status: 'success',
      payment_method: 'paystack',
      paystack_reference: reference,
      paystack_customer_code: paystackData.data.customer.customer_code,
      tier,
      subscription_start: new Date().toISOString(),
      subscription_end: expiryDate.toISOString(),
      metadata: {
        channel: paystackData.data.channel,
        ip_address: paystackData.data.ip_address,
        fees: paystackData.data.fees,
        authorization: paystackData.data.authorization,
        gateway_response: paystackData.data.gateway_response,
      },
    });

    if (paymentError) {
      console.error('[verify-payment] Error inserting payment record:', paymentError);
      // Don't fail the request if payment record insertion fails
      // User subscription is already activated
    }

    console.log(`[verify-payment] Payment verified successfully for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified and subscription activated',
        data: {
          tier,
          expiresAt: expiryDate.toISOString(),
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[verify-payment] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
