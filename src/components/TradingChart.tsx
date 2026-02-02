import { useEffect, useRef, useState } from 'react';
import EChartsReact from 'echarts-for-react';
import * as echarts from 'echarts';
import { TrendingUp, BarChart3, Activity, LineChart, AreaChart } from 'lucide-react';
import { useForexWebSocket } from '../hooks/useForexWebSocket';
import { CHART_CONFIG, getBasePrice, getDaysFromRange } from '../config/chartConfig';

type ChartType = 'candlestick' | 'line' | 'area' | 'bar';
type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
type Range = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

// Forex pairs
const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/JPY', 'EUR/NZD',
  'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
  'AUD/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD',
  'CAD/JPY', 'CAD/CHF', 'CHF/JPY',
  'NZD/JPY', 'NZD/CAD', 'NZD/CHF',
  'USD/SGD', 'USD/HKD', 'USD/ZAR', 'USD/THB', 'USD/MXN', 'USD/TRY',
  'EUR/TRY', 'EUR/NOK', 'EUR/SEK', 'EUR/PLN',
  'GBP/SGD', 'GBP/ZAR',
];

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
const RANGES: Range[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];

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
  const candleTimestampsRef = useRef<string[]>([]);
  
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

  // WebSocket for live prices
  const { 
    price: livePrice, 
    change: liveChange, 
    lastUpdate: wsLastUpdate,
    isConnected,
    error: wsError 
  } = useForexWebSocket(symbol);

  // Generate realistic historical data
  const generateHistoricalData = (pair: string, days: number): Candle[] => {
    const data: Candle[] = [];
    const now = new Date();
    let basePrice = getBasePrice(pair);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

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
      });
    }

    return data;
  };

  // Load chart data
  const loadChartData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const days = getDaysFromRange(range);
      console.log(`📊 Loading chart data for ${symbol}: ${days} days`);

      await new Promise(resolve => setTimeout(resolve, CHART_CONFIG.dataGeneration.mockApiDelay));
      const historicalData = generateHistoricalData(symbol, days);

      if (historicalData && historicalData.length > 0) {
        dataRef.current = historicalData;
        candleTimestampsRef.current = historicalData.map(d => d.time);
        console.log(`✅ Loaded ${historicalData.length} candles`);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Failed to load chart data:', err);
      setError(err.message || 'Failed to load data');
      setIsLoading(false);
    }
  };

  // Load data when symbol/range/timeframe changes
  useEffect(() => {
    loadChartData();
  }, [symbol, range, timeframe]);

  // Update live price
  useEffect(() => {
    if (livePrice !== null && livePrice > 0) {
      console.log('📊 Live price update:', { symbol, livePrice, liveChange });
      setCurrentPrice(livePrice);
      setPriceChange(liveChange);
      setLastUpdate(new Date(wsLastUpdate));

      // Update last candle
      if (dataRef.current && dataRef.current.length > 0) {
        const lastCandle = dataRef.current[dataRef.current.length - 1];
        const today = new Date().toISOString().split('T')[0];

        if (lastCandle.time === today) {
          // Update today's candle
          lastCandle.high = Math.max(lastCandle.high, livePrice);
          lastCandle.low = Math.min(lastCandle.low, livePrice);
          lastCandle.close = livePrice;
        } else {
          // Create new candle
          dataRef.current.push({
            time: today,
            open: livePrice,
            high: livePrice,
            low: livePrice,
            close: livePrice,
          });
          candleTimestampsRef.current.push(today);
        }

        // Trigger chart update
        updateChart();
      }
    }
  }, [livePrice, liveChange, wsLastUpdate]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      let secondsUntilClose = 0;

      if (timeframe === '1m') {
        secondsUntilClose = 60 - now.getSeconds();
      } else if (timeframe === '5m') {
        const secondsInHour = now.getMinutes() * 60 + now.getSeconds();
        secondsUntilClose = 300 - (secondsInHour % 300);
      } else if (timeframe === '15m') {
        const secondsInHour = now.getMinutes() * 60 + now.getSeconds();
        secondsUntilClose = 900 - (secondsInHour % 900);
      } else if (timeframe === '1h') {
        const secondsInHour = now.getMinutes() * 60 + now.getSeconds();
        secondsUntilClose = 3600 - secondsInHour;
      } else if (timeframe === '4h') {
        const hour = now.getHours();
        const barIndex = Math.floor(hour / 4);
        const barStartHour = barIndex * 4;
        const secondsInBar = (now.getHours() - barStartHour) * 3600 + now.getMinutes() * 60 + now.getSeconds();
        secondsUntilClose = 14400 - secondsInBar;
      } else {
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

  // Update chart
  const updateChart = () => {
    if (!chartRef.current) return;

    const chart = chartRef.current.getEchartsInstance();
    if (!chart) return;

    const chartData = generateChartData();
    const option = generateOption(chartData);
    chart.setOption(option);
  };

  // Generate chart data based on type
  const generateChartData = () => {
    if (!dataRef.current || dataRef.current.length === 0) {
      return { candleData: [], ma20Data: [], priceLineData: [] };
    }

    const candleData = dataRef.current.map(candle => [
      candle.open,
      candle.close,
      candle.low,
      candle.high,
    ]);

    let ma20Data: (number | null)[] = [];
    if (showIndicators && dataRef.current.length > 20) {
      ma20Data = dataRef.current.map((candle, i) => {
        if (i < 19) return null;
        const sum = dataRef.current
          .slice(i - 19, i + 1)
          .reduce((acc, c) => acc + c.close, 0);
        return sum / 20;
      });
    }

    const priceLineData = dataRef.current.map(() => currentPrice);

    return { candleData, ma20Data, priceLineData };
  };

  // Generate ECharts option
  const generateOption = (chartData: ReturnType<typeof generateChartData>): echarts.EChartsOption => {
    const baseOption: echarts.EChartsOption = {
      backgroundColor: CHART_CONFIG.colors.background,
      textStyle: {
        color: CHART_CONFIG.colors.text,
      },
      grid: {
        left: '10%',
        right: '10%',
        top: '10%',
        bottom: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: candleTimestampsRef.current,
        boundaryGap: false,
        axisLine: { lineStyle: { color: CHART_CONFIG.colors.gridLines } },
        splitLine: { lineStyle: { color: CHART_CONFIG.colors.gridLines } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { lineStyle: { color: CHART_CONFIG.colors.gridLines } },
        splitLine: { lineStyle: { color: CHART_CONFIG.colors.gridLines } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: CHART_CONFIG.colors.border,
        textStyle: { color: CHART_CONFIG.colors.text },
      },
      series: [],
    };

    // Add candlestick series
    if (chartType === 'candlestick') {
      (baseOption.series as any[]).push({
        name: 'Candlestick',
        type: 'candlestick',
        data: chartData.candleData,
        itemStyle: {
          color: CHART_CONFIG.colors.candleUp,
          color0: CHART_CONFIG.colors.candleDown,
          borderColor: CHART_CONFIG.colors.candleUp,
          borderColor0: CHART_CONFIG.colors.candleDown,
        },
      });
    } else if (chartType === 'line') {
      (baseOption.series as any[]).push({
        name: 'Line',
        type: 'line',
        data: dataRef.current.map(c => c.close),
        lineStyle: { color: CHART_CONFIG.colors.line, width: 2 },
        smooth: true,
      });
    } else if (chartType === 'area') {
      (baseOption.series as any[]).push({
        name: 'Area',
        type: 'area',
        data: dataRef.current.map(c => c.close),
        lineStyle: { color: CHART_CONFIG.colors.line, width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: CHART_CONFIG.colors.area.top },
            { offset: 1, color: CHART_CONFIG.colors.area.bottom },
          ]),
        },
        smooth: true,
      });
    } else if (chartType === 'bar') {
      (baseOption.series as any[]).push({
        name: 'Bar',
        type: 'bar',
        data: chartData.candleData,
        itemStyle: {
          color: CHART_CONFIG.colors.candleUp,
          color0: CHART_CONFIG.colors.candleDown,
        },
      });
    }

    // Add MA(20) if enabled
    if (showIndicators && chartData.ma20Data.length > 0) {
      (baseOption.series as any[]).push({
        name: 'MA(20)',
        type: 'line',
        data: chartData.ma20Data,
        lineStyle: { color: CHART_CONFIG.colors.indicator, width: 1 },
        smooth: true,
      });
    }

    // Add price line
    if (currentPrice > 0) {
      (baseOption.series as any[]).push({
        name: 'Ask Price',
        type: 'line',
        data: chartData.priceLineData,
        lineStyle: {
          color: CHART_CONFIG.colors.priceLine,
          width: 2,
          type: 'dashed',
        },
        smooth: false,
      });
    }

    return baseOption;
  };

  const chartOption = generateOption(generateChartData());

  return (
    <div className="w-full space-y-4">
      {/* Header */}
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

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Chart Type */}
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

          {/* Timeframes */}
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

          {/* Ranges */}
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
      {isLoading ? (
        <div className="w-full h-[500px] rounded-xl overflow-hidden border border-border/50 shadow-lg bg-background/50 flex items-center justify-center">
          <div className="text-muted-foreground">Loading chart...</div>
        </div>
      ) : (
        <EChartsReact
          ref={chartRef}
          option={chartOption}
          style={{ width: '100%', height: '500px' }}
          opts={{ renderer: 'svg' }}
          className="w-full rounded-xl overflow-hidden border border-border/50 shadow-lg bg-background/50"
        />
      )}
    </div>
  );
};
