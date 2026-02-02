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
import { TrendingUp, BarChart3, Activity, Maximize2, Plus } from 'lucide-react';

type ChartType = 'candlestick' | 'line' | 'area' | 'bar';
type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
type Range = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
const RANGES: Range[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];

interface TradingChartProps {
  symbol?: string;
}

export const TradingChart = ({ symbol: initialSymbol = 'EUR/USD' }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  
  const [symbol, setSymbol] = useState(initialSymbol);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');
  const [range, setRange] = useState<Range>('1M');
  const [showIndicators, setShowIndicators] = useState(false);

  const [showIndicators, setShowIndicators] = useState(false);

  // Generate sample data based on timeframe
  const generateData = () => {
    const data = [];
    const now = new Date('2018-12-31');
    const days = range === '1D' ? 1 : range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : range === '6M' ? 180 : range === '1Y' ? 365 : 365;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const open = 75 + Math.random() * 50;
      const close = open + (Math.random() - 0.5) * 20;
      const high = Math.max(open, close) + Math.random() * 10;
      const low = Math.min(open, close) - Math.random() * 10;
      
      data.push({
        time: dateStr,
        open,
        high,
        low,
        close,
        value: close // for line/area charts
      });
    }
    return data;
  };

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

    // Add series based on chart type
    let series: ISeriesApi<any>;
    const data = generateData();

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
    if (showIndicators) {
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
  }, [chartType, timeframe, range, symbol, showIndicators]);

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{symbol}</h3>
            <p className="text-xs text-muted-foreground">Timeframe: {timeframe.toUpperCase()}</p>
          </div>
        </div>
        <div className="text-xs px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
          Live Data
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-secondary/30 rounded-xl border border-border/50">
        {/* Pair Selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Pair:</span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="px-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {PAIRS.map(pair => (
              <option key={pair} value={pair}>{pair}</option>
            ))}
          </select>
        </div>

        {/* Chart Type */}
        <div className="flex items-center gap-1 border-l border-border/50 pl-3">
          <span className="text-xs text-muted-foreground mr-1">Type:</span>
          <div className="flex gap-1">
            {(['candlestick', 'line', 'area', 'bar'] as ChartType[]).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  chartType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent text-muted-foreground'
                }`}
              >
                {type === 'candlestick' ? 'Candle' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-1 border-l border-border/50 pl-3">
          <span className="text-xs text-muted-foreground mr-1">TF:</span>
          <div className="flex gap-1">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent text-muted-foreground'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Range */}
        <div className="flex items-center gap-1 border-l border-border/50 pl-3">
          <span className="text-xs text-muted-foreground mr-1">Range:</span>
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  range === r
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent text-muted-foreground'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-1 border-l border-border/50 pl-3 ml-auto">
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
              showIndicators
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-background hover:bg-accent text-muted-foreground'
            }`}
          >
            <Activity className="w-3 h-3" />
            MA(20)
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs bg-background hover:bg-accent text-muted-foreground rounded-md transition-colors"
            title="Add Indicator"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div 
        ref={chartContainerRef}
        className="w-full rounded-xl overflow-hidden border border-border/50 shadow-lg"
        style={{ height: '500px' }}
      />
    </div>
  );
};
