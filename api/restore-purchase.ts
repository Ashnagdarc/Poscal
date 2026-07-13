import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send('ok');
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  if (!CONVEX_URL) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing CONVEX_URL)' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId } = body;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    const authorization = req.headers.authorization as string | undefined;
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing auth token' });
    }

    const client = new ConvexHttpClient(CONVEX_URL);
    client.setAuth(token);
    const result = await client.mutation(api.admin.restoreLatestPaymentForUser, { userId });
    return res.status(result?.success ? 200 : 404).json(result);
  } catch (err: any) {
    console.error('[restore-purchase] unexpected error', err);
    return res.status(500).json({ success: false, message: err?.message || String(err) });
  }
}
