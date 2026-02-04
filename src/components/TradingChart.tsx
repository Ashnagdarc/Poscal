import { useEffect, useRef, useState, useCallback } from 'react';
import EChartsReact from 'echarts-for-react';
import * as echarts from 'echarts';
import { Activity, Wifi, WifiOff, ChevronDown, Plus, Minus, RotateCcw } from 'lucide-react';
import { useForexWebSocket } from '../hooks/useForexWebSocket';
import { getBasePrice } from '../config/chartConfig';

type ChartType = 'candlestick' | 'line' | 'area';
type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
type DrawingMode = 'hline' | 'trend' | 'rect' | null;

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
  timestamp: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface HoveredOHLC {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ClickPoint {
  xLabel: string;
  y: number;
}

interface HorizontalLineDrawing {
  id: string;
  type: 'hline';
  y: number;
}

interface TrendLineDrawing {
  id: string;
  type: 'trend';
  x1: string;
  y1: number;
  x2: string;
  y2: number;
}

interface RectangleDrawing {
  id: string;
  type: 'rect';
  x1: string;
  y1: number;
  x2: string;
  y2: number;
}

type ChartDrawing = HorizontalLineDrawing | TrendLineDrawing | RectangleDrawing;

const DRAWING_KEY_PREFIX = 'poscal_chart_drawings';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const makeDrawingKey = (symbol: string, timeframe: Timeframe) => `${DRAWING_KEY_PREFIX}:${symbol}:${timeframe}`;

export const TradingChart = ({ symbol: initialSymbol = 'EUR/USD' }: TradingChartProps) => {
  const chartRef = useRef<EChartsReact>(null);
  const dataRef = useRef<Candle[]>([]);
  const lastHoverIndexRef = useRef<number | null>(null);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [showIndicators, setShowIndicators] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredOHLC, setHoveredOHLC] = useState<HoveredOHLC | null>(null);
  const [zoomRange, setZoomRange] = useState({ start: 0, end: 100 });
  const [autoScale, setAutoScale] = useState(true);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(null);
  const [pendingPoint, setPendingPoint] = useState<ClickPoint | null>(null);
  const [drawings, setDrawings] = useState<ChartDrawing[]>([]);

  const {
    price: livePrice,
    change: liveChange,
    isConnected,
  } = useForexWebSocket(symbol);

  const getCandleDuration = (tf: Timeframe): number => {
    const durations: Record<Timeframe, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
    };
    return durations[tf] || 24 * 60 * 60 * 1000;
  };

  const getCandleCount = (tf: Timeframe): number => {
    const counts: Record<Timeframe, number> = {
      '1m': 120,
      '5m': 120,
      '15m': 120,
      '1h': 120,
      '4h': 120,
      '1d': 90,
      '1w': 80,
      '1M': 48,
    };
    return counts[tf] || 90;
  };

  const getCandleBucketStart = useCallback((timestamp: number, tf: Timeframe): number => {
    const date = new Date(timestamp);
    if (tf === '1M') {
      return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
    }
    if (tf === '1w') {
      const day = date.getDay();
      const diff = (day + 6) % 7;
      date.setDate(date.getDate() - diff);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }
    const duration = getCandleDuration(tf);
    return Math.floor(timestamp / duration) * duration;
  }, []);

  const formatCandleTime = useCallback((bucketStart: number, tf: Timeframe): string => {
    const date = new Date(bucketStart);
    if (tf === '1M') return date.toISOString().slice(0, 7);
    if (tf === '1w' || tf === '1d') return date.toISOString().slice(0, 10);
    const localIso = new Date(bucketStart - date.getTimezoneOffset() * 60_000).toISOString();
    return localIso.slice(0, 16).replace('T', ' ');
  }, []);

  const generateHistoricalData = useCallback((pair: string, tf: Timeframe, anchorPrice?: number): Candle[] => {
    const result: Candle[] = [];
    const now = Date.now();
    const latestBucket = getCandleBucketStart(now, tf);
    const duration = getCandleDuration(tf);
    const candleCount = getCandleCount(tf);
    let basePrice = anchorPrice && anchorPrice > 0 ? anchorPrice : getBasePrice(pair);

    for (let i = candleCount - 1; i >= 0; i--) {
      const bucketStart = latestBucket - i * duration;
      const volatility = basePrice * 0.0025;
      const drift = (Math.random() - 0.5) * volatility * 2;
      basePrice += drift;

      const open = basePrice + (Math.random() - 0.5) * volatility;
      const close = basePrice + (Math.random() - 0.5) * volatility;
      const high = Math.max(open, close) + Math.random() * volatility * 0.6;
      const low = Math.min(open, close) - Math.random() * volatility * 0.6;

      result.push({
        timestamp: bucketStart,
        time: formatCandleTime(bucketStart, tf),
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
      });
    }

    return result;
  }, [formatCandleTime, getCandleBucketStart]);

  const loadChartData = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      const anchor = livePrice && livePrice > 0 ? livePrice : undefined;
      const historical = generateHistoricalData(symbol, timeframe, anchor);
      dataRef.current = historical;
      setHoveredOHLC(null);
      lastHoverIndexRef.current = null;
      setZoomRange({ start: 0, end: 100 });

      if (historical.length > 1) {
        const last = historical[historical.length - 1];
        const prev = historical[historical.length - 2];
        setCurrentPrice(last.close);
        setPriceChange(((last.close - prev.close) / prev.close) * 100);
      }
      setIsLoading(false);
    }, 250);
  }, [generateHistoricalData, livePrice, symbol, timeframe]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  useEffect(() => {
    const key = makeDrawingKey(symbol, timeframe);
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      setDrawings(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDrawings([]);
    }
    setPendingPoint(null);
  }, [symbol, timeframe]);

  useEffect(() => {
    const key = makeDrawingKey(symbol, timeframe);
    localStorage.setItem(key, JSON.stringify(drawings));
  }, [drawings, symbol, timeframe]);

  useEffect(() => {
    if (livePrice === null || livePrice <= 0 || dataRef.current.length === 0) return;

    const rounded = parseFloat(livePrice.toFixed(5));
    const last = dataRef.current[dataRef.current.length - 1];

    // If synthetic history is far from live market, rebase candles to avoid giant jump candle.
    const driftRatio = last.close > 0 ? Math.abs(last.close - rounded) / last.close : 0;
    if (driftRatio > 0.02) {
      const scale = rounded / last.close;
      dataRef.current = dataRef.current.map((c) => ({
        ...c,
        open: parseFloat((c.open * scale).toFixed(5)),
        high: parseFloat((c.high * scale).toFixed(5)),
        low: parseFloat((c.low * scale).toFixed(5)),
        close: parseFloat((c.close * scale).toFixed(5)),
      }));
    }

    const bucketStart = getCandleBucketStart(Date.now(), timeframe);
    const activeLast = dataRef.current[dataRef.current.length - 1];

    if (activeLast.timestamp === bucketStart) {
      activeLast.close = rounded;
      activeLast.high = parseFloat(Math.max(activeLast.high, rounded).toFixed(5));
      activeLast.low = parseFloat(Math.min(activeLast.low, rounded).toFixed(5));
    } else {
      const open = parseFloat(activeLast.close.toFixed(5));
      dataRef.current.push({
        timestamp: bucketStart,
        time: formatCandleTime(bucketStart, timeframe),
        open,
        high: parseFloat(Math.max(open, rounded).toFixed(5)),
        low: parseFloat(Math.min(open, rounded).toFixed(5)),
        close: rounded,
      });

      const maxCandles = getCandleCount(timeframe);
      if (dataRef.current.length > maxCandles) {
        dataRef.current = dataRef.current.slice(dataRef.current.length - maxCandles);
      }
    }

    setCurrentPrice(rounded);
    setPriceChange(liveChange);
  }, [formatCandleTime, getCandleBucketStart, liveChange, livePrice, timeframe]);

  const addDrawing = useCallback((drawing: ChartDrawing) => {
    setDrawings((prev) => [...prev, drawing]);
  }, []);

  const getPointFromChartClick = useCallback((params: any): ClickPoint | null => {
    const chart = chartRef.current?.getEchartsInstance();
    const nativeEvent = params?.event?.event;
    if (!chart || !nativeEvent || dataRef.current.length === 0) return null;

    const converted = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [nativeEvent.offsetX, nativeEvent.offsetY]) as [number | string, number];
    const y = Number(converted?.[1]);
    if (!Number.isFinite(y)) return null;

    const xRaw = converted?.[0];
    const labels = dataRef.current.map((c) => c.time);

    if (typeof xRaw === 'string') {
      return { xLabel: xRaw, y };
    }

    const idx = clamp(Math.round(Number(xRaw)), 0, labels.length - 1);
    return { xLabel: labels[idx], y };
  }, []);

  const onChartClick = useCallback((params: any) => {
    if (!drawingMode) return;
    const point = getPointFromChartClick(params);
    if (!point) return;

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (drawingMode === 'hline') {
      addDrawing({ id, type: 'hline', y: parseFloat(point.y.toFixed(5)) });
      return;
    }

    if (!pendingPoint) {
      setPendingPoint(point);
      return;
    }

    if (drawingMode === 'trend') {
      addDrawing({
        id,
        type: 'trend',
        x1: pendingPoint.xLabel,
        y1: parseFloat(pendingPoint.y.toFixed(5)),
        x2: point.xLabel,
        y2: parseFloat(point.y.toFixed(5)),
      });
      setPendingPoint(null);
      return;
    }

    if (drawingMode === 'rect') {
      addDrawing({
        id,
        type: 'rect',
        x1: pendingPoint.xLabel,
        y1: parseFloat(pendingPoint.y.toFixed(5)),
        x2: point.xLabel,
        y2: parseFloat(point.y.toFixed(5)),
      });
      setPendingPoint(null);
    }
  }, [addDrawing, drawingMode, getPointFromChartClick, pendingPoint]);

  const updateHoveredFromIndex = useCallback((index?: number) => {
    if (typeof index !== 'number' || index < 0 || index >= dataRef.current.length) return;
    if (lastHoverIndexRef.current === index) return;
    lastHoverIndexRef.current = index;
    const c = dataRef.current[index];
    setHoveredOHLC({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    });
  }, []);

  const onShowTip = useCallback((params: any) => {
    if (typeof params?.dataIndex === 'number') {
      updateHoveredFromIndex(params.dataIndex);
    }
  }, [updateHoveredFromIndex]);

  const onUpdateAxisPointer = useCallback((params: any) => {
    const axis = params?.axesInfo?.[0];
    if (!axis) return;
    const axisVal = axis.value;
    if (typeof axisVal === 'number') {
      updateHoveredFromIndex(axisVal);
      return;
    }
    if (typeof axisVal === 'string') {
      const idx = dataRef.current.findIndex((c) => c.time === axisVal);
      if (idx >= 0) updateHoveredFromIndex(idx);
    }
  }, [updateHoveredFromIndex]);

  const onGlobalOut = useCallback(() => {
    lastHoverIndexRef.current = null;
    setHoveredOHLC(null);
  }, []);

  const onDataZoom = useCallback((params: any) => {
    const batch = Array.isArray(params?.batch) ? params.batch[0] : params;
    const start = typeof batch?.start === 'number' ? batch.start : zoomRange.start;
    const end = typeof batch?.end === 'number' ? batch.end : zoomRange.end;
    setZoomRange({ start, end });
  }, [zoomRange.end, zoomRange.start]);

  const adjustZoom = useCallback((factor: number) => {
    const width = Math.max(2, zoomRange.end - zoomRange.start);
    const center = zoomRange.start + width / 2;
    const nextWidth = clamp(width * factor, 2, 100);
    const start = clamp(center - nextWidth / 2, 0, 100 - nextWidth);
    setZoomRange({ start, end: start + nextWidth });
  }, [zoomRange.end, zoomRange.start]);

  const panBy = useCallback((delta: number) => {
    const width = zoomRange.end - zoomRange.start;
    const start = clamp(zoomRange.start + delta, 0, 100 - width);
    setZoomRange({ start, end: start + width });
  }, [zoomRange.end, zoomRange.start]);

  const resetZoom = useCallback(() => {
    setZoomRange({ start: 0, end: 100 });
  }, []);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
    setPendingPoint(null);
  }, []);

  const getMainSeries = useCallback((values: number[][]): any => {
    if (chartType === 'candlestick') {
      return {
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
      };
    }

    const lineBase: any = {
      type: 'line',
      name: symbol,
      data: dataRef.current.map((c) => c.close),
      lineStyle: {
        color: '#3B82F6',
        width: 2,
      },
      showSymbol: false,
      smooth: true,
    };

    if (chartType === 'area') {
      lineBase.areaStyle = {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
          { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
        ]),
      };
    }
    return lineBase;
  }, [chartType, symbol]);

  const generateOption = useCallback((): echarts.EChartsOption => {
    if (dataRef.current.length === 0) return {};

    const timestamps = dataRef.current.map((d) => d.time);
    const values = dataRef.current.map((c) => [c.open, c.close, c.low, c.high]);
    const highs = dataRef.current.map((c) => c.high);
    const lows = dataRef.current.map((c) => c.low);
    const fullMin = Math.min(...lows);
    const fullMax = Math.max(...highs);
    const padding = (fullMax - fullMin) * 0.08;

    const mainSeries = getMainSeries(values);

    const hLineData = drawings
      .filter((d): d is HorizontalLineDrawing => d.type === 'hline')
      .map((d) => ({
        yAxis: d.y,
        lineStyle: { color: '#94A3B8', width: 1, type: 'dashed' },
        label: { show: false },
      }));

    const trendData = drawings
      .filter((d): d is TrendLineDrawing => d.type === 'trend')
      .map((d) => ([
        { coord: [d.x1, d.y1], symbol: 'none' },
        { coord: [d.x2, d.y2], symbol: 'none' },
      ]));

    const rectData = drawings
      .filter((d): d is RectangleDrawing => d.type === 'rect')
      .map((d) => ([
        { coord: [d.x1, Math.max(d.y1, d.y2)] },
        { coord: [d.x2, Math.min(d.y1, d.y2)] },
      ]));

    const priceLineData = currentPrice > 0 ? [{
      yAxis: currentPrice,
      lineStyle: { color: priceChange >= 0 ? '#10B981' : '#EF4444', width: 1.5, type: 'dashed' },
      label: { show: false },
    }] : [];

    if (hLineData.length > 0 || trendData.length > 0 || priceLineData.length > 0) {
      mainSeries.markLine = {
        symbol: ['none', 'none'],
        label: { show: false },
        data: [...hLineData, ...trendData, ...priceLineData],
      };
    }

    if (rectData.length > 0) {
      mainSeries.markArea = {
        silent: true,
        itemStyle: {
          color: 'rgba(56, 189, 248, 0.10)',
          borderColor: 'rgba(56, 189, 248, 0.60)',
          borderWidth: 1,
        },
        data: rectData,
      };
    }

    const series: any[] = [mainSeries];

    if (showIndicators && dataRef.current.length >= 20) {
      const ma20 = dataRef.current.map((_, i) => {
        if (i < 19) return null;
        const sum = dataRef.current.slice(i - 19, i + 1).reduce((acc, c) => acc + c.close, 0);
        return sum / 20;
      });
      series.push({
        type: 'line',
        name: 'MA(20)',
        data: ma20,
        lineStyle: { color: '#F59E0B', width: 1.5 },
        showSymbol: false,
        smooth: true,
      });
    }

    return {
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 60, right: 20, top: 28, bottom: 42 },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, start: zoomRange.start, end: zoomRange.end },
        { type: 'inside', yAxisIndex: 0 },
      ],
      xAxis: {
        type: 'category',
        data: timestamps,
        boundaryGap: true,
        axisLine: { lineStyle: { color: '#374151' } },
        axisTick: { show: false },
        axisLabel: { color: '#9CA3AF', fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        scale: autoScale,
        min: autoScale ? undefined : parseFloat((fullMin - padding).toFixed(5)),
        max: autoScale ? undefined : parseFloat((fullMax + padding).toFixed(5)),
        splitNumber: 5,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#9CA3AF',
          fontSize: 11,
          formatter: (value: number) => value.toFixed(5),
        },
        splitLine: {
          lineStyle: { color: '#374151', opacity: 0.3 },
        },
      },
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove|click',
        axisPointer: {
          type: 'cross',
          lineStyle: { color: '#6B7280', width: 1, type: 'dashed' },
          crossStyle: { color: '#6B7280' },
        },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: '#374151',
        textStyle: { color: '#F3F4F6', fontSize: 12 },
      },
      series,
    };
  }, [autoScale, currentPrice, drawings, getMainSeries, priceChange, showIndicators, zoomRange.end, zoomRange.start]);

  const chartOption = generateOption();
  const lastCandle = dataRef.current[dataRef.current.length - 1];
  const panel = hoveredOHLC ?? (lastCandle ? {
    time: lastCandle.time,
    open: lastCandle.open,
    high: lastCandle.high,
    low: lastCandle.low,
    close: lastCandle.close,
  } : null);

  const chartEvents = {
    click: onChartClick,
    showTip: onShowTip,
    updateAxisPointer: onUpdateAxisPointer,
    globalout: onGlobalOut,
    datazoom: onDataZoom,
  };

  if (isLoading || !chartOption || Object.keys(chartOption).length === 0) {
    return (
      <div className="w-full bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="w-full h-[600px] flex items-center justify-center bg-background/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Loading chart data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
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

          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <span className="text-2xl font-bold tabular-nums">{currentPrice.toFixed(5)}</span>
            <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
              priceChange >= 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
            }`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>

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

          {panel && (
            <div className="hidden xl:flex items-center gap-3 pl-3 border-l border-border text-xs">
              <span className="text-muted-foreground">{panel.time}</span>
              <span>O <span className="text-foreground tabular-nums">{panel.open.toFixed(5)}</span></span>
              <span>H <span className="text-foreground tabular-nums">{panel.high.toFixed(5)}</span></span>
              <span>L <span className="text-foreground tabular-nums">{panel.low.toFixed(5)}</span></span>
              <span>C <span className="text-foreground tabular-nums">{panel.close.toFixed(5)}</span></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
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

          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setChartType('candlestick')}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                chartType === 'candlestick'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
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
            >
              Area
            </button>
          </div>

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

      <div className="px-4 py-2 border-b border-border/70 bg-background/40 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustZoom(0.8)}
            className="px-2 py-1 border border-border rounded text-xs hover:bg-accent"
            title="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => adjustZoom(1.25)}
            className="px-2 py-1 border border-border rounded text-xs hover:bg-accent"
            title="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => panBy(-10)} className="px-2 py-1 border border-border rounded text-xs hover:bg-accent">◀</button>
          <button onClick={() => panBy(10)} className="px-2 py-1 border border-border rounded text-xs hover:bg-accent">▶</button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 border border-border rounded text-xs hover:bg-accent flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={() => setAutoScale((v) => !v)}
            className={`px-2 py-1 border rounded text-xs ${autoScale ? 'border-green-500/50 text-green-500' : 'border-border hover:bg-accent'}`}
          >
            Autoscale {autoScale ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setDrawingMode(drawingMode === 'hline' ? null : 'hline'); setPendingPoint(null); }}
            className={`px-2 py-1 border rounded text-xs ${drawingMode === 'hline' ? 'border-primary text-primary' : 'border-border hover:bg-accent'}`}
          >
            H-Line
          </button>
          <button
            onClick={() => { setDrawingMode(drawingMode === 'trend' ? null : 'trend'); setPendingPoint(null); }}
            className={`px-2 py-1 border rounded text-xs ${drawingMode === 'trend' ? 'border-primary text-primary' : 'border-border hover:bg-accent'}`}
          >
            Trendline
          </button>
          <button
            onClick={() => { setDrawingMode(drawingMode === 'rect' ? null : 'rect'); setPendingPoint(null); }}
            className={`px-2 py-1 border rounded text-xs ${drawingMode === 'rect' ? 'border-primary text-primary' : 'border-border hover:bg-accent'}`}
          >
            Rectangle
          </button>
          <button onClick={clearDrawings} className="px-2 py-1 border border-border rounded text-xs hover:bg-accent">
            Clear Drawings
          </button>
          {drawingMode && (
            <span className="text-xs text-muted-foreground">
              {pendingPoint ? 'Select second point...' : `Drawing: ${drawingMode}`}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <EChartsReact
          ref={chartRef}
          option={chartOption}
          style={{ width: '100%', height: '620px' }}
          opts={{ renderer: 'canvas' }}
          notMerge={false}
          lazyUpdate={false}
          onEvents={chartEvents}
        />
      </div>
    </div>
  );
};
