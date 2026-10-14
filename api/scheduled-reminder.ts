import { listExpiringSubscriptionsHttp } from './_lib/paymentSyncClient.js';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const PAYMENT_SYNC_SECRET = process.env.PAYMENT_SYNC_SECRET;
const REMINDER_DAYS = 3;
const DEFAULT_EMAIL_FROM = 'Poscal <noreply@mail.poscalfx.com>';

// Vercel Scheduled Function entrypoint
export const config = {
  schedule: '0 4 * * *', // 4am UTC daily
};

function parseEmailSender(value: string): { email: string; name?: string } {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^['"]|['"]$/g, ''),
      email: match[2].trim().toLowerCase(),
    };
  }
  return { email: trimmed.toLowerCase() };
}

async function sendReminderEmail(to: string, name: string | null, expiresAt: string | null) {
  const subject = 'Your Poscal subscription is expiring soon';
  const shortName = name || 'there';
  const expiresText = expiresAt ? new Date(expiresAt).toUTCString() : 'soon';
  const text = `Hi ${shortName},\n\nYour Poscal subscription will expire on ${expiresText}.\n\nRenew at https://www.poscalfx.com/upgrade\n\nThanks — the Poscal team`;
  const html = `<p>Hi ${shortName},</p>
<p>Your Poscal subscription will expire on <strong>${expiresText}</strong>.</p>
<p>If you'd like to renew and keep access to Pro features, <a href="https://www.poscalfx.com/upgrade">upgrade now</a>.</p>
<p>Thanks — the Poscal team</p>`;

  if (!BREVO_API_KEY) {
    return { success: false, error: 'BREVO_API_KEY is not configured' };
  }

  const from = process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
  const sender = parseEmailSender(from);

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to.trim().toLowerCase() }],
        subject,
        textContent: text,
        htmlContent: html,
        tags: ['subscription-reminder'],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Brevo API returned error', resp.status, txt);
      return { success: false, error: `brevo_error_${resp.status}` };
    }

    const body = await resp.json();
    return { success: true, id: body.messageId || null };
  } catch (err: any) {
    console.error('Failed to send reminder via Brevo HTTP', err?.message || err);
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
  if (!BREVO_API_KEY && due.length > 0) {
    return res.status(503).json({
      success: false,
      message: 'BREVO_API_KEY is not configured; reminder emails were not sent',
      count: due.length,
    });
  }

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
