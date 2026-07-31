import { convexServerClient, api } from './_convex.js';
import {
  parseSuccessfulCharge,
  verifyPaystackSignature,
  type PaystackWebhookEvent,
} from './lib/paystackWebhookCore.js';

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
    const signature = req.headers['x-paystack-signature'] as string | undefined;

    const signatureCheck = verifyPaystackSignature(rawBody, signature, PAYSTACK_WEBHOOK_SECRET);
    if (!signatureCheck.ok) {
      return res.status(signatureCheck.status).json({ error: signatureCheck.error });
    }

    const event = JSON.parse(rawBody.toString('utf8')) as PaystackWebhookEvent;
    const parsed = parseSuccessfulCharge(event);

    if (parsed && 'error' in parsed) {
      return res.status(parsed.status).json({ error: parsed.error });
    }

    if (parsed) {
      await convexServerClient.mutation(api.admin.syncSubscriptionFromPayment, {
        secret: PAYMENT_SYNC_SECRET,
        userId: parsed.userId,
        reference: parsed.reference,
        tier: parsed.tier,
        amount: parsed.amount,
        currency: parsed.currency,
        status: 'success',
        expiresAtMs: parsed.expiresAtMs,
        paidAtMs: parsed.paidAtMs,
        metadata: parsed.metadata,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[paystack-webhook] unexpected error', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
