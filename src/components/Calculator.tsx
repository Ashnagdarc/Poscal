import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator as CalculatorIcon, ChevronRight, Loader2, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CurrencyGrid } from "./CurrencyGrid";
import { useAuth } from "@/contexts/AuthContext";
import { type CurrencyPair } from "@/lib/currencyPairs";
import { useRealtimePrices } from "@/hooks/use-realtime-prices";
import { saveCalculatorHistory } from "@/lib/calculatorHistory";
import { BROKER_PROFILES, resolveInstrumentForBroker } from "@/domain/brokers";
import { listSupportedInstruments } from "@/domain/instruments";
import { calculatePositionSize } from "@/domain/positionSizing";
import type { BrokerProfile, OrderType, ResolvedInstrument, TradeSide } from "@/domain/types";
import { loadBrokerProfiles, toCalculatorBrokerProfiles } from "@/lib/convexBrokerProfiles";
import { loadUserSettings } from "@/lib/convexUserSettings";
import { toast } from "sonner";

const CALCULATOR_PAIRS: CurrencyPair[] = listSupportedInstruments()
  .filter((instrument) => instrument.quoteCurrency === "USD" || instrument.baseCurrency === "USD")
  .map((instrument) => ({
    symbol: instrument.symbol,
    pipDecimal: instrument.pipPrecision,
  }));

