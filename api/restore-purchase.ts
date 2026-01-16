import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send('ok');
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing env vars)' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId } = body;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find latest successful payment for this user
    const { data: payment, error: paymentErr } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'success')
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentErr) {
      console.error('[restore-purchase] payment lookup error', paymentErr);
      return res.status(500).json({ success: false, message: 'Failed to lookup payments', details: paymentErr });
    }

    if (!payment) {
      return res.status(404).json({ success: false, message: 'No successful purchases found for this account' });
    }

    // Determine expiry from payment record if available
    let expiry = payment.subscription_end || payment.paid_at || null;
    if (expiry) {
      // ensure ISO string
      expiry = new Date(expiry).toISOString();
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      expiry = d.toISOString();
    }

    const tier = payment.subscription_tier || payment.tier || 'premium';

    // Update profile
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        payment_status: 'paid',
        subscription_tier: tier,
        subscription_expires_at: expiry,
        payment_reference: payment.paystack_reference || payment.reference || null,
        payment_date: payment.paid_at || new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateErr) {
      console.error('[restore-purchase] profile update error', updateErr);
      return res.status(500).json({ success: false, message: 'Failed to update profile', details: updateErr });
    }

    return res.status(200).json({ success: true, message: 'Purchase restored', data: { tier, expiry } });
  } catch (err: any) {
    console.error('[restore-purchase] unexpected error', err);
    return res.status(500).json({ success: false, message: err?.message || String(err) });
  }
}
