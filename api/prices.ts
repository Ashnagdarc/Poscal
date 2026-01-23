import { VercelRequest, VercelResponse } from '@vercel/node';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api.poscalfx.com:3001';

export const config = {
  maxDuration: 30,
};

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ error: 'symbols parameter required' });
    }

    const url = `${BACKEND_URL}/prices?symbols=${encodeURIComponent(String(symbols))}`;
    console.log(`[API] Fetching from backend: ${url}`);
    
    const backendRes = await Promise.race([
      fetch(url),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Backend timeout')), 8000)
      ),
    ]) as Response;
    
    if (!backendRes.ok) {
      console.error(`[API] Backend returned ${backendRes.status}`);
      return res.status(backendRes.status).json({ error: 'Backend error' });
    }
    
    const data = await backendRes.json();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=2');
    res.status(200).json(data);
  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
