import { VercelRequest, VercelResponse } from '@vercel/node';
import { convexServerClient, api } from './_convex.js';

export const config = {
  maxDuration: 30,
};

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ error: 'symbols parameter required' });
    }

    const data = await convexServerClient.query(api.prices.listLatest, {
      symbols: String(symbols).split(',').map((symbol) => symbol.trim()).filter(Boolean),
    });
    
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
