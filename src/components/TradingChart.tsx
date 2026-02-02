import { useEffect, useRef, useState, useCallback } from 'react';
import EChartsReact from 'echarts-for-react';
import * as echarts from 'echarts';
import { Activity, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import { useForexWebSocket } from '../hooks/useForexWebSocket';
import { CHART_CONFIG, getBasePrice, getDaysFromRange } from '../config/chartConfig';

type ChartType = 'candlestick' | 'line' | 'area';
type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

// Binance-supported Forex pairs (these work with the WebSocket backend)
const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD',
  'USD/CHF', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
];

const TIMEFRAMES: { value: Timeframe; label: string; }[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1M', label: '1M' },
];

interface TradingChartProps {
  symbol?: string;
}

interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export const TradingChart = ({ symbol: initialSymbol = 'EUR/USD' }: TradingChartProps) => {
  const chartRef = useRef<EChartsReact>(null);
  const dataRef = useRef<Candle[]>([]);
  const updateTimerRef = useRef<NodeJS.Timeout>();
  const candleTimerRef = useRef<NodeJS.Timeout>();
  const currentCandleStartTimeRef = useRef<Date>(new Date());
  
  const [symbol, setSymbol] = useState(initialSymbol);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [showIndicators, setShowIndicators] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // WebSocket for live prices
  const { 
    price: livePrice, 
    change: liveChange, 
    isConnected 
  } = useForexWebSocket(symbol);

  // Get candle duration in milliseconds
  const getCandleDuration = (tf: Timeframe): number => {
    const durations: Record<Timeframe, number> = {
      '1m': 60 * 1000,        // 1 minute
      '5m': 5 * 60 * 1000,    // 5 minutes
      '15m': 15 * 60 * 1000,  // 15 minutes
      '1h': 60 * 60 * 1000,   // 1 hour
      '4h': 4 * 60 * 60 * 1000, // 4 hours
      '1d': 24 * 60 * 60 * 1000, // 1 day
      '1w': 7 * 24 * 60 * 60 * 1000, // 1 week
      '1M': 30 * 24 * 60 * 60 * 1000, // 1 month (approx)
    };
    return durations[tf] || 24 * 60 * 60 * 1000;
  };

  // Get candle count based on timeframe
  const getCandleCount = (tf: Timeframe): number => {
    const counts: Record<Timeframe, number> = {
      '1m': 60,
      '5m': 72,
      '15m': 96,
      '1h': 100,
      '4h': 90,
      '1d': 30,
      '1w': 52,
      '1M': 24,
    };
    return counts[tf] || 30;
  };

  // Generate realistic historical data
  const generateHistoricalData = useCallback((pair: string, tf: Timeframe): Candle[] => {
    const data: Candle[] = [];
    const now = new Date();
    let basePrice = getBasePrice(pair);
    const candleCount = getCandleCount(tf);

    for (let i = candleCount - 1; i >= 0; i--) {
      const date = new Date(now);
      
      // Adjust date based on timeframe
      if (tf === '1M') {
        date.setMonth(date.getMonth() - i);
      } else if (tf === '1w') {
        date.setDate(date.getDate() - (i * 7));
      } else if (tf === '1d' || tf === '4h' || tf === '1h') {
        date.setDate(date.getDate() - i);
      } else {
        // For minute timeframes, use hours
        date.setHours(date.getHours() - i);
      }

      const volatility = basePrice * 0.01;
      const change = (Math.random() - 0.5) * volatility * 2;
      basePrice += change;

      const open = basePrice + (Math.random() - 0.5) * volatility;
      const close = basePrice + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;

      data.push({
        time: tf === '1M' ? date.toISOString().split('T')[0].slice(0, 7) : date.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
      });
    }

    return data;
  }, []);

  // Load chart data
  const loadChartData = useCallback(() => {
    setIsLoading(true);
    
    setTimeout(() => {
      const historicalData = generateHistoricalData(symbol, timeframe);
      dataRef.current = historicalData;
      
      if (historicalData.length > 0) {
        const lastCandle = historicalData[historicalData.length - 1];
        setCurrentPrice(lastCandle.close);
        
        if (historicalData.length > 1) {
          const prevCandle = historicalData[historicalData.length - 2];
          const change = ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100;
          setPriceChange(change);
        }
      }
      
      setIsLoading(false);
    }, 300);
  }, [symbol, timeframe, generateHistoricalData]);

  // Load data when symbol/timeframe changes
  useEffect(() => {
    loadChartData();
    
    // Reset candle timer when timeframe changes
    currentCandleStartTimeRef.current = new Date();
  }, [loadChartData]);

  // Auto-generate new candles based on timeframe
  useEffect(() => {
    const candleDuration = getCandleDuration(timeframe);
    
    const checkNewCandle = () => {
      const now = new Date();
      const elapsed = now.getTime() - currentCandleStartTimeRef.current.getTime();
      
      // If enough time has passed, create a new candle
      if (elapsed >= candleDuration && dataRef.current.length > 0) {
        const lastCandle = dataRef.current[dataRef.current.length - 1];
        const newOpen = lastCandle.close;
        
        // Add small random movement for new candle
        const volatility = newOpen * 0.002;
        const priceMove = (Math.random() - 0.5) * volatility;
        const newClose = newOpen + priceMove;
        
        const newCandle: Candle = {
          time: now.toISOString().split('T')[0],
          open: parseFloat(newOpen.toFixed(5)),
          high: parseFloat(Math.max(newOpen, newClose).toFixed(5)),
          low: parseFloat(Math.min(newOpen, newClose).toFixed(5)),
          close: parseFloat(newClose.toFixed(5)),
        };
        
        dataRef.current.push(newCandle);
        
        // Remove oldest candle to maintain count
        const maxCandles = getCandleCount(timeframe);
        if (dataRef.current.length > maxCandles) {
          dataRef.current.shift();
        }
        
        currentCandleStartTimeRef.current = now;
        setCurrentPrice(newClose);
        updateChart();
        
        console.log('📊 New candle created:', newCandle);
      }
    };
    
    // Check every second for new candles
    candleTimerRef.current = setInterval(checkNewCandle, 1000);
    
    return () => {
      if (candleTimerRef.current) {
        clearInterval(candleTimerRef.current);
      }
    };
  }, [timeframe]);

  // Update live price with real-time candlestick updates
  useEffect(() => {
    if (livePrice !== null && livePrice > 0 && dataRef.current.length > 0) {
      // Animate price change
      const startPrice = currentPrice;
      const endPrice = livePrice;
      const duration = 500; // 500ms animation
      const startTime = Date.now();

      const animatePrice = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const interpolatedPrice = startPrice + (endPrice - startPrice) * easeProgress;
        
        setCurrentPrice(interpolatedPrice);
        
        if (progress < 1) {
          requestAnimationFrame(animatePrice);
        } else {
          setCurrentPrice(endPrice);
        }
      };

      animatePrice();
      setPriceChange(liveChange);

      // Update last candle with live price to create dynamic movement
      const lastCandle = dataRef.current[dataRef.current.length - 1];
      
      // Update OHLC for current candle
      lastCandle.close = parseFloat(livePrice.toFixed(5));
      lastCandle.high = parseFloat(Math.max(lastCandle.high, livePrice).toFixed(5));
      lastCandle.low = parseFloat(Math.min(lastCandle.low, livePrice).toFixed(5));

      // Update chart to show visual candle movement
      updateChart();
      updateChart();
    }
  }, [livePrice, liveChange]);

  // Update chart
  const updateChart = useCallback(() => {
    if (!chartRef.current || dataRef.current.length === 0) return;

    const chart = chartRef.current.getEchartsInstance();
    if (!chart) return;

    const option = generateOption();
    chart.setOption(option, { notMerge: false, lazyUpdate: false });
  }, [chartType, showIndicators, currentPrice]);

  // Trigger chart updates
  useEffect(() => {
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    
    updateTimerRef.current = setTimeout(() => {
      updateChart();
    }, 100);

    return () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [chartType, showIndicators, currentPrice, updateChart]);

  // Generate ECharts option
  const generateOption = useCallback((): echarts.EChartsOption => {
    if (dataRef.current.length === 0) {
      return {};
    }

    const timestamps = dataRef.current.map(d => d.time);
    const values = dataRef.current.map(candle => [candle.open, candle.close, candle.low, candle.high]);

    const option: echarts.EChartsOption = {
      animation: true,
      animationDuration: 300,
      backgroundColor: 'transparent',
      grid: {
        left: 60,
        right: 20,
        top: 40,
        bottom: 40,
      },
      xAxis: {
        type: 'category',
        data: timestamps,
        boundaryGap: true,
        axisLine: { 
          lineStyle: { color: '#374151' }
        },
        axisTick: { show: false },
        axisLabel: { 
          color: '#9CA3AF',
          fontSize: 11,
        },
        splitLine: { show: false },
      },
      yAxis: {
        scale: true,
        splitNumber: 5,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 11,
          formatter: (value: number) => value.toFixed(5),
        },
        splitLine: {
          lineStyle: {
            color: '#374151',
            opacity: 0.3,
          }
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#6B7280',
            width: 1,
            type: 'dashed',
          },
        },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: '#374151',
        textStyle: {
          color: '#F3F4F6',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const data = params[0];
          if (!data || !data.value) return '';
          
          const [open, close, low, high] = data.value;
          const color = close >= open ? '#10B981' : '#EF4444';
          
          return `
            <div style="font-weight: 600; margin-bottom: 8px;">${data.name}</div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; gap: 20px;">
                <span style="color: #9CA3AF;">Open:</span>
                <span style="color: ${color}">${open.toFixed(5)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 20px;">
                <span style="color: #9CA3AF;">High:</span>
                <span style="color: ${color}">${high.toFixed(5)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 20px;">
                <span style="color: #9CA3AF;">Low:</span>
                <span style="color: ${color}">${low.toFixed(5)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 20px;">
                <span style="color: #9CA3AF;">Close:</span>
                <span style="color: ${color}; font-weight: 600;">${close.toFixed(5)}</span>
              </div>
            </div>
          `;
        },
      },
      series: [],
    };

    // Add main series based on chart type
    if (chartType === 'candlestick') {
      (option.series as any[]).push({
        type: 'candlestick',
        name: symbol,
        data: values,
        itemStyle: {
          color: '#10B981',
          color0: '#EF4444',
          borderColor: '#10B981',
          borderColor0: '#EF4444',
          borderWidth: 1,
        },
        barWidth: '60%',
      });
    } else if (chartType === 'line') {
      (option.series as any[]).push({
        type: 'line',
        name: symbol,
        data: dataRef.current.map(c => c.close),
        lineStyle: {
          color: '#3B82F6',
          width: 2,
        },
        showSymbol: false,
        smooth: true,
      });
    } else if (chartType === 'area') {
      (option.series as any[]).push({
        type: 'line',
        name: symbol,
        data: dataRef.current.map(c => c.close),
        lineStyle: {
          color: '#3B82F6',
          width: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
          ]),
        },
        showSymbol: false,
        smooth: true,
      });
    }

    // Add MA(20) if enabled
    if (showIndicators && dataRef.current.length >= 20) {
      const ma20Data = dataRef.current.map((candle, i) => {
        if (i < 19) return null;
        const sum = dataRef.current
          .slice(i - 19, i + 1)
          .reduce((acc, c) => acc + c.close, 0);
        return sum / 20;
      });

      (option.series as any[]).push({
        type: 'line',
        name: 'MA(20)',
        data: ma20Data,
        lineStyle: {
          color: '#F59E0B',
          width: 1.5,
        },
        showSymbol: false,
        smooth: true,
      });
    }

    // Add current price line
    if (currentPrice > 0) {
      (option.series as any[]).push({
        type: 'line',
        name: 'Ask Price',
        data: dataRef.current.map(() => currentPrice),
        lineStyle: {
          color: priceChange >= 0 ? '#10B981' : '#EF4444',
          width: 2,
          type: 'dashed',
        },
        showSymbol: false,
        z: 10,
      });
    }

    return option;
  }, [chartType, showIndicators, symbol, currentPrice, priceChange]);

  const chartOption = generateOption();

  return (
    <div className="w-full bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* TradingView-style Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          {/* Symbol Selector - TradingView Style */}
          <div className="relative">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="appearance-none bg-transparent text-lg font-bold cursor-pointer pr-6 outline-none hover:text-primary transition-colors"
            >
              {PAIRS.map(pair => (
                <option key={pair} value={pair}>{pair}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
          </div>

          {/* Price Display */}
          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <span className="text-2xl font-bold tabular-nums">
              {currentPrice.toFixed(5)}
            </span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
              priceChange >= 0 
                ? 'bg-green-500/20 text-green-500' 
                : 'bg-red-500/20 text-red-500'
            }`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-2 pl-3 border-l border-border">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-500 font-medium">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-orange-500 animate-pulse" />
                <span className="text-xs text-orange-500 font-medium">Connecting...</span>
              </>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Timeframe Selector - Compact */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  timeframe === tf.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart Type Switcher */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setChartType('candlestick')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                chartType === 'candlestick'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="Candles"
            >
              Candles
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 text-xs font-medium transition-colors border-l border-border ${
                chartType === 'line'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="Line"
            >
              Line
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1 text-xs font-medium transition-colors border-l border-border ${
                chartType === 'area'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title="Area"
            >
              Area
            </button>
          </div>

          {/* Indicators Toggle */}
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              showIndicators
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground border border-border'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            MA(20)
          </button>
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="w-full h-[600px] flex items-center justify-center bg-background/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading chart data...</span>
          </div>
        </div>
      ) : (
        <div className="relative">
          <EChartsReact
            ref={chartRef}
            option={chartOption}
            style={{ width: '100%', height: '600px' }}
            opts={{ renderer: 'canvas' }}
            notMerge={false}
            lazyUpdate={false}
          />
        </div>
      )}
    </div>
  );
};
