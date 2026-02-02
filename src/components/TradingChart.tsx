import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries } from 'lightweight-charts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TradingChartProps {
  symbol?: string;
}

export const TradingChart = ({ symbol = 'EUR/USD' }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#d1d5db',
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    candlestickSeries.setData([
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
    ]);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
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
        ref={chartContainerRef}
        className="w-full rounded-2xl overflow-hidden border border-border/50 shadow-sm"
        style={{ height: '400px' }}
      />
    </div>
  );
};
