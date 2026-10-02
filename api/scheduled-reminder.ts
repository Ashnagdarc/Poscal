import { listExpiringSubscriptionsHttp } from './_lib/paymentSyncClient.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const PAYMENT_SYNC_SECRET = process.env.PAYMENT_SYNC_SECRET;
const REMINDER_DAYS = 3;

// Vercel Scheduled Function entrypoint
export const config = {
  schedule: '0 4 * * *', // 4am UTC daily
};

async function sendReminderEmail(to: string, name: string | null, expiresAt: string | null) {
  const subject = 'Your Poscal subscription is expiring soon';
  const shortName = name || 'there';
  const expiresText = expiresAt ? new Date(expiresAt).toUTCString() : 'soon';
  const html = `<p>Hi ${shortName},</p>
<p>Your Poscal subscription will expire on <strong>${expiresText}</strong>.</p>
<p>If you'd like to renew and keep access to Pro features, <a href="https://www.poscalfx.com/upgrade">upgrade now</a>.</p>
<p>Thanks — the Poscal team</p>`;

  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY is not configured' };
  }

  const from = process.env.EMAIL_FROM || 'Poscal <noreply@poscalfx.com>';

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Resend API returned error', resp.status, txt);
      return { success: false, error: `resend_error_${resp.status}` };
    }

    const body = await resp.json();
    return { success: true, id: body.id || null };
  } catch (err: any) {
    console.error('Failed to send reminder via Resend HTTP', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

export default async function handler(req: any, res: any) {
  // Vercel Cron invokes GET; allow POST for manual ops.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  if (!PAYMENT_SYNC_SECRET) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing PAYMENT_SYNC_SECRET)' });
  }
  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000);

  let expiring;
  try {
    expiring = await listExpiringSubscriptionsHttp(now.getTime(), soon.getTime());
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list expiring subscriptions',
    });
  }

  const due = expiring || [];
  if (!RESEND_API_KEY && due.length > 0) {
    return res.status(503).json({
      success: false,
      message: 'RESEND_API_KEY is not configured; reminder emails were not sent',
      count: due.length,
    });
  }

  // 2. Send reminder emails via Resend (if configured)
  const results: Array<any> = [];
  for (const user of due) {
    if (!user.email) {
      results.push({ id: user.userId, success: false, error: 'missing email' });
      continue;
    }
    const r = await sendReminderEmail(
      user.email,
      user.fullName || null,
      user.subscriptionExpiresAtMs ? new Date(user.subscriptionExpiresAtMs).toISOString() : null,
    );
    results.push({ id: user.userId, email: user.email, ...r });
  }

  const failed = results.some((result) => result.success === false);
  return res.status(failed ? 502 : 200).json({
    success: !failed,
    count: due.length,
    results,
  });
}
