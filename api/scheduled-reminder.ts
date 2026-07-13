import { convexServerClient, api } from './_convex.js';

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
    console.log(`[REMINDER][DRY-RUN] to=${to} subject=${subject}`);
    return { success: true, dryRun: true };
  }

  const from = process.env.EMAIL_FROM || 'no-reply@poscalfx.com';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  if (!PAYMENT_SYNC_SECRET) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing PAYMENT_SYNC_SECRET)' });
  }
  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000);

  const expiring = await convexServerClient.mutation(api.admin.listExpiringSubscriptions, {
    secret: PAYMENT_SYNC_SECRET,
    fromMs: now.getTime(),
    toMs: soon.getTime(),
  });

  // 2. Send reminder emails via Resend (if configured)
  const results: Array<any> = [];
  for (const user of expiring || []) {
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

  return res.status(200).json({ success: true, count: (expiring || []).length, results });
}
