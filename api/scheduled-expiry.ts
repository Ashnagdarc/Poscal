import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Vercel Scheduled Function entrypoint
export const config = {
  schedule: '0 3 * * *', // 3am UTC daily
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing env vars)' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  // 1. Expire subscriptions
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ payment_status: 'free', subscription_tier: null })
    .lt('subscription_expires_at', now)
    .neq('payment_status', 'free');

  if (updateError) {
    return res.status(500).json({ success: false, message: 'Failed to expire subscriptions', details: updateError.message });
  }

  return res.status(200).json({ success: true, message: 'Expired old subscriptions' });
}
