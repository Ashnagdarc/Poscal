import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REMINDER_DAYS = 3;

// Vercel Scheduled Function entrypoint
export const config = {
  schedule: '0 4 * * *', // 4am UTC daily
};

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendReminderEmail(to: string, name: string | null, expiresAt: string | null) {
  const subject = 'Your Poscal subscription is expiring soon';
  const shortName = name || 'there';
  const expiresText = expiresAt ? new Date(expiresAt).toUTCString() : 'soon';
  const html = `<p>Hi ${shortName},</p>
<p>Your Poscal subscription will expire on <strong>${expiresText}</strong>.</p>
<p>If you'd like to renew and keep access to Pro features, <a href="https://www.poscalfx.com/upgrade">upgrade now</a>.</p>
<p>Thanks — the Poscal team</p>`;

  if (!resend) {
    console.log(`[REMINDER][DRY-RUN] to=${to} subject=${subject}`);
    return { success: true, dryRun: true };
  }

  const from = process.env.EMAIL_FROM || 'no-reply@poscalfx.com';

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    return { success: true, id: result.id };
  } catch (err: any) {
    console.error('Failed to send reminder via Resend', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

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

  // 2. Send reminder emails via Resend (if configured)
  const results: Array<any> = [];
  for (const user of expiring || []) {
    if (!user.email) {
      results.push({ id: user.id, success: false, error: 'missing email' });
      continue;
    }
    const r = await sendReminderEmail(user.email, user.full_name || null, user.subscription_expires_at || null);
    results.push({ id: user.id, email: user.email, ...r });
  }

  return res.status(200).json({ success: true, count: (expiring || []).length, results });
}
