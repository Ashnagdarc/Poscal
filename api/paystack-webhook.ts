import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const config = {
  api: {
    bodyParser: false,
  },
};

function buffer(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PAYSTACK_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server not configured (missing env vars)' });
  }

  try {
    const rawBody = await buffer(req);
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const computed = crypto.createHmac('sha512', PAYSTACK_WEBHOOK_SECRET).update(rawBody).digest('hex');
    if (computed !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));

    // Initialize Supabase admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Log webhook event (best effort)
    await supabase.from('paystack_webhook_logs').insert({
      event_type: event?.event,
      reference: event?.data?.reference,
      status: event?.data?.status,
      payload: event,
    });

    if (event?.event === 'charge.success' && event?.data?.status === 'success') {
      // Reference format: poscal_{userId}_{tier}_{timestamp}
      const refParts = (event?.data?.reference || '').split('_');
      const userId = refParts[1];
      const tier = refParts[2];

      if (!userId || !tier) {
        return res.status(400).json({ error: 'Invalid reference format' });
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          payment_status: 'paid',
          subscription_tier: tier,
          subscription_expires_at: expiryDate.toISOString(),
          payment_reference: event?.data?.reference,
          payment_date: new Date().toISOString(),
          paystack_customer_code: event?.data?.customer?.customer_code,
        })
        .eq('id', userId);

      if (updateError) {
        return res.status(500).json({ error: 'Database update failed' });
      }

      const { error: paymentError } = await supabase.from('payments').insert({
        user_id: userId,
        amount: (event?.data?.amount || 0) / 100,
        currency: event?.data?.currency || 'NGN',
        status: 'success',
        payment_method: 'paystack',
        paystack_reference: event?.data?.reference,
        paystack_customer_code: event?.data?.customer?.customer_code,
        tier,
        subscription_start: new Date().toISOString(),
        subscription_end: expiryDate.toISOString(),
        metadata: {
          channel: event?.data?.channel,
          ip_address: event?.data?.ip_address,
          fees: event?.data?.fees || 0,
          authorization: event?.data?.authorization,
          gateway_response: event?.data?.gateway_response,
          webhook_event: event?.event,
        },
      });

      if (paymentError) {
        console.error('[paystack-webhook] payment insert error', paymentError);
        // Do not fail response since subscription already updated
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[paystack-webhook] unexpected error', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
