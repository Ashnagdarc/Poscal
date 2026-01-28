const BACKEND_URL = process.env.VITE_API_URL || 'https://api.poscalfx.com';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('ok');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Return empty stats for now - this feature requires Supabase direct access
    // which isn't available in serverless functions
    return res.status(200).json({
      success: true,
      data: {
        range: { startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString(), endDate: new Date().toISOString() },
        totals: {
          totalRevenue: 0,
          paidUsersCount: 0,
          freeUsersCount: 0,
          totalUsersCount: 0,
        },
        monthlyBreakdown: {},
        recentPayments: [],
        pagination: {
          page: 1,
          pageSize: 25,
          total: 0,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
}
