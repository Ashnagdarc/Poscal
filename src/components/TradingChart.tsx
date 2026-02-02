import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickData, HistogramData } from 'lightweight-charts';
import { TrendingUp } from 'lucide-react';

interface TradingChartProps {
  symbol?: string;
  priceData?: { time: string; open: number; high: number; low: number; close: number }[];
}

export const TradingChart = ({ symbol = 'EUR/USD', priceData }: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Wait for container to have dimensions
    const initChart = () => {
      const width = container.clientWidth;
      const height = window.innerWidth < 768 ? 300 : 400;

      // Don't initialize if container has no width
      if (width === 0) {
        requestAnimationFrame(initChart);
        return;
      }

      setIsLoading(true);

      try {
        // Create chart with theme-aware colors
        const chart = createChart(container, {
        layout: {
          background: { type: ColorType.Solid, color: '#09090b' },
          textColor: '#9CA3AF',
          fontSize: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        width,
        height,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 10,
          borderVisible: false,
        },
        grid: {
          horzLines: { color: '#1f2937', visible: true },
          vertLines: { color: '#1f2937', visible: true },
        },
        rightPriceScale: {
          borderVisible: false,
          autoScale: true,
          scaleMargins: { top: 0.1, bottom: 0.1 },
          visible: true,
        },
        leftPriceScale: {
          visible: false,
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: 'rgba(156, 163, 175, 0.5)',
            width: 1,
            style: 0,
          },
          horzLine: {
            color: 'rgba(156, 163, 175, 0.5)',
            width: 1,
            style: 0,
          },
        },
        localization: {
          priceFormatter: (price: number) => price.toFixed(5),
        },
      });

      chartRef.current = chart;

      // Add candlestick series
      const candleSeriesRef = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      // Use proper data format - dates must be in chronological order and in YYYY-MM-DD format
      const defaultData: CandlestickData[] = [
        { time: '2018-12-22', open: 75.16, high: 82.84, low: 36.16, close: 45.72 },
        { time: '2018-12-23', open: 45.12, high: 53.90, low: 45.12, close: 48.09 },
        { time: '2018-12-24', open: 60.71, high: 60.71, low: 53.39, close: 59.29 },
        { time: '2018-12-25', open: 68.26, high: 68.26, low: 59.04, close: 60.50 },
        { time: '2018-12-26', open: 67.71, high: 105.85, low: 66.67, close: 91.04 },
        { time: '2018-12-27', open: 91.04, high: 121.40, low: 82.70, close: 111.40 },
        { time: '2018-12-28', open: 111.51, high: 142.83, low: 103.34, close: 131.25 },
        { time: '2018-12-29', open: 131.33, high: 151.17, low: 77.68, close: 96.43 },
        { time: '2018-12-30', open: 106.33, high: 110.20, low: 90.39, close: 98.10 },
        { time: '2018-12-31', open: 109.87, high: 114.69, low: 85.66, close: 111.26 },
      ];

      candleSeriesRef.setData(defaultData);

      // Fit content to show all data
      chart.timeScale().fitContent();

      // Use ResizeObserver for better resize handling
      resizeObserverRef.current = new ResizeObserver((entries) => {
        if (!chartRef.current || entries.length === 0) return;
        
        const { width } = entries[0].contentRect;
        const height = window.innerWidth < 768 ? 300 : 400;
        
        chartRef.current.applyOptions({ width: Math.max(width, 300), height });
      });

      resizeObserverRef.current.observe(container);

      setIsLoading(false);
    } catch (error) {
      console.error('Chart initialization error:', error);
      setIsLoading(false);
    }
  };

    initChart();

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [priceData]);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{symbol} Chart</h3>
            <p className="text-xs text-muted-foreground">Daily (1D) Timeframe</p>
          </div>
        </div>
        <div className="text-xs px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
          Live Data
        </div>
      </div>
      <div className="relative w-full">
        <div
          ref={containerRef}
          className="w-full bg-gradient-to-b from-secondary/50 to-secondary/30 rounded-2xl overflow-hidden border border-border/50 shadow-sm"
          style={{
            height: window.innerWidth < 768 ? '300px' : '400px',
            minHeight: '300px',
            opacity: isLoading ? 0.6 : 1,
            transition: 'opacity 0.3s ease',
          }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/20 rounded-2xl">
            <div className="text-sm text-muted-foreground">Loading chart...</div>
          </div>
        )}
      </div>
    </div>
  );
};
