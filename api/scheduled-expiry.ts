import { convexServerClient, api } from './_convex.js';

const PAYMENT_SYNC_SECRET = process.env.PAYMENT_SYNC_SECRET;

// Vercel Scheduled Function entrypoint
export const config = {
  schedule: '0 3 * * *', // 3am UTC daily
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  if (!PAYMENT_SYNC_SECRET) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing PAYMENT_SYNC_SECRET)' });
  }
  const result = await convexServerClient.mutation(api.admin.expireSubscriptionsBefore, {
    secret: PAYMENT_SYNC_SECRET,
    beforeMs: Date.now(),
  });

  return res.status(200).json({ success: true, message: 'Expired old subscriptions', ...result });
}
