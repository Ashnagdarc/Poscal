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

      const defaultData: CandlestickData[] = [
        { time: '2026-01-20' as any, open: 1.0850, high: 1.0920, low: 1.0840, close: 1.0890 },
        { time: '2026-01-21' as any, open: 1.0890, high: 1.0950, low: 1.0870, close: 1.0920 },
        { time: '2026-01-22' as any, open: 1.0920, high: 1.0980, low: 1.0900, close: 1.0960 },
        { time: '2026-01-23' as any, open: 1.0960, high: 1.1020, low: 1.0940, close: 1.0980 },
        { time: '2026-01-24' as any, open: 1.0980, high: 1.1040, low: 1.0960, close: 1.1010 },
        { time: '2026-01-27' as any, open: 1.1010, high: 1.1080, low: 1.0990, close: 1.1040 },
        { time: '2026-01-28' as any, open: 1.1040, high: 1.1100, low: 1.1020, close: 1.1070 },
        { time: '2026-01-29' as any, open: 1.1070, high: 1.1150, low: 1.1060, close: 1.1120 },
        { time: '2026-01-30' as any, open: 1.1120, high: 1.1180, low: 1.1100, close: 1.1150 },
        { time: '2026-01-31' as any, open: 1.1150, high: 1.1220, low: 1.1140, close: 1.1180 },
        { time: '2026-02-03' as any, open: 1.1180, high: 1.1240, low: 1.1160, close: 1.1200 },
        { time: '2026-02-04' as any, open: 1.1200, high: 1.1260, low: 1.1180, close: 1.1240 },
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
