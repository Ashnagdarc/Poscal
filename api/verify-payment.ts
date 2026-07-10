import { VercelRequest, VercelResponse } from '@vercel/node';
import { ConvexHttpClient } from 'convex/browser';
import { api as convexApi } from '../convex/_generated/api';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api.poscalfx.com';
const BACKEND_SERVICE_TOKEN = process.env.BACKEND_SERVICE_TOKEN;
const CONVEX_URL = process.env.CONVEX_URL;
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

  if (!BACKEND_URL) {
    return res.status(500).json({ success: false, message: 'Backend URL not configured' });
  }

  if (!BACKEND_SERVICE_TOKEN) {
    return res.status(500).json({ success: false, message: 'Backend service token not configured' });
  }

  if (!CONVEX_URL || !PAYMENT_SYNC_SECRET) {
    return res.status(500).json({ success: false, message: 'Convex payment sync is not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    const response = await fetch(`${BACKEND_URL}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BACKEND_SERVICE_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let data: any = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText || 'Unexpected backend response' };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data?.message || 'Failed to verify payment',
        details: data,
      });
    }

    const expiresAtRaw = body?.expiresAt || data?.data?.expiry || data?.expiry || null;
    const expiresAtMs = expiresAtRaw ? new Date(expiresAtRaw).getTime() : null;
    const paidAtMs = Date.now();

    const convex = new ConvexHttpClient(CONVEX_URL);
    await convex.mutation(convexApi.admin.syncSubscriptionFromPayment, {
      secret: PAYMENT_SYNC_SECRET,
      userId: body.userId,
      reference: body.reference,
      tier: body.tier || data?.data?.tier || 'premium',
      amount: Number(body.amount || 0),
      currency: body.currency || 'NGN',
      status: 'success',
      expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
      paidAtMs,
      metadata: body.metadata || data || null,
    });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