const DEFAULT_PAIR = CALCULATOR_PAIRS[0];

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildTrustBadge = (status: "fresh" | "stale" | "unavailable", source: string | null | undefined) => {
  if (status === "fresh") {
    return {
      label: `Fresh${source ? ` • ${source.replaceAll("_", " ")}` : ""}`,
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }

  if (status === "stale") {
    return {
      label: "Stale",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  return {
    label: "Unavailable",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  };
};

export interface HistoryItem {
  id: string;
  pair: string;
  direction?: "buy" | "sell";
  balance: number;
  risk: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskReward: number;
  timestamp: Date;
}

export const Calculator = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const [selectedPair, setSelectedPair] = useState<CurrencyPair>(DEFAULT_PAIR);
  const [selectedBrokerId, setSelectedBrokerId] = useState(BROKER_PROFILES[0]?.id ?? "paper");
  const [availableBrokers, setAvailableBrokers] = useState<BrokerProfile[]>(BROKER_PROFILES);
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [tradeDirection, setTradeDirection] = useState<TradeSide>("buy");
  const [accountBalance, setAccountBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState("1");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [showCurrencyGrid, setShowCurrencyGrid] = useState(false);
  const [showCustomRisk, setShowCustomRisk] = useState(false);
  const [customRiskInput, setCustomRiskInput] = useState("");

  const riskPresets = [0.5, 1, 2, 3];

  useEffect(() => {
    if (!CALCULATOR_PAIRS.some((pair) => pair.symbol === selectedPair.symbol)) {
      setSelectedPair(DEFAULT_PAIR);
    }
  }, [selectedPair.symbol]);

  useEffect(() => {
    const syncCalculatorDefaults = async () => {
      const settings = await loadUserSettings(session?.access_token);
      if (typeof settings.defaultRiskPercent === "number" && settings.defaultRiskPercent > 0) {
        setRiskPercent(String(settings.defaultRiskPercent));
      }

      const savedProfiles = await loadBrokerProfiles(session?.access_token);
      setAvailableBrokers([...BROKER_PROFILES, ...toCalculatorBrokerProfiles(savedProfiles)]);
    };

    void syncCalculatorDefaults();
  }, [session?.access_token]);

  useEffect(() => {
    if (!availableBrokers.some((candidate) => candidate.id === selectedBrokerId)) {
      setSelectedBrokerId(availableBrokers[0]?.id ?? "paper");
    }
  }, [availableBrokers, selectedBrokerId]);

  const broker = useMemo<BrokerProfile>(() => {
    return availableBrokers.find((candidate) => candidate.id === selectedBrokerId) ?? availableBrokers[0] ?? BROKER_PROFILES[0];
  }, [availableBrokers, selectedBrokerId]);

  const instrument = useMemo<ResolvedInstrument>(() => {
    return resolveInstrumentForBroker(broker, selectedPair.symbol);
  }, [broker, selectedPair.symbol]);

  const liveQuoteEnabled = orderType === "market";
  const symbolsToFetch = liveQuoteEnabled ? [selectedPair.symbol] : [];
  const {
    prices,
    askPrices,
    bidPrices,
    quoteSourceBySymbol,
    priceStatus,
    updatedAtBySymbol,
    loading: pricesLoading,
  } = useRealtimePrices({
    symbols: symbolsToFetch,
    enabled: liveQuoteEnabled,
    pollIntervalMs: 20000,
    staleAfterMs: 45000,
    allowFallback: true,
  });

  const currentMidPrice = prices[selectedPair.symbol];
  const currentAskPrice = askPrices[selectedPair.symbol];
  const currentBidPrice = bidPrices[selectedPair.symbol];
  const currentPairStatus = liveQuoteEnabled ? (priceStatus[selectedPair.symbol] ?? "unavailable") : "fresh";
  const currentPairSource = liveQuoteEnabled ? quoteSourceBySymbol[selectedPair.symbol] : "manual";
  const currentPairUpdatedAt = liveQuoteEnabled ? updatedAtBySymbol[selectedPair.symbol] : null;
  const trustBadge = buildTrustBadge(currentPairStatus, currentPairSource);

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
        marketQuote: orderType === "market"
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

  const canCalculate = calculation !== null;
  const canSave = calculation !== null && calculation.lots > 0;
  const executionPrice = calculation?.entryPrice;
  const quoteStatusMessage = orderType === "market"
    ? (
      currentPairStatus === "fresh"
        ? "Market sizing uses the optional public quote feed."
        : currentPairStatus === "stale"
          ? "Market quote is stale. Refresh before placing a live order."
          : "Market quote is unavailable. Switch to manual entry or wait for a quote."
    )
    : "Limit sizing is fully local and deterministic.";

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

    const historyItem: HistoryItem = {
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
    };

    try {
      await saveCalculatorHistory({
        ...historyItem,
        riskAmount: calculation.actualRiskAmount,
        units: calculation.units,
        pipValue: calculation.pipValueInAccountCurrency,
        priceSource: orderType === "market" ? "live_market_quote" : "manual_entry",
        spreadPips: null,
      }, user?.id);
      toast.success("Saved to history");
    } catch (error) {
      console.error("[calculator-history] Failed to save sizing history", error);
      toast.error("Could not save sizing history");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center shadow-md shadow-foreground/20">
              <CalculatorIcon className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Position Size</h1>
              <p className="text-xs text-muted-foreground">Deterministic calculator</p>
            </div>
          </div>
          <button
            onClick={() => navigate(user ? "/profile" : "/signin")}
            className="w-10 h-10 bg-secondary/80 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all active:scale-95 hover:bg-secondary"
          >
            <User className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-8 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary p-4">
              <p className="mb-3 text-xs text-muted-foreground">Broker</p>
              <div className="grid grid-cols-3 gap-2">
                {availableBrokers.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedBrokerId(profile.id)}
                    className={`h-11 rounded-xl px-3 text-sm font-semibold transition-all active:scale-95 ${
                      selectedBrokerId === profile.id
                        ? "bg-foreground text-background"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {profile.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowCurrencyGrid(true)}
              className="w-full bg-secondary rounded-2xl p-4 flex items-center justify-between transition-all duration-200 active:scale-[0.98]"
            >
              <div className="text-left">
                <p className="text-xs text-muted-foreground mb-1">Symbol</p>
                <p className="text-lg font-bold text-foreground">{selectedPair.symbol}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>

            <div className="rounded-2xl bg-secondary p-4">
              <p className="mb-3 text-xs text-muted-foreground">Order Type</p>
              <div className="grid grid-cols-2 gap-2">
                {(["limit", "market"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setOrderType(value)}
                    className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                      orderType === value ? "bg-foreground text-background" : "bg-background text-foreground"
                    }`}
                  >
                    {value === "limit" ? "Manual Entry" : "Market"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-secondary p-4">
              <p className="mb-3 text-xs text-muted-foreground">Direction</p>
              <div className="grid grid-cols-2 gap-2">
                {(["buy", "sell"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setTradeDirection(value)}
                    className={`h-11 rounded-xl text-sm font-semibold uppercase transition-all active:scale-95 ${
                      tradeDirection === value ? "bg-foreground text-background" : "bg-background text-foreground"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-secondary p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs text-muted-foreground">Balance ({broker.accountCurrency})</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={accountBalance}
                    onChange={(event) => setAccountBalance(event.target.value)}
                    placeholder="10000"
                    className="h-12 w-full rounded-xl bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-muted-foreground">Risk %</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    step="0.1"
                    value={riskPercent}
                    onChange={(event) => setRiskPercent(event.target.value)}
                    placeholder="1"
                    className="h-12 w-full rounded-xl bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-3">Quick Risk</p>
                <div className="flex gap-2">
                  {riskPresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setRiskPercent(String(preset));
                        setShowCustomRisk(false);
                      }}
                      className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                        Number(riskPercent) === preset && !showCustomRisk
                          ? "bg-foreground text-background"
                          : "bg-background text-foreground"
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCustomRisk((current) => !current)}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                      showCustomRisk || !riskPresets.includes(Number(riskPercent))
                        ? "bg-foreground text-background"
                        : "bg-background text-foreground"
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {showCustomRisk && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      max="100"
                      step="0.1"
                      value={customRiskInput}
                      onChange={(event) => setCustomRiskInput(event.target.value)}
                      placeholder="Risk %"
                      className="h-11 flex-1 rounded-xl bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                    <button
                      onClick={() => {
                        const nextValue = Number(customRiskInput);
                        if (nextValue > 0 && nextValue <= 100) {
                          setRiskPercent(String(nextValue));
                          setCustomRiskInput("");
                          setShowCustomRisk(false);
                        }
                      }}
                      className="h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-all active:scale-95"
                    >
                      Set
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary p-4 space-y-4">
              {orderType === "limit" ? (
                <label className="space-y-2">
                  <span className="text-xs text-muted-foreground">Entry Price</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={instrument.pipSize}
                    value={entryPrice}
                    onChange={(event) => setEntryPrice(event.target.value)}
                    placeholder={formatPrice(currentMidPrice)}
                    className="h-12 w-full rounded-xl bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </label>
              ) : (
                <div className="rounded-xl bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Live Execution Price</p>
                      <p className="text-base font-semibold text-foreground">
                        {tradeDirection === "buy" ? "Ask" : "Bid"}: {formatPrice(executionPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pricesLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      <Badge variant="outline" className={trustBadge.className}>
                        {trustBadge.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {quoteStatusMessage}
                    {currentPairUpdatedAt ? ` • Updated ${currentPairUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs text-muted-foreground">Stop Loss</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={instrument.pipSize}
                    value={stopLossPrice}
                    onChange={(event) => setStopLossPrice(event.target.value)}
                    placeholder="1.0950"
                    className="h-12 w-full rounded-xl bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-muted-foreground">Take Profit</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={instrument.pipSize}
                    value={takeProfitPrice}
                    onChange={(event) => setTakeProfitPrice(event.target.value)}
                    placeholder="1.1100"
                    className="h-12 w-full rounded-xl bg-background px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </label>
              </div>

              <div className="rounded-xl bg-background p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Instrument Model</p>
                    <p className="text-sm font-semibold text-foreground">{instrument.name}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Contract {formatNumber(instrument.contractSize, 0)}</p>
                    <p>Min lot {formatNumber(instrument.minLot, 2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-foreground text-background rounded-3xl p-6">
              <div className="text-center mb-5">
                <p className="text-sm font-medium opacity-60 mb-1">Position Size</p>
                <p className="text-5xl font-bold tracking-tight">
                  {formatNumber(calculation?.lots)}
                </p>
                <p className="text-lg font-medium opacity-80 mt-1">lots</p>
              </div>

              <div className="h-px bg-background/20 my-4" />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-xs font-medium opacity-60 mb-1">Risk Amount</p>
                  <p className="text-xl font-semibold">
                    {formatNumber(calculation?.riskAmount, 2)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium opacity-60 mb-1">Actual Risk</p>
                  <p className="text-xl font-semibold">
                    {formatNumber(calculation?.actualRiskAmount, 2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xs font-medium opacity-60 mb-1">Units</p>
                  <p className="text-xl font-semibold">{formatNumber(calculation?.units, 0)}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Target className="w-3 h-3 opacity-60" />
                    <p className="text-xs font-medium opacity-60">R:R Ratio</p>
                  </div>
                  <p className="text-xl font-semibold">
                    {calculation ? `1:${formatNumber(calculation.rewardRiskRatio, 2)}` : "—"}
                  </p>
                </div>
              </div>

              <div className="h-px bg-background/20 my-4" />

              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xs font-medium opacity-60 mb-1">Stop Distance</p>
                  <p className="text-lg font-semibold">{formatNumber(calculation?.stopDistancePips, 1)} pips</p>
                </div>
                <div>
                  <p className="text-xs font-medium opacity-60 mb-1">Pip Value</p>
                  <p className="text-lg font-semibold">{formatNumber(calculation?.pipValueInAccountCurrency, 2)}</p>
                </div>
              </div>

              {!canCalculate && (
                <p className="mt-4 text-center text-sm opacity-70">
                  Enter balance, risk, entry, stop loss, and take profit to size the trade.
                </p>
              )}

              {calculation?.isBelowMinimumLot && (
                <p className="mt-4 text-center text-sm text-amber-200">
                  Risk is below the broker minimum lot size for this instrument.
                </p>
              )}
            </div>

            <button
              onClick={saveToHistory}
              disabled={!canSave}
              className="w-full h-12 bg-secondary text-foreground font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {canSave ? "Save to History" : "Complete Required Inputs"}
            </button>

            <p className="text-xs text-muted-foreground">
              {quoteStatusMessage}
            </p>
          </div>
        </div>
      </main>

      {showCurrencyGrid && (
        <CurrencyGrid
          selectedPair={selectedPair}
          pairs={CALCULATOR_PAIRS}
          onSelect={setSelectedPair}
          onBack={() => setShowCurrencyGrid(false)}
        />
      )}
    </div>
  );
};
