import crypto from 'crypto';
import { convexServerClient, api } from './_convex.js';

const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET;
const PAYMENT_SYNC_SECRET = process.env.PAYMENT_SYNC_SECRET;

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

  if (!PAYSTACK_WEBHOOK_SECRET || !PAYMENT_SYNC_SECRET) {
    const missing = [
      !PAYSTACK_WEBHOOK_SECRET ? 'PAYSTACK_WEBHOOK_SECRET' : null,
      !PAYMENT_SYNC_SECRET ? 'PAYMENT_SYNC_SECRET' : null,
    ].filter(Boolean);

    return res.status(500).json({
      error: 'Server not configured (missing env vars)',
      missing,
    });
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

    if (event?.event === 'charge.success' && event?.data?.status === 'success') {
      const refParts = (event?.data?.reference || '').split('_');
      const userId = refParts[1];
      const tier = refParts[2];

      if (!userId || !tier) {
        return res.status(400).json({ error: 'Invalid reference format' });
      }

      const paidAt = Date.now();
      const expiryDate = new Date(paidAt);
      if (tier === 'yearly' || tier === 'pro') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      } else if (tier === 'lifetime') {
        expiryDate.setFullYear(expiryDate.getFullYear() + 100);
      } else {
        expiryDate.setMonth(expiryDate.getMonth() + 1);
      }

      await convexServerClient.mutation(api.admin.syncSubscriptionFromPayment, {
        secret: PAYMENT_SYNC_SECRET,
        userId,
        reference: event?.data?.reference,
        tier,
        amount: Number(event?.data?.amount || 0) / 100,
        currency: event?.data?.currency || 'NGN',
        status: 'success',
        expiresAtMs: expiryDate.getTime(),
        paidAtMs: paidAt,
        metadata: {
          source: 'paystack-webhook',
          channel: event?.data?.channel,
          ip_address: event?.data?.ip_address,
          fees: event?.data?.fees || 0,
          customer_code: event?.data?.customer?.customer_code || null,
          authorization: event?.data?.authorization,
          gateway_response: event?.data?.gateway_response,
          webhook_event: event?.event,
        },
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[paystack-webhook] unexpected error', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
