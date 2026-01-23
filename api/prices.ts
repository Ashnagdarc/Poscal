import { VercelRequest, VercelResponse } from '@vercel/node';

const BACKEND_URL = 'http://62.171.136.178:3001';

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const { symbols } = req.query;
    const url = `${BACKEND_URL}/prices?symbols=${encodeURIComponent(String(symbols))}`;
    
    const backendRes = await fetch(url);
    const data = await backendRes.json();
    
    res.setHeader('Content-Type', 'application/json');
    res.status(backendRes.status).json(data);
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
};
