const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BACKEND_URL = process.env.VITE_API_URL || 'https://api.poscalfx.com';
const BACKEND_SERVICE_TOKEN = process.env.BACKEND_SERVICE_TOKEN;

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

  if (!PAYSTACK_SECRET_KEY || !BACKEND_URL) {
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

    // Calculate subscription expiry (30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // Call backend to update subscription
    const backendHeaders: any = {
      'Content-Type': 'application/json',
    };

    if (BACKEND_SERVICE_TOKEN) {
      backendHeaders['Authorization'] = `Bearer ${BACKEND_SERVICE_TOKEN}`;
    }

    const updateResponse = await fetch(`${BACKEND_URL}/payments/verify`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify({
        userId,
        reference,
        tier,
        amount: (paystackData?.data?.amount || 0) / 100, // kobo to naira
        currency: paystackData?.data?.currency || 'NGN',
        paystack_customer_code: paystackData?.data?.customer?.customer_code,
        expiresAt: expiryDate.toISOString(),
        metadata: {
          channel: paystackData?.data?.channel,
          ip_address: paystackData?.data?.ip_address,
          fees: paystackData?.data?.fees,
          authorization: paystackData?.data?.authorization,
          gateway_response: paystackData?.data?.gateway_response,
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('[verify-payment] backend error', errorData);
      return res.status(updateResponse.status).json({ 
        success: false, 
        message: 'Failed to update subscription',
        details: errorData 
      });
    }

    const updateData = await updateResponse.json();
    console.log('[verify-payment] subscription updated', { userId, tier });

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
