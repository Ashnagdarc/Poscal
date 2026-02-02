import { useEffect, useRef, useState } from 'react';
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  HistogramSeries
} from 'lightweight-charts';
import { TrendingUp, BarChart3, Activity, LineChart, AreaChart } from 'lucide-react';
import { useForexWebSocket } from '../hooks/useForexWebSocket';

type ChartType = 'candlestick' | 'line' | 'area' | 'bar';
type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
type Range = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// API Configuration
const ALPHA_VANTAGE_KEY = '7JNQSHEV4YIH1PG5'; // Replace with your API key from https://www.alphavantage.co/support/#api-key
const FINNHUB_KEY = 'demo'; // Alternative: Get free key from https://finnhub.io/

// Comprehensive list of forex pairs
const PAIRS = [
  // Major Pairs
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  // Minor Pairs (Cross Currency Pairs)
  'EUR/GBP', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/JPY', 'EUR/NZD',
  'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
  'AUD/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD',
  'CAD/JPY', 'CAD/CHF',
  'CHF/JPY',
  'NZD/JPY', 'NZD/CAD', 'NZD/CHF',
  // Exotic Pairs
  'USD/SGD', 'USD/HKD', 'USD/ZAR', 'USD/THB', 'USD/MXN', 'USD/TRY',
  'EUR/TRY', 'EUR/NOK', 'EUR/SEK', 'EUR/PLN',
  'GBP/SGD', 'GBP/ZAR',
];

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
const RANGES: Range[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];

interface TradingChartProps {
  symbol?: string;
}

