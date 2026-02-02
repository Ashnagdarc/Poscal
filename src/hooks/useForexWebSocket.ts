import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ForexPrice {
  symbol: string;
  price: number;
  change: number;
  timestamp: number;
}

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useForexWebSocket(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const socket = io(`${BACKEND_URL}/forex`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      // Subscribe to symbol
      socket.emit('subscribe', symbol);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('price_update', (data: ForexPrice) => {
      setPrice(data.price);
      setChange(data.change);
      setLastUpdate(data.timestamp);
    });

    socket.on('error', (err: { message: string }) => {
      console.error('WebSocket error:', err);
      setError(err.message);
    });

    return () => {
      // Unsubscribe and disconnect
      if (socket.connected) {
        socket.emit('unsubscribe', symbol);
        socket.disconnect();
      }
    };
  }, [symbol]);

  return {
    price,
    change,
    lastUpdate,
    isConnected,
    error,
  };
}
