import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REMINDER_DAYS = 3;

// Vercel Scheduled Function entrypoint
export const config = {
  schedule: '0 4 * * *', // 4am UTC daily
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing env vars)' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000);

  // 1. Find users expiring soon
  const { data: expiring, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, subscription_expires_at')
    .eq('payment_status', 'paid')
    .gte('subscription_expires_at', now.toISOString())
    .lte('subscription_expires_at', soon.toISOString());

  if (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch expiring users', details: error.message });
  }

  // 2. Send reminder emails (pseudo, replace with real email API)
  for (const user of expiring || []) {
    // TODO: Integrate with your transactional email API (e.g., Resend, SendGrid, Mailgun, Supabase SMTP)
    // Example: await sendEmail(user.email, ...)
    console.log(`Would send reminder to ${user.email} (expires ${user.subscription_expires_at})`);
  }

  return res.status(200).json({ success: true, count: (expiring || []).length });
}
