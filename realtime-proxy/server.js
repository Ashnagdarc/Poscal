// Realtime proxy server for price updates
// - Subscribes once to Supabase Realtime for `price_cache` updates
// - Broadcasts updates to connected WebSocket clients
// - Supports optional simple token auth (PROXY_AUTH_TOKEN) and per-client symbol subscriptions

const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'your-anon-key';
const PORT = parseInt(process.env.PORT || '8080', 10);
const PROXY_AUTH_TOKEN = process.env.PROXY_AUTH_TOKEN || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory store of latest prices
const latestPrices = {};

// Track client subscriptions: Map<WebSocket, Set<string>>
const clientSubs = new Map();

// Create a simple HTTP server for health checks and optional metrics
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // default: no subscriptions -> receive all updates
  clientSubs.set(ws, null);

  // send initial snapshot
  try {
    ws.send(JSON.stringify({ type: 'init', prices: latestPrices }));
  } catch (err) {
    // ignore
  }

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data && data.type === 'auth' && PROXY_AUTH_TOKEN) {
        if (data.token === PROXY_AUTH_TOKEN) {
          ws._authed = true;
          ws.send(JSON.stringify({ type: 'auth', ok: true }));
        } else {
          ws.send(JSON.stringify({ type: 'auth', ok: false }));
          ws.close(4003, 'invalid_token');
        }
        return;
      }

      // subscribe message: { type: 'subscribe', symbols: ['EUR/USD','BTC/USD'] }
      if (data && data.type === 'subscribe' && Array.isArray(data.symbols)) {
        clientSubs.set(ws, new Set(data.symbols.map(String)));
        ws.send(JSON.stringify({ type: 'subscribed', symbols: Array.from(clientSubs.get(ws)) }));
        return;
      }

      // unsubscribe
      if (data && data.type === 'unsubscribe') {
        clientSubs.set(ws, null);
        ws.send(JSON.stringify({ type: 'subscribed', symbols: null }));
        return;
      }
    } catch (err) {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    clientSubs.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Realtime proxy listening on http://0.0.0.0:${PORT}`);
});

// Subscribe to Supabase Realtime price_cache updates
const channel = supabase.channel('price_cache_updates')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'price_cache' }, (payload) => {
    const { symbol, mid_price, ask_price, bid_price, timestamp } = payload.new || {};
    if (!symbol) return;

    latestPrices[symbol] = { mid_price, ask_price, bid_price, timestamp };

    const update = JSON.stringify({ type: 'update', symbol, mid_price, ask_price, bid_price, timestamp });

    // Broadcast only to clients subscribed to this symbol; if client has null subscription -> receive all
    wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) return;
      const subs = clientSubs.get(client);
      if (subs === null || (subs && subs.has(symbol))) {
        try {
          client.send(update);
        } catch (err) {
          // ignore send errors
        }
      }
    });
  });

channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') console.log('Subscribed to Supabase price_cache updates');
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down proxy...');
  try { channel.unsubscribe(); } catch (e) {}
  try { wss.close(); } catch (e) {}
  try { server.close(() => process.exit(0)); } catch (e) { process.exit(0); }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
