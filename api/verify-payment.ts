import { createClient } from '@supabase/supabase-js';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
  // Basic CORS support for local testing / cross-origin usage
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing env vars)' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { reference, userId, tier } = body;

    if (!reference || !userId || !tier) {
      return res.status(400).json({ success: false, message: 'Missing reference, userId, or tier' });
    }

    // Verify with Paystack
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!verifyResponse.ok) {
      return res.status(502).json({ success: false, message: 'Failed to verify payment with Paystack' });
    }

    const paystackData = await verifyResponse.json();

    if (!paystackData?.status || paystackData?.data?.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: `Payment status: ${paystackData?.data?.status || 'unknown'}`,
      });
    }

    // Initialize Supabase admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Calculate subscription expiry (30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        payment_status: 'paid',
        subscription_tier: tier,
        subscription_expires_at: expiryDate.toISOString(),
        payment_reference: reference,
        payment_date: new Date().toISOString(),
        paystack_customer_code: paystackData?.data?.customer?.customer_code,
      })
      .eq('id', userId);

    if (updateError) {
      return res.status(500).json({ success: false, message: 'Failed to update user subscription' });
    }

    // Insert payment record (best-effort)
    const { error: paymentError } = await supabase.from('payments').insert({
      user_id: userId,
      amount: (paystackData?.data?.amount || 0) / 100, // kobo to naira
      currency: paystackData?.data?.currency || 'NGN',
      status: 'success',
      payment_method: 'paystack',
      paystack_reference: reference,
      paystack_customer_code: paystackData?.data?.customer?.customer_code,
      tier,
      subscription_start: new Date().toISOString(),
      subscription_end: expiryDate.toISOString(),
      metadata: {
        channel: paystackData?.data?.channel,
        ip_address: paystackData?.data?.ip_address,
        fees: paystackData?.data?.fees,
        authorization: paystackData?.data?.authorization,
        gateway_response: paystackData?.data?.gateway_response,
      },
    });

    if (paymentError) {
      console.error('[verify-payment] payment insert error', paymentError);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        tier,
        expiresAt: expiryDate.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[verify-payment] unexpected error', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
}
