import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import WebSocket from 'ws';

interface ForexPrice {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'https://poscalfx.com'],
    credentials: true,
  },
  namespace: 'forex',
})
export class ForexGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private binanceConnections = new Map<string, WebSocket>();
  private priceCache = new Map<string, ForexPrice>();
  private subscriberCount = new Map<string, number>();

  // Map frontend symbols to Binance symbols
  private symbolMap: Record<string, string> = {
    'EUR/USD': 'EURUSDT',
    'GBP/USD': 'GBPUSDT',
    'USD/JPY': 'USDTJPY',
    'AUD/USD': 'AUDUSDT',
    'USD/CAD': 'USDTCAD',
    'USD/CHF': 'USDTCHF',
    'NZD/USD': 'NZDUSDT',
    'EUR/GBP': 'EURGBP',
    'EUR/JPY': 'EURJPY',
    'GBP/JPY': 'GBPJPY',
  };

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, symbol: string) {
    const binanceSymbol = this.symbolMap[symbol];
    
    if (!binanceSymbol) {
      client.emit('error', { message: `Symbol ${symbol} not supported` });
      return;
    }

    // Send cached data immediately if available
    const cached = this.priceCache.get(symbol);
    if (cached) {
      client.emit('price_update', cached);
    }

    // Track subscribers
    const count = this.subscriberCount.get(symbol) || 0;
    this.subscriberCount.set(symbol, count + 1);

    // Only create ONE Binance connection per symbol (shared by all users)
    if (!this.binanceConnections.has(symbol)) {
      this.connectToBinance(symbol, binanceSymbol);
    }

    // Add client to room for this symbol
    client.join(symbol);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, symbol: string) {
    client.leave(symbol);

    const count = this.subscriberCount.get(symbol) || 0;
    const newCount = Math.max(0, count - 1);
    this.subscriberCount.set(symbol, newCount);

    // Close Binance connection if no more subscribers
    if (newCount === 0) {
      const ws = this.binanceConnections.get(symbol);
      if (ws) {
        ws.close();
        this.binanceConnections.delete(symbol);
      }
    }
  }

  private connectToBinance(symbol: string, binanceSymbol: string) {
    // Binance WebSocket Stream - 100% FREE, NO LIMITS
    const wsUrl = `wss://stream.binance.com:9443/ws/${binanceSymbol.toLowerCase()}@ticker`;
    
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log(`Connected to Binance for ${symbol}`);
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const ticker = JSON.parse(data.toString());
        
        // Binance ticker format:
        // { s: 'EURUSDT', c: '1.0850', P: '0.15', ... }
        const price = parseFloat(ticker.c); // Current price
        const changePercent = parseFloat(ticker.P); // 24h change %

        const forexPrice: ForexPrice = {
          symbol,
          price: this.convertToForexPrice(symbol, price),
          change: changePercent,
          timestamp: Date.now(),
        };

        // Cache the price
        this.priceCache.set(symbol, forexPrice);

        // Broadcast to ALL clients subscribed to this symbol
        // This is the magic: 1 API call → 10,000 users
        this.server.to(symbol).emit('price_update', forexPrice);
      } catch (error) {
        console.error(`Error parsing Binance data for ${symbol}:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`Binance WebSocket error for ${symbol}:`, error);
    });

    ws.on('close', () => {
      console.log(`Disconnected from Binance for ${symbol}`);
      this.binanceConnections.delete(symbol);
    });

    this.binanceConnections.set(symbol, ws);
  }

  private convertToForexPrice(symbol: string, binancePrice: number): number {
    // Since we're using USDT pairs (e.g., EURUSDT), we need to convert
    // For most cases, USDT ≈ USD, so the price is approximately correct
    // For inverted pairs (like USD/JPY from USDTJPY), we'd calculate: 1 / price
    
    if (symbol.startsWith('USD/')) {
      // Inverted pair (e.g., USD/JPY from JPYUSDT would be 1/price)
      // But Binance has USDTJPY directly, so just return the price
      return binancePrice;
    }
    
    // For EUR/USD, GBP/USD, etc., USDT price ≈ USD price
    return binancePrice;
  }
}
