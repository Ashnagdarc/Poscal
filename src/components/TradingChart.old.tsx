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
import { CHART_CONFIG, getBasePrice, getDaysFromRange } from '../config/chartConfig';

type ChartType = 'candlestick' | 'line' | 'area' | 'bar';
type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
type Range = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

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
  const priceLineSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const dataRef = useRef<any[]>([]);
  const priceLineDataRef = useRef<any[]>([]);
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
  const [timeUntilClose, setTimeUntilClose] = useState<string>('');

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
      console.log('📊 Live price update:', { symbol, livePrice, liveChange });
      setCurrentPrice(livePrice);
      setPriceChange(liveChange);
      setLastUpdate(new Date(wsLastUpdate));
      
      // Update chart with live price
      if (seriesRef.current && dataRef.current.length > 0) {
        const lastCandle = dataRef.current[dataRef.current.length - 1];
        const today = new Date().toISOString().split('T')[0];
        
        if (lastCandle && lastCandle.time === today) {
          // Update today's candle
          const updatedCandle = {
            time: lastCandle.time,
            open: lastCandle.open,
            high: Math.max(lastCandle.high, livePrice),
            low: Math.min(lastCandle.low, livePrice),
            close: livePrice,
          };
          
          // Validate candle data
          if (updatedCandle.time && !isNaN(updatedCandle.open) && !isNaN(updatedCandle.high) && 
              !isNaN(updatedCandle.low) && !isNaN(updatedCandle.close)) {
            console.log('📈 Updating candle:', updatedCandle);
            dataRef.current[dataRef.current.length - 1] = updatedCandle;
            seriesRef.current.update(updatedCandle);
          }
          
      // Update price line to show current price (ask line across entire chart)
          // Create price line data for all historical candles with current price
          if (dataRef.current && dataRef.current.length > 0 && livePrice !== null && !isNaN(livePrice)) {
            const updatedPriceLine = dataRef.current.map(candle => ({
              time: candle.time,
              value: livePrice
            })).filter(d => d.time && !isNaN(d.value)); // Validate data
            
            if (priceLineSeriesRef.current && updatedPriceLine.length > 0) {
              console.log('💹 Updating price line to:', livePrice);
              priceLineSeriesRef.current.setData(updatedPriceLine);
            }
          }
          
          // Refresh chart view
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } else {
          // Create new candle for today
          const newCandle = {
            time: today,
            open: livePrice,
            high: livePrice,
            low: livePrice,
            close: livePrice,
          };
          
          // Validate new candle
          if (newCandle.time && !isNaN(newCandle.open) && !isNaN(newCandle.close)) {
            console.log('🆕 Creating new candle:', newCandle);
            dataRef.current.push(newCandle);
            seriesRef.current.update(newCandle);
          }
        }
      }
    }
  }, [livePrice, liveChange, wsLastUpdate]);

  // Countdown timer for bar close (respects timeframe)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let secondsUntilClose = 0;

      if (timeframe === '1m') {
        const secondsInMinute = now.getSeconds();
        secondsUntilClose = 60 - secondsInMinute;
      } else if (timeframe === '5m') {
        const secondsInHour = now.getMinutes() * 60 + now.getSeconds();
        const barIndex = Math.floor(secondsInHour / 300); // 300 seconds = 5 min
        secondsUntilClose = 300 - (secondsInHour % 300);
      } else if (timeframe === '15m') {
        const secondsInHour = now.getMinutes() * 60 + now.getSeconds();
        const barIndex = Math.floor(secondsInHour / 900); // 900 seconds = 15 min
        secondsUntilClose = 900 - (secondsInHour % 900);
      } else if (timeframe === '1h') {
        const secondsInHour = now.getMinutes() * 60 + now.getSeconds();
        secondsUntilClose = 3600 - secondsInHour;
      } else if (timeframe === '4h') {
        const hour = now.getHours();
        const barIndex = Math.floor(hour / 4);
        const barStartHour = barIndex * 4;
        const secondsInBar = (now.getHours() - barStartHour) * 3600 + now.getMinutes() * 60 + now.getSeconds();
        secondsUntilClose = 14400 - secondsInBar; // 14400 = 4 hours
      } else {
        // 1d, 1w, 1m - countdown to midnight
        const secondsInDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        secondsUntilClose = 86400 - secondsInDay;
      }
      
      const hours = Math.floor(secondsUntilClose / 3600);
      const minutes = Math.floor((secondsUntilClose % 3600) / 60);
      const seconds = secondsUntilClose % 60;
      
      setTimeUntilClose(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timeframe]);

  // Convert symbol format for APIs (EUR/USD -> EURUSD)
  const getApiSymbol = (pair: string) => pair.replace('/', '');

  // Generate realistic historical data for forex pairs
  const generateHistoricalData = (pair: string, days: number) => {
    const data = [];
    const now = new Date();
    
    let basePrice = getBasePrice(pair);
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Generate realistic price movement using configurable volatility
      const volatility = basePrice * CHART_CONFIG.dataGeneration.volatility;
      const change = (Math.random() - 0.5) * volatility * 2;
      basePrice += change;
      
      const open = basePrice + (Math.random() - 0.5) * volatility;
      const close = basePrice + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;
      
      data.push({
        time: date.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(CHART_CONFIG.dataGeneration.priceDecimals)),
        high: parseFloat(high.toFixed(CHART_CONFIG.dataGeneration.priceDecimals)),
        low: parseFloat(low.toFixed(CHART_CONFIG.dataGeneration.priceDecimals)),
        close: parseFloat(close.toFixed(CHART_CONFIG.dataGeneration.priceDecimals)),
        value: parseFloat(close.toFixed(CHART_CONFIG.dataGeneration.priceDecimals)),
      });
    }
    
    return data;
  };

  // Fetch historical candlestick data (mock data for now - replace with real API when key available)
  const fetchHistoricalData = async (pair: string, interval: string, days: number) => {
    try {
      // Generate realistic mock data
      await new Promise(resolve => setTimeout(resolve, CHART_CONFIG.dataGeneration.mockApiDelay));
      return generateHistoricalData(pair, days);
    } catch (err) {
      console.error('Error generating historical data:', err);
      throw err;
    }
  };

  // Load initial data
  const loadChartData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Calculate days based on selected range using config mapping
      const days = getDaysFromRange(range);
      
      console.log(`📊 Loading chart data for ${symbol}: ${days} days`);
      const historicalData = await fetchHistoricalData(symbol, timeframe, days);
      
      if (historicalData && historicalData.length > 0) {
        dataRef.current = historicalData;
        console.log(`✅ Loaded ${historicalData.length} candles`);
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
        background: { type: ColorType.Solid, color: CHART_CONFIG.colors.background },
        textColor: CHART_CONFIG.colors.text,
      },
      width: chartContainerRef.current.clientWidth,
      height: CHART_CONFIG.display.height,
      grid: {
        vertLines: { color: CHART_CONFIG.colors.gridLines },
        horzLines: { color: CHART_CONFIG.colors.gridLines },
      },
      timeScale: {
        timeVisible: true,
        borderColor: CHART_CONFIG.colors.border,
      },
      rightPriceScale: {
        borderColor: CHART_CONFIG.colors.border,
      },
    });

    chartRef.current = chart;

    const data = dataRef.current;

    // Add series based on chart type (only if we have data)
    if (data && data.length > 0) {
      let series: ISeriesApi<any>;

      if (chartType === 'candlestick') {
        series = chart.addSeries(CandlestickSeries, {
          upColor: CHART_CONFIG.colors.candleUp,
          downColor: CHART_CONFIG.colors.candleDown,
          borderVisible: CHART_CONFIG.display.candleSettings.borderVisible,
          wickUpColor: CHART_CONFIG.display.candleSettings.wickUpColor,
          wickDownColor: CHART_CONFIG.display.candleSettings.wickDownColor,
        });
        series.setData(data);
      } else if (chartType === 'line') {
        series = chart.addSeries(LineSeries, {
          color: CHART_CONFIG.colors.line,
          lineWidth: CHART_CONFIG.display.lineWidth.default,
        });
        series.setData(data.map(d => ({ time: d.time, value: d.close })));
      } else if (chartType === 'area') {
        series = chart.addSeries(AreaSeries, {
          topColor: CHART_CONFIG.colors.area.top,
          bottomColor: CHART_CONFIG.colors.area.bottom,
          lineColor: CHART_CONFIG.colors.line,
          lineWidth: CHART_CONFIG.display.lineWidth.default,
        });
        series.setData(data.map(d => ({ time: d.time, value: d.close })));
      } else if (chartType === 'bar') {
        series = chart.addSeries(BarSeries, {
          upColor: CHART_CONFIG.colors.candleUp,
          downColor: CHART_CONFIG.colors.candleDown,
        });
        series.setData(data);
      }

      seriesRef.current = series!;

      // Add price line series (shows current ask price as a moving line)
      const priceLineSeries = chart.addSeries(LineSeries, {
        color: CHART_CONFIG.colors.priceLine,
        lineWidth: CHART_CONFIG.display.lineWidth.priceLine,
        lineStyle: 2, // Dashed
        title: 'Ask Price',
      });
      priceLineSeriesRef.current = priceLineSeries;
      
      // Initialize price line with current price if available
      if (currentPrice > 0) {
        priceLineDataRef.current = data.map(candle => ({
          time: candle.time,
          value: currentPrice
        })).filter(d => d.time && !isNaN(d.value));
        
        if (priceLineDataRef.current.length > 0) {
          priceLineSeries.setData(priceLineDataRef.current);
        }
      }

      // Add moving average indicator if enabled
      if (showIndicators && data.length > CHART_CONFIG.indicators.ma20.period) {
        const ma20 = chart.addSeries(LineSeries, {
          color: CHART_CONFIG.indicators.ma20.color,
          lineWidth: CHART_CONFIG.indicators.ma20.lineWidth,
        });
        
        const maData = data.map((d, i) => {
          if (i < CHART_CONFIG.indicators.ma20.period) return { time: d.time, value: d.close };
          const sum = data.slice(i - CHART_CONFIG.indicators.ma20.period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
          return { time: d.time, value: sum / CHART_CONFIG.indicators.ma20.period };
        });
        ma20.setData(maData);
      }

      chart.timeScale().fitContent();
    }

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
  }, [chartType, showIndicators, isLoading]);

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
              {timeUntilClose && (
                <>
                  <span>•</span>
                  <span className="text-amber-400">Bar closes in {timeUntilClose}</span>
                </>
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
