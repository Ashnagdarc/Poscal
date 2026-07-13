import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Calculator as CalculatorIcon,
  ChevronRight,
  Loader2,
  Radio,
  Target,
  User,
} from "lucide-react";

import { CurrencyGrid } from "./CurrencyGrid";
import { StopLossSelector } from "./StopLossSelector";
import { useAuth } from "@/contexts/AuthContext";
import { type CurrencyPair } from "@/lib/currencyPairs";
import { useRealtimePrices } from "@/hooks/use-realtime-prices";
import {
  saveCalculatorHistory,
  type SaveCalculatorHistoryInput,
} from "@/lib/calculatorHistory";
import { BROKER_PROFILES, resolveInstrumentForBroker } from "@/domain/brokers";
import { listSupportedInstruments } from "@/domain/instruments";
import { calculatePositionSize } from "@/domain/positionSizing";
import type { OrderType, ResolvedInstrument, TradeSide } from "@/domain/types";
import { loadUserSettings } from "@/lib/convexUserSettings";
import {
  clearPendingSignal,
  inferSignalDirection,
  readPendingSignal,
  type TradeSignal,
} from "@/lib/signals";
import { toast } from "sonner";

const CALCULATOR_PAIRS: CurrencyPair[] = listSupportedInstruments()
  .filter(
    (instrument) =>
      instrument.quoteCurrency === "USD" || instrument.baseCurrency === "USD",
  )
  .map((instrument) => ({
    symbol: instrument.symbol,
    pipDecimal: instrument.pipPrecision,
  }));

const DEFAULT_PAIR = CALCULATOR_PAIRS[0];

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatShortTime = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