export const TradingChart = ({ symbol: initialSymbol = 'EUR/USD' }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const dataRef = useRef<any[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [symbol, setSymbol] = useState(initialSymbol);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [range, setRange] = useState<Range>('1M');
  const [showIndicators, setShowIndicators] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use WebSocket for live prices (handles 10K users, 100% free, no limits!)
  const { 
    price: livePrice, 
    change: liveChange, 
    lastUpdate: wsLastUpdate,
    isConnected,
    error: wsError 
  } = useForexWebSocket(symbol);

  // Update current price from WebSocket
  useEffect(() => {
    if (livePrice !== null) {
      setCurrentPrice(livePrice);
      setPriceChange(liveChange);
      setLastUpdate(new Date(wsLastUpdate));
      
      // Update chart with live price
      if (seriesRef.current && dataRef.current.length > 0) {
        const lastCandle = dataRef.current[dataRef.current.length - 1];
        const today = new Date().toISOString().split('T')[0];
        
        if (lastCandle.time === today) {
          // Update today's candle
          lastCandle.close = livePrice;
          lastCandle.high = Math.max(lastCandle.high, livePrice);
          lastCandle.low = Math.min(lastCandle.low, livePrice);
          seriesRef.current.update(lastCandle);
        } else {
          // Create new candle for today
          const newCandle = {
            time: today,
            open: livePrice,
            high: livePrice,
            low: livePrice,
            close: livePrice,
          };
          dataRef.current.push(newCandle);
          seriesRef.current.update(newCandle);
        }
      }
    }
  }, [livePrice, liveChange, wsLastUpdate]);

  // Convert symbol format for APIs (EUR/USD -> EURUSD)
  const getApiSymbol = (pair: string) => pair.replace('/', '');

  // Fetch historical candlestick data (only needed once on load)
  const fetchHistoricalData = async (pair: string, interval: string, days: number) => {
    try {
      const apiSymbol = getApiSymbol(pair);
      const endDate = Math.floor(Date.now() / 1000);
      const startDate = endDate - (days * 24 * 60 * 60);
      
      // Using Finnhub for OHLC data
      const response = await fetch(
        `https://finnhub.io/api/v1/forex/candle?symbol=OANDA:${apiSymbol}&resolution=D&from=${startDate}&to=${endDate}&token=${FINNHUB_KEY}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch historical data');
      
      const data = await response.json();
      
      if (data.s !== 'ok') {
        throw new Error('No data available for this pair');
      }
      
      // Convert to lightweight-charts format
      const formattedData = data.t.map((timestamp: number, i: number) => ({
        time: new Date(timestamp * 1000).toISOString().split('T')[0],
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        value: data.c[i],
      }));
      
      return formattedData;
    } catch (err) {
      console.error('Error fetching historical data:', err);
      throw err;
    }
  };

  // Load initial data
  const loadChartData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const days = range === '1D' ? 1 : range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : range === '6M' ? 180 : range === '1Y' ? 365 : 365;
      
      const historicalData = await fetchHistoricalData(symbol, timeframe, days);
      
      if (historicalData && historicalData.length > 0) {
        dataRef.current = historicalData;
        // Price will be updated by WebSocket
      }
      
      setIsLoading(false);
    } catch (err: any) {
      console.error('Failed to load chart data:', err);
      setError(err.message || 'Failed to load data');
      setIsLoading(false);
    }
  };

  // Load data when symbol, range, or timeframe changes
  useEffect(() => {
    loadChartData();
  }, [symbol, range, timeframe]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#9ca3af',
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      timeScale: {
        timeVisible: true,
        borderColor: '#334155',
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
    });

    chartRef.current = chart;

    // Only set data if we have it
    if (dataRef.current.length === 0 || isLoading) {
      return;
    }

    const data = dataRef.current;

    // Add series based on chart type
    let series: ISeriesApi<any>;

    if (chartType === 'candlestick') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
      series.setData(data);
    } else if (chartType === 'line') {
      series = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
      });
      series.setData(data.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === 'area') {
      series = chart.addSeries(AreaSeries, {
        topColor: 'rgba(59, 130, 246, 0.4)',
        bottomColor: 'rgba(59, 130, 246, 0.0)',
        lineColor: '#3b82f6',
        lineWidth: 2,
      });
      series.setData(data.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === 'bar') {
      series = chart.addSeries(BarSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
      });
      series.setData(data);
    }

    seriesRef.current = series;

    // Add moving average indicator if enabled
    if (showIndicators && data.length > 20) {
      const ma20 = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
      });
      
      const maData = data.map((d, i) => {
        if (i < 20) return { time: d.time, value: d.close };
        const sum = data.slice(i - 19, i + 1).reduce((acc, item) => acc + item.close, 0);
        return { time: d.time, value: sum / 20 };
      });
      ma20.setData(maData);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartType, showIndicators, dataRef.current, isLoading]);

  return (
    <div className="w-full space-y-4">
      {/* Modern Header with Live Price Info */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="px-4 py-2 text-lg font-semibold bg-background/50 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 hover:bg-background transition-colors cursor-pointer"
          >
            {PAIRS.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
          
          {/* Live Price Display */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {currentPrice.toFixed(5)}
              </span>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
                priceChange >= 0 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{timeframe.toUpperCase()}</span>
              <span>•</span>
              {isConnected ? (
                <>
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live WebSocket connected"></span>
                  <span className="text-emerald-400">Live - Updated {Math.floor((new Date().getTime() - lastUpdate.getTime()) / 1000)}s ago</span>
                </>
              ) : (
                <span className="text-orange-400">Connecting...</span>
              )}
              {wsError && <span className="text-red-400"> - {wsError}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Clean Toolbar - Split into Logical Groups */}
      <div className="space-y-2">
        {/* Primary Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Chart Type Selector */}
          <div className="flex items-center gap-2 p-1 bg-secondary/40 rounded-lg border border-border/30">
            <button
              onClick={() => setChartType('candlestick')}
              className={`p-2 rounded-md transition-all ${
                chartType === 'candlestick'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
              title="Candlestick"
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded-md transition-all ${
                chartType === 'bar'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
              title="Bar Chart"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-2 rounded-md transition-all ${
                chartType === 'line'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
              title="Line Chart"
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-2 rounded-md transition-all ${
                chartType === 'area'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
              title="Area Chart"
            >
              <AreaChart className="w-4 h-4" />
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-lg border border-border/30">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  timeframe === tf
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Range Selector */}
          <div className="flex items-center gap-1 p-1 bg-secondary/40 rounded-lg border border-border/30">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  range === r
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Indicators */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowIndicators(!showIndicators)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                showIndicators
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:text-foreground border border-border/30 hover:bg-background/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              MA(20)
            </button>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div 
        ref={chartContainerRef}
        className="w-full rounded-xl overflow-hidden border border-border/50 shadow-lg bg-background/50"
        style={{ height: '500px' }}
      />
    </div>
  );
};
