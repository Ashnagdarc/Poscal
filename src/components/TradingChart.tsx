import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { TrendingUp } from 'lucide-react';

interface TradingChartProps {
  symbol?: string;
  priceData?: { time: string; open: number; high: number; low: number; close: number }[];
}

export const TradingChart = ({ symbol = 'EUR/USD', priceData }: TradingChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);

    // Defer chart creation to next frame for better performance
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      try {
        // Create chart with theme-aware colors
        const chart = createChart(containerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#9CA3AF',
            fontSize: 12,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          },
          width: containerRef.current.clientWidth,
          height: window.innerWidth < 768 ? 300 : 400,
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5,
            barSpacing: 8,
          },
          grid: {
            horzLines: { color: 'rgba(42, 46, 57, 0.3)' },
            vertLines: { color: 'rgba(42, 46, 57, 0.3)' },
          },
          rightPriceScale: {
            autoScale: true,
            scaleMargins: { top: 0.1, bottom: 0.2 },
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

        // Default demo data with realistic EUR/USD prices
        const defaultData = [
          { time: '2026-01-20', open: 1.0850, high: 1.0920, low: 1.0840, close: 1.0890 },
          { time: '2026-01-21', open: 1.0890, high: 1.0950, low: 1.0870, close: 1.0920 },
          { time: '2026-01-22', open: 1.0920, high: 1.0980, low: 1.0900, close: 1.0960 },
          { time: '2026-01-23', open: 1.0960, high: 1.1020, low: 1.0940, close: 1.0980 },
          { time: '2026-01-24', open: 1.0980, high: 1.1040, low: 1.0960, close: 1.1010 },
          { time: '2026-01-27', open: 1.1010, high: 1.1080, low: 1.0990, close: 1.1040 },
          { time: '2026-01-28', open: 1.1040, high: 1.1100, low: 1.1020, close: 1.1070 },
          { time: '2026-01-29', open: 1.1070, high: 1.1150, low: 1.1060, close: 1.1120 },
          { time: '2026-01-30', open: 1.1120, high: 1.1180, low: 1.1100, close: 1.1150 },
          { time: '2026-01-31', open: 1.1150, high: 1.1220, low: 1.1140, close: 1.1180 },
          { time: '2026-02-03', open: 1.1180, high: 1.1240, low: 1.1160, close: 1.1200 },
          { time: '2026-02-04', open: 1.1200, high: 1.1260, low: 1.1180, close: 1.1240 },
        ];

        candleSeriesRef.setData(priceData || defaultData);

        // Add volume series
        const volumeSeriesRef = chart.addHistogramSeries({
          color: '#1f2937',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });

        const volumeData = (priceData || defaultData).map((candle) => ({
          time: candle.time,
          value: Math.random() * 1000000 + 500000,
          color: Number(candle.close) > Number(candle.open) ? '#10b98133' : '#ef444433',
        }));

        volumeSeriesRef.setData(volumeData);

        // Fit content
        chart.timeScale().fitContent();

        // Handle responsive resize
        const handleResize = () => {
          if (containerRef.current && chartRef.current) {
            const width = containerRef.current.clientWidth;
            const height = window.innerWidth < 768 ? 300 : 400;
            chartRef.current.applyOptions({ width, height });
          }
        };

        window.addEventListener('resize', handleResize);

        setIsLoading(false);

        return () => {
          window.removeEventListener('resize', handleResize);
          chart.remove();
        };
      } catch (error) {
        console.error('Chart initialization error:', error);
        setIsLoading(false);
      }
    }, 100);

    return () => clearTimeout(timer);
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
      <div
        ref={containerRef}
        className="w-full bg-gradient-to-b from-secondary/50 to-secondary/30 rounded-2xl overflow-hidden border border-border/50 shadow-sm"
        style={{
          height: window.innerWidth < 768 ? '300px' : '400px',
          opacity: isLoading ? 0.6 : 1,
          transition: 'opacity 0.3s ease',
        }}
      />
    </div>
  );
};

