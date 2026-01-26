// Proxy to Contabo backend for feature flags
const BACKEND_URL = process.env.VITE_API_URL || 'https://api.poscalfx.com';
const BACKEND_TOKEN = process.env.BACKEND_SERVICE_TOKEN;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).send('ok');

  if (!BACKEND_URL) {
    return res.status(500).json({ success: false, message: 'Backend URL not configured' });
  }

  try {
    const headers: any = {
      'Content-Type': 'application/json',
    };

    // Add service token if available
    if (BACKEND_TOKEN) {
      headers['Authorization'] = `Bearer ${BACKEND_TOKEN}`;
    }

    if (req.method === 'GET') {
      // Forward GET request to backend
      const response = await fetch(`${BACKEND_URL}/admin/feature-flag`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('[feature-flag] backend error', response.status);
        return res.status(response.status).json({ success: false, message: 'Failed to read feature flag' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { enabled } = body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Missing or invalid `enabled` boolean in body' });
      }

      // Forward POST request to backend
      const response = await fetch(`${BACKEND_URL}/admin/feature-flag`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        console.error('[feature-flag] backend error', response.status);
        return res.status(response.status).json({ success: false, message: 'Failed to set feature flag' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err: any) {
    console.error('[feature-flag] unexpected error', err);
    return res.status(500).json({ success: false, message: err?.message || String(err) });
  }
}