export const Calculator = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const [selectedPair, setSelectedPair] = useState<CurrencyPair>(DEFAULT_PAIR);
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [tradeDirection, setTradeDirection] = useState<TradeSide>("buy");
  const [accountBalance, setAccountBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [showCurrencyGrid, setShowCurrencyGrid] = useState(false);
  const [appliedSignal, setAppliedSignal] = useState<TradeSignal | null>(null);

  const broker = BROKER_PROFILES[0];
  const riskPresets = ["0.5", "1", "2", "3"];

  useEffect(() => {
    const pendingSignal = readPendingSignal();
    if (!pendingSignal) {
      return;
    }

    const matchingPair = CALCULATOR_PAIRS.find(
      (pair) => pair.symbol === pendingSignal.symbol,
    );
    if (matchingPair) {
      setSelectedPair(matchingPair);
    }

    setOrderType(pendingSignal.orderType);
    setEntryPrice(String(pendingSignal.entry));
    setStopLossPrice(String(pendingSignal.stopLoss));
    setTakeProfitPrice(String(pendingSignal.takeProfit));

    const inferredDirection = inferSignalDirection(pendingSignal);
    if (inferredDirection) {
      setTradeDirection(inferredDirection);
    }

    setAppliedSignal(pendingSignal);
    clearPendingSignal();
  }, []);

  useEffect(() => {
    const syncCalculatorDefaults = async () => {
      const settings = await loadUserSettings(session?.access_token);
      if (
        typeof settings.defaultRiskPercent === "number" &&
        settings.defaultRiskPercent > 0
      ) {
        setRiskPercent(String(settings.defaultRiskPercent));
      }
    };

    void syncCalculatorDefaults();
  }, [session?.access_token]);

  const instrument = useMemo<ResolvedInstrument>(
    () => resolveInstrumentForBroker(broker, selectedPair.symbol),
    [broker, selectedPair.symbol],
  );

  const liveQuoteEnabled = orderType === "market";
  const {
    prices,
    askPrices,
    bidPrices,
    quoteSourceBySymbol,
    priceStatus,
    updatedAtBySymbol,
    loading: pricesLoading,
    error: pricesError,
  } = useRealtimePrices({
    symbols: liveQuoteEnabled ? [selectedPair.symbol] : [],
    enabled: liveQuoteEnabled,
    pollIntervalMs: 20000,
    staleAfterMs: 45000,
    allowFallback: true,
  });

  const currentMidPrice = prices[selectedPair.symbol];
  const currentAskPrice = askPrices[selectedPair.symbol];
  const currentBidPrice = bidPrices[selectedPair.symbol];
  const currentPairStatus = liveQuoteEnabled
    ? (priceStatus[selectedPair.symbol] ?? "unavailable")
    : "fresh";
  const currentPairSource = liveQuoteEnabled
    ? quoteSourceBySymbol[selectedPair.symbol]
    : "manual";
  const currentPairUpdatedAt = liveQuoteEnabled
    ? updatedAtBySymbol[selectedPair.symbol]
    : null;

  const calculation = useMemo(() => {
    try {
      return calculatePositionSize({
        broker,
        instrument,
        accountBalance: toNumber(accountBalance),
        riskPercent: toNumber(riskPercent),
        entryPrice: orderType === "limit" ? toNumber(entryPrice) : undefined,
        stopLossPrice: toNumber(stopLossPrice),
        takeProfitPrice: toNumber(takeProfitPrice),
        side: tradeDirection,
        orderType,
        marketQuote:
          orderType === "market"
            ? {
                bid: currentBidPrice,
                ask: currentAskPrice,
                mid: currentMidPrice,
              }
            : undefined,
      });
    } catch {
      return null;
    }
  }, [
    accountBalance,
    broker,
    currentAskPrice,
    currentBidPrice,
    currentMidPrice,
    entryPrice,
    instrument,
    orderType,
    riskPercent,
    stopLossPrice,
    takeProfitPrice,
    tradeDirection,
  ]);

  const canSave = calculation !== null && calculation.lots > 0;
  const executionPrice = calculation?.entryPrice;
  const saveLabel = user ? "Save to Journal" : "Save Locally";
  const quoteStatusMessage =
    orderType === "market"
      ? currentPairStatus === "fresh"
        ? "Optional market quote is available."
        : currentPairStatus === "stale"
          ? "Quote is stale. Confirm before trading."
          : "Quote is unavailable. Use manual mode to size offline."
      : "Manual mode is fully offline and deterministic.";

  const formatPrice = (value?: number) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }

    return value.toLocaleString("en-US", {
      minimumFractionDigits: instrument.pricePrecision,
      maximumFractionDigits: instrument.pricePrecision,
    });
  };

  const formatNumber = (value?: number, decimals = 2) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }

    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const saveToHistory = async () => {
    if (!calculation) {
      return;
    }

    const item: SaveCalculatorHistoryInput = {
      id: Date.now().toString(),
      pair: selectedPair.symbol,
      direction: tradeDirection,
      balance: toNumber(accountBalance),
      risk: toNumber(riskPercent),
      stopLoss: calculation.stopDistancePips,
      takeProfit: calculation.rewardDistancePips,
      positionSize: calculation.lots,
      riskReward: calculation.rewardRiskRatio,
      timestamp: new Date(),
      riskAmount: calculation.actualRiskAmount,
      units: calculation.units,
      pipValue: calculation.pipValueInAccountCurrency,
      priceSource: orderType === "market" ? "live_market_quote" : "manual_entry",
      spreadPips: null,
    };

    try {
      await saveCalculatorHistory(item, user?.id);
      toast.success("Calculation saved");
    } catch (error) {
      console.error("[calculator-history] Failed to save sizing history", error);
      toast.error("Could not save sizing history");
    }
  };

  const resultSummary = [
    {
      label: "Risk Amount",
      value: formatNumber(calculation?.actualRiskAmount, 2),
    },
    {
      label: "R:R",
      value: calculation
        ? `1:${formatNumber(calculation.rewardRiskRatio, 2)}`
        : "—",
    },
    {
      label: "Stop Loss",
      value: `${formatNumber(calculation?.stopDistancePips, 1)} pips`,
    },
    {
      label: "Pip Value",
      value: formatNumber(calculation?.pipValueInAccountCurrency, 2),
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] pb-32 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.07),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.04),_transparent_22%)]" />

      <main className="relative mx-auto max-w-[32rem] px-4 pb-8 pt-10">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-[0_16px_34px_-20px_rgba(255,255,255,0.7)]">
              <CalculatorIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-[2.45rem] font-semibold tracking-[-0.05em] text-white">
                Position Size
              </h1>
              <p className="text-lg text-white/55">Calculator</p>
            </div>
          </div>

          <button
            onClick={() => navigate(user ? "/profile" : "/signin")}
            className="mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.08] text-white/85 transition active:scale-95"
            aria-label={user ? "Open profile" : "Open sign in"}
          >
            <User className="h-7 w-7" />
          </button>
        </header>

        {appliedSignal ? (
          <button
            onClick={() => setAppliedSignal(null)}
            className="mb-4 flex w-full items-center justify-between rounded-[1.8rem] border border-emerald-500/10 bg-emerald-500/8 px-5 py-4 text-left"
          >
            <div>
              <p className="text-sm font-semibold text-emerald-300">Signal Applied</p>
              <p className="mt-1 text-sm text-white/70">
                {appliedSignal.symbol} pre-filled the calculator.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.18em] text-white/45">Dismiss</span>
          </button>
        ) : (
          <button
            onClick={() => navigate("/signals")}
            className="mb-4 flex w-full items-center justify-between rounded-[1.8rem] border border-white/10 bg-white/[0.05] px-5 py-4 text-left transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Trading Signals</p>
                <p className="text-sm text-white/55">Apply a signal to pre-fill this calculator</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/45" />
          </button>
        )}

        <section className="space-y-4">
          <button
            onClick={() => setShowCurrencyGrid(true)}
            className="flex w-full items-center justify-between rounded-[2rem] border border-white/10 bg-white/[0.07] px-5 py-5 text-left shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)] transition active:scale-[0.99]"
          >
            <div>
              <p className="text-[1rem] text-white/45">Currency Pair</p>
              <p className="mt-2 text-[2.1rem] font-semibold tracking-[-0.05em] text-white">
                {selectedPair.symbol}
              </p>
            </div>
            <ChevronRight className="h-6 w-6 text-white/45" />
          </button>

          <label className="block rounded-[2rem] border border-white/10 bg-white/[0.07] px-5 py-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]">
            <span className="text-[1rem] text-white/45">Account Balance</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={accountBalance}
              onChange={(event) => setAccountBalance(event.target.value)}
              placeholder="Tap to enter"
              className="mt-2 h-11 w-full bg-transparent text-[2.1rem] font-semibold tracking-[-0.05em] text-white outline-none placeholder:text-white/35"
            />
          </label>

          <section>
            <p className="mb-3 text-[1rem] text-white/55">Risk Percentage</p>
            <div className="grid grid-cols-5 gap-3">
              {riskPresets.map((preset) => {
                const active = riskPercent === preset;
                return (
                  <button
                    key={preset}
                    onClick={() => setRiskPercent(preset)}
                    className={`min-h-[4.4rem] rounded-[1.55rem] text-xl font-semibold transition active:scale-95 ${
                      active
                        ? "bg-white text-black"
                        : "bg-white/[0.08] text-white"
                    }`}
                  >
                    {preset}%
                  </button>
                );
              })}
              <button
                className={`min-h-[4.4rem] rounded-[1.55rem] text-xl font-semibold transition ${
                  !riskPresets.includes(riskPercent) ? "bg-white text-black" : "bg-white/[0.08] text-white"
                }`}
              >
                Custom
              </button>
            </div>
          </section>

          <section>
            <p className="mb-3 text-[1rem] text-white/55">Trade Direction</p>
            <div className="grid grid-cols-2 gap-3">
              {(["buy", "sell"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setTradeDirection(side)}
                  className={`min-h-[4.8rem] rounded-[1.75rem] text-[2rem] font-semibold tracking-[-0.04em] transition active:scale-95 ${
                    tradeDirection === side
                      ? "bg-white text-black"
                      : "bg-white/[0.08] text-white"
                  }`}
                >
                  {side[0].toUpperCase() + side.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[1rem] text-white/45">Order Mode</p>
                <p className="text-sm text-white/55">
                  Manual works offline. Market uses optional live quotes.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-full bg-black/25 p-1">
                {(["limit", "market"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setOrderType(value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      orderType === value ? "bg-white text-black" : "text-white/60"
                    }`}
                  >
                    {value === "limit" ? "Manual" : "Market"}
                  </button>
                ))}
              </div>
            </div>

            {orderType === "limit" ? (
              <label className="mb-4 block rounded-[1.7rem] border border-white/10 bg-black/20 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Entry Price
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step={instrument.pipSize}
                  value={entryPrice}
                  onChange={(event) => setEntryPrice(event.target.value)}
                  placeholder={formatPrice(currentMidPrice)}
                  className="mt-3 h-11 w-full bg-transparent text-[2rem] font-semibold tracking-[-0.05em] text-white outline-none placeholder:text-white/20"
                />
              </label>
            ) : (
              <div className="mb-4 rounded-[1.7rem] border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[1rem] text-white/45">Execution Price</p>
                    <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-white">
                      {tradeDirection === "buy" ? "Ask" : "Bid"}: {formatPrice(executionPrice)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/[0.08] px-4 py-2 text-sm font-semibold uppercase text-white">
                    {tradeDirection}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/55">
                  {pricesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  <span>
                    {quoteStatusMessage}
                    {currentPairUpdatedAt ? ` • ${formatShortTime(currentPairUpdatedAt)}` : ""}
                  </span>
                </div>
                {pricesError ? (
                  <p className="mt-2 text-sm text-red-300/80">{pricesError}</p>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <StopLossSelector
                label="Stop Loss"
                value={stopLossPrice}
                onChange={setStopLossPrice}
                placeholder="—"
                step={instrument.pipSize}
                accent="danger"
              />
              <StopLossSelector
                label="Take Profit"
                value={takeProfitPrice}
                onChange={setTakeProfitPrice}
                placeholder="—"
                step={instrument.pipSize}
              />
            </div>
          </section>

          <section className="rounded-[2.4rem] bg-white p-6 text-black shadow-[0_22px_55px_-30px_rgba(255,255,255,0.28)]">
            <div className="text-center">
              <p className="text-[1rem] text-black/55">Position Size</p>
              <p className="mt-3 text-[3.3rem] font-semibold tracking-[-0.07em]">
                {formatNumber(calculation?.lots)}
              </p>
              <p className="text-sm font-medium text-black/55">lots</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {resultSummary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.4rem] bg-black/[0.04] p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.04em]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] bg-black/[0.04] p-4 text-sm leading-6 text-black/60">
              {calculation
                ? calculation.isBelowMinimumLot
                  ? "Risk is below the broker minimum lot size for this instrument."
                  : `Sizing uses ${currentPairSource ?? "manual"} data and ${instrument.name}.`
                : "Enter balance, risk, and price levels to calculate the trade size."}
            </div>

            <button
              onClick={saveToHistory}
              disabled={!canSave}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-[1.6rem] bg-black text-lg font-semibold text-white transition active:scale-[0.99] disabled:opacity-40"
            >
              {canSave ? saveLabel : "Complete Required Inputs"}
            </button>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-black/55">
              <span>{quoteStatusMessage}</span>
              <button
                onClick={() => navigate("/journal")}
                className="inline-flex items-center gap-1 font-medium text-black"
              >
                Journal
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-white/70" />
              <p className="text-sm font-semibold text-white">Instrument Details</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-white/60">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Model</p>
                <p className="mt-1 text-base font-medium text-white">{instrument.name}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Contract</p>
                <p className="mt-1 text-base font-medium text-white">
                  {formatNumber(instrument.contractSize, 0)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Min Lot</p>
                <p className="mt-1 text-base font-medium text-white">
                  {formatNumber(instrument.minLot, 2)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Quote Status</p>
                <p className="mt-1 text-base font-medium capitalize text-white">
                  {currentPairStatus}
                </p>
              </div>
            </div>
          </section>
        </section>
      </main>

      {showCurrencyGrid ? (
        <CurrencyGrid
          selectedPair={selectedPair}
          pairs={CALCULATOR_PAIRS}
          onSelect={setSelectedPair}
          onBack={() => setShowCurrencyGrid(false)}
        />
      ) : null}
    </div>
  );
};
