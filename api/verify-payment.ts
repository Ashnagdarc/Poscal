import { VercelRequest, VercelResponse } from '@vercel/node';
import { convexServerClient, api } from './_convex.js';

const PAYMENT_SYNC_SECRET = process.env.PAYMENT_SYNC_SECRET;

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!PAYMENT_SYNC_SECRET) {
    return res.status(500).json({ success: false, message: 'Payment sync secret not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const expiresAtMs = body.expiresAt ? new Date(body.expiresAt).getTime() : null;
    if (!body.userId || !body.reference || !body.tier || !body.amount || !body.currency) {
      return res.status(400).json({ success: false, message: 'Missing required payment fields' });
    }
    if (body.expiresAt && Number.isNaN(expiresAtMs)) {
      return res.status(400).json({ success: false, message: 'Invalid expiresAt value' });
    }

    await convexServerClient.mutation(api.admin.syncSubscriptionFromPayment, {
      secret: PAYMENT_SYNC_SECRET,
      userId: body.userId,
      reference: body.reference,
      tier: body.tier,
      amount: Number(body.amount) / 100,
      currency: body.currency,
      status: 'success',
      expiresAtMs,
      paidAtMs: Date.now(),
      metadata: {
        source: 'vercel-verify-payment',
        paystack_customer_code: body.paystack_customer_code ?? null,
        ...(body.metadata ?? {}),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated',
      data: {
        reference: body.reference,
        tier: body.tier,
        expiresAt: body.expiresAt ?? null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
