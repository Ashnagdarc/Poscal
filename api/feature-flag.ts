import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Expected table schema (run this in Supabase SQL if table missing):
// CREATE TABLE public.app_settings (
//   key text primary key,
//   value jsonb,
//   updated_at timestamptz default now()
// );

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send('ok');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ success: false, message: 'Server not configured (missing env vars)' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('app_settings').select('key, value').eq('key', 'paid_lock_enabled').limit(1).maybeSingle();
      if (error) {
        console.error('[feature-flag] read error', error);
        return res.status(500).json({ success: false, message: 'Failed to read feature flag', details: error });
      }
      const value = data?.value?.enabled === true;
      return res.status(200).json({ success: true, key: 'paid_lock_enabled', enabled: !!value });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { enabled } = body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Missing or invalid `enabled` boolean in body' });
      }

      // Upsert into app_settings
      const payload = { key: 'paid_lock_enabled', value: { enabled } };
      const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'key' });
      if (error) {
        console.error('[feature-flag] upsert error', error);
        return res.status(500).json({ success: false, message: 'Failed to set feature flag', details: error });
      }
      return res.status(200).json({ success: true, key: 'paid_lock_enabled', enabled });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err: any) {
    console.error('[feature-flag] unexpected error', err);
    return res.status(500).json({ success: false, message: err?.message || String(err) });
  }
}
