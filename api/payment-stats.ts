const BACKEND_URL = process.env.VITE_API_URL || 'https://api.poscalfx.com';
const BACKEND_SERVICE_TOKEN = process.env.BACKEND_SERVICE_TOKEN;

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

  if (!BACKEND_URL) {
    return res.status(500).json({ success: false, message: 'Backend not configured' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    const statusParam = (url.searchParams.get('status') || 'success').toLowerCase();
    const tierParam = url.searchParams.get('tier');
    const sortByParam = (url.searchParams.get('sortBy') || 'created_at').toLowerCase();
    const sortDirParam = (url.searchParams.get('sortDir') || 'desc').toLowerCase();
    const pageParam = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSizeParam = parseInt(url.searchParams.get('pageSize') || '25', 10);

    const page = Math.max(1, pageParam);
    const pageSize = Math.min(100, Math.max(1, pageSizeParam));
    const offset = (page - 1) * pageSize;

    const sortBy = ['created_at', 'amount', 'status'].includes(sortByParam) ? sortByParam : 'created_at';
    const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc';

    const now = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 30);

    const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
    const endDate = endDateParam ? new Date(endDateParam) : now;

    const buildPaymentsQuery = () => {
      let query = supabase
        .from('payments')
        .select('id, user_id, amount, currency, status, tier, paystack_reference, created_at, subscription_start, subscription_end', { count: 'exact' })
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (statusParam !== 'all') {
        query = query.eq('status', statusParam);
      }

      if (tierParam && tierParam !== 'all') {
        query = query.eq('tier', tierParam);
      }

      return query;
    };

    // Paged payments
    const { data: payments, error: paymentsError, count: totalPayments } = await buildPaymentsQuery()
      .order(sortBy, { ascending: sortDir === 'asc' })
      .range(offset, offset + pageSize - 1);

    if (paymentsError) {
      return res.status(500).json({ success: false, message: 'Failed to fetch payments', details: paymentsError.message });
    }

    // Aggregate metrics using a larger sample (not paged)
    const { data: paymentsForStats, error: statsError } = await buildPaymentsQuery()
      .order('created_at', { ascending: false })
      .limit(1000);

    if (statsError) {
      return res.status(500).json({ success: false, message: 'Failed to build stats', details: statsError.message });
    }

    const paymentsForAgg = paymentsForStats || [];

    const totalRevenue = paymentsForAgg.reduce((sum, p: any) => sum + (p.amount || 0), 0);

    // Monthly breakdown for last 12 months
    const monthlyBreakdown: Record<string, number> = {};
    const monthsBack = 12;
    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyBreakdown[key] = 0;
    }
    paymentsForAgg.forEach((p: any) => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthlyBreakdown) monthlyBreakdown[key] += (p.amount || 0);
    });

    // Join profile context
    const userIds = Array.from(new Set((payments || []).map((p: any) => p.user_id).filter(Boolean)));
    let profileMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: profiles, error: profilesLookupError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesLookupError) {
        return res.status(500).json({ success: false, message: 'Failed to fetch profiles', details: profilesLookupError.message });
      }

      profileMap = (profiles || []).reduce((acc: Record<string, any>, p: any) => {
        acc[p.id] = { email: p.email, full_name: p.full_name };
        return acc;
      }, {});
    }

    // Fetch user counts
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, payment_status, subscription_expires_at');

    if (profilesError) {
      return res.status(500).json({ success: false, message: 'Failed to fetch profiles', details: profilesError.message });
    }

    const paidUsersCount = (profiles || []).filter((p: any) => {
      const status = (p.payment_status || '').toLowerCase();
      const expiresAt = p.subscription_expires_at ? new Date(p.subscription_expires_at) : null;
      return status === 'paid' && expiresAt && expiresAt > now;
    }).length;

    const totalUsersCount = (profiles || []).length;
    const freeUsersCount = Math.max(0, totalUsersCount - paidUsersCount);

    // Recent payments (paged) with profile context
    const recentPayments = (payments || []).map((p: any) => ({
      ...p,
      profile: profileMap[p.user_id] || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        range: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
        totals: {
          totalRevenue,
          paidUsersCount,
          freeUsersCount,
          totalUsersCount,
        },
        monthlyBreakdown,
        recentPayments,
        pagination: {
          page,
          pageSize,
          total: totalPayments || 0,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
}
