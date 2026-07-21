import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  TrendingDown,
  TrendingUp,
  ChevronRight,
  Target,
  X,
} from "lucide-react";
import poscalLogo from "@/assets/poscal-logo.png";
import { NumPad } from "./NumPad";
import { PageHeader } from "./PageHeader";
import { UserAvatar } from "./UserAvatar";
import { CurrencyGrid, FEATURED_CURRENCY_PAIRS, CurrencyPair } from "./CurrencyGrid";
import { StopLossSelector } from "./StopLossSelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { saveJournalEntry } from "@/lib/calculatorHistory";
import { pipsToPrices, pricesToPips } from "@/lib/calculatorModeSync";
import { getStopLossUnitLabel } from "@/lib/instrumentSpecs";
import { calculatePositionSize, getInstrumentSpec } from "@/lib/positionSizeCalculator";
import { toast } from "sonner";

export interface HistoryItem {
  id: string;
  pair: string;
  direction?: 'buy' | 'sell';
  balance: number;
  risk: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskReward: number;
  timestamp: Date;
}

const normalizePrefillSymbol = (symbol: string) => {
  const normalized = symbol.trim().toUpperCase().replace(/-/g, "/");
  if (normalized.includes("/")) return normalized;
  if (normalized.length === 6) return `${normalized.slice(0, 3)}/${normalized.slice(3)}`;
  return normalized;
};

const detectPipDecimal = (symbol: string): number => {
  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes("JPY")) return 2;
  if (upperSymbol.includes("XAG")) return 3;
  if (upperSymbol.includes("XAU") || upperSymbol.includes("BTC") || upperSymbol.includes("ETH")) return 2;
  if (upperSymbol.includes("US30") || upperSymbol.includes("US100") || upperSymbol.includes("US500")) return 0;
  return 4;
};

const getDirectionFromOrderType = (orderType: string | null): "buy" | "sell" => {
  if (!orderType) return "buy";
  const normalized = orderType
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();

  return normalized.startsWith("sell") ? "sell" : "buy";
};

const normalizeOrderType = (value: string | null): "buy" | "sell" | "buy_limit" | "sell_limit" | "buy_stop" | "sell_stop" | null => {
  if (!value) return null;

  const normalized = value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/-/g, "_")
    .toLowerCase();

  switch (normalized) {
    case "buy":
    case "sell":
    case "buy_limit":
    case "sell_limit":
    case "buy_stop":
    case "sell_stop":
      return normalized;
    default:
      return null;
  }
};

export const Calculator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [accountBalance, setAccountBalance] = useState("");
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [riskPercent, setRiskPercent] = useState(1);
  const [stopLossPips, setStopLossPips] = useState("");
  const [takeProfitPips, setTakeProfitPips] = useState("");
  const [calculationMode, setCalculationMode] = useState<"pips" | "price">("pips");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [selectedPair, setSelectedPair] = useState<CurrencyPair>(FEATURED_CURRENCY_PAIRS[0]);
  
  // UI State
  const [showNumPad, setShowNumPad] = useState<"balance" | "takeProfit" | "entryPrice" | "stopLossPrice" | "takeProfitPrice" | null>(null);
  const [showCurrencyGrid, setShowCurrencyGrid] = useState(false);
  const [showStopLossSelector, setShowStopLossSelector] = useState(false);
  const [numPadValue, setNumPadValue] = useState("");

  const { currency } = useCurrency();
  
  const [showCustomRisk, setShowCustomRisk] = useState(false);
  const [customRiskInput, setCustomRiskInput] = useState("");

  useEffect(() => {
    if (
      !FEATURED_CURRENCY_PAIRS.some((pair) => pair.symbol === selectedPair.symbol) &&
      !getInstrumentSpec(selectedPair.symbol)
    ) {
      setSelectedPair(FEATURED_CURRENCY_PAIRS[0]);
    }
  }, [selectedPair.symbol]);

  useEffect(() => {
    const spec = getInstrumentSpec(selectedPair.symbol);
    const entry = parseFloat(entryPrice);
    const stopPips = parseFloat(stopLossPips);
    if (!spec || !Number.isFinite(entry) || !Number.isFinite(stopPips)) return;

    const converted = pipsToPrices({
      spec,
      direction: tradeDirection,
      entryPrice: entry,
      stopLossPips: stopPips,
      takeProfitPips: parseFloat(takeProfitPips) || null,
    });

    setStopLossPrice(converted.stopLossPrice);
    if (converted.takeProfitPrice) {
      setTakeProfitPrice(converted.takeProfitPrice);
    }
  }, [tradeDirection, selectedPair.symbol, entryPrice, stopLossPips, takeProfitPips]);

  useEffect(() => {
    const symbol = searchParams.get("symbol");
    const entry = searchParams.get("entry");
    const sl = searchParams.get("stopLoss");
    const tp = searchParams.get("takeProfit");
    const orderType = searchParams.get("orderType");

    if (!symbol || !sl) return;

    const normalizedSymbol = normalizePrefillSymbol(symbol);
    setSelectedPair({
      symbol: normalizedSymbol,
      pipDecimal: detectPipDecimal(normalizedSymbol),
    });
    setCalculationMode("price");
    setEntryPrice(entry ?? "");
    setStopLossPrice(sl);
    setTakeProfitPrice(tp ?? "");
    setTradeDirection(getDirectionFromOrderType(orderType));
  }, [searchParams]);

  const riskPresets = [0.5, 1, 2, 3];

  // Load saved settings
  useEffect(() => {
    const savedRisk = localStorage.getItem("defaultRisk");
    if (savedRisk) setRiskPercent(parseFloat(savedRisk));

    // Apply saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const calculation = useMemo(() => {
    const balance = parseFloat(accountBalance) || 0;
    return calculatePositionSize({
      symbol: selectedPair.symbol,
      accountBalance: balance,
      riskPercent,
      stopLossPips: calculationMode === "pips" ? parseFloat(stopLossPips) || null : null,
      takeProfitPips: calculationMode === "pips" ? parseFloat(takeProfitPips) || null : null,
      entryPrice: parseFloat(entryPrice) || null,
      stopLossPrice: calculationMode === "price" ? parseFloat(stopLossPrice) || null : null,
      takeProfitPrice: calculationMode === "price" ? parseFloat(takeProfitPrice) || null : null,
    });
  }, [
    accountBalance,
    riskPercent,
    stopLossPips,
    takeProfitPips,
    calculationMode,
    entryPrice,
    stopLossPrice,
    takeProfitPrice,
    selectedPair,
  ]);

  const stopLossUnit = getStopLossUnitLabel(selectedPair.symbol);

  const syncPipFieldsFromPrices = (
    nextEntry = entryPrice,
    nextStopLoss = stopLossPrice,
    nextTakeProfit = takeProfitPrice,
  ) => {
    const spec = getInstrumentSpec(selectedPair.symbol);
    const entry = parseFloat(nextEntry);
    const stop = parseFloat(nextStopLoss);
    if (!spec || !Number.isFinite(entry) || !Number.isFinite(stop)) return;

    const converted = pricesToPips({
      spec,
      entryPrice: entry,
      stopLossPrice: stop,
      takeProfitPrice: parseFloat(nextTakeProfit) || null,
    });

    setStopLossPips(String(converted.stopLossPips));
    if (converted.takeProfitPips) {
      setTakeProfitPips(String(converted.takeProfitPips));
    }
  };

  const syncPriceFieldsFromPips = (
    nextStopLossPips = stopLossPips,
    nextTakeProfitPips = takeProfitPips,
    nextEntry = entryPrice,
  ) => {
    const spec = getInstrumentSpec(selectedPair.symbol);
    const entry = parseFloat(nextEntry);
    const stopPips = parseFloat(nextStopLossPips);
    if (!spec || !Number.isFinite(entry) || !Number.isFinite(stopPips)) return;

    const converted = pipsToPrices({
      spec,
      direction: tradeDirection,
      entryPrice: entry,
      stopLossPips: stopPips,
      takeProfitPips: parseFloat(nextTakeProfitPips) || null,
    });

    setStopLossPrice(converted.stopLossPrice);
    if (converted.takeProfitPrice) {
      setTakeProfitPrice(converted.takeProfitPrice);
    }
  };

  const handleCalculationModeChange = (mode: "pips" | "price") => {
    if (mode === calculationMode) return;

    if (mode === "price") {
      const entry = parseFloat(entryPrice);
      const stopPips = parseFloat(stopLossPips);
      if (Number.isFinite(entry) && Number.isFinite(stopPips)) {
        syncPriceFieldsFromPips(stopLossPips, takeProfitPips, entryPrice);
      } else if (Number.isFinite(entry) && Number.isFinite(parseFloat(stopLossPrice))) {
        syncPipFieldsFromPrices();
      } else if (Number.isFinite(stopPips) && !Number.isFinite(entry)) {
        toast.message("Set entry price to sync pip values into prices");
      }
    } else {
      const entry = parseFloat(entryPrice);
      const stop = parseFloat(stopLossPrice);
      if (Number.isFinite(entry) && Number.isFinite(stop)) {
        syncPipFieldsFromPrices();
      }
    }

    setCalculationMode(mode);
  };

  const saveToHistory = async () => {
    if (!calculation.isValid || calculation.positionSize <= 0) return;

    const source = searchParams.get("fromSignal") === "true" ? "signal" : "manual";
    const signalId = searchParams.get("signalId");
    const prefilledOrderType = normalizeOrderType(searchParams.get("orderType"));
    const orderType = prefilledOrderType ?? tradeDirection;
    const resolvedEntryPrice = calculationMode === "price" ? parseFloat(entryPrice) || null : null;
    const resolvedStopLossPrice = calculationMode === "price" ? parseFloat(stopLossPrice) || null : null;
    const resolvedTakeProfitPrice = calculationMode === "price" ? parseFloat(takeProfitPrice) || null : null;

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      pair: selectedPair.symbol,
      direction: tradeDirection,
      balance: parseFloat(accountBalance),
      risk: riskPercent,
      stopLoss: calculation.stopLossPips,
      takeProfit: calculationMode === "pips"
        ? parseFloat(takeProfitPips) || 0
        : calculation.rewardToRisk > 0 ? calculation.stopLossPips * calculation.rewardToRisk : 0,
      positionSize: calculation.positionSize,
      riskReward: calculation.rewardToRisk,
      timestamp: new Date()
    };

    try {
      await saveJournalEntry({
        ...newItem,
        riskAmount: calculation.riskAmount,
        symbol: selectedPair.symbol,
        orderType,
        entryPrice: resolvedEntryPrice,
        stopLossPrice: resolvedStopLossPrice,
        takeProfitPrice: resolvedTakeProfitPrice,
        lotSize: calculation.positionSize,
        actualRisk: calculation.actualRisk,
        potentialProfit: calculation.potentialProfit > 0 ? calculation.potentialProfit : null,
        source,
        signalId,
      }, user?.id);
      toast.success("Saved to journal");
    } catch (error) {
      console.error("[calculator-history] Failed to save to Convex, falling back to local history", error);
      await saveJournalEntry({
        ...newItem,
        riskAmount: calculation.riskAmount,
        symbol: selectedPair.symbol,
        orderType,
        entryPrice: resolvedEntryPrice,
        stopLossPrice: resolvedStopLossPrice,
        takeProfitPrice: resolvedTakeProfitPrice,
        lotSize: calculation.positionSize,
        actualRisk: calculation.actualRisk,
        potentialProfit: calculation.potentialProfit > 0 ? calculation.potentialProfit : null,
        source,
        signalId,
      });
      toast.success("Saved to journal");
    }
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num === 0) return "—";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const openNumPad = (type: "balance" | "takeProfit" | "entryPrice" | "stopLossPrice" | "takeProfitPrice") => {
    const values = {
      balance: accountBalance,
      takeProfit: calculationMode === "pips" ? takeProfitPips : takeProfitPrice,
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
    };
    setNumPadValue(values[type]);
    setShowNumPad(type);
  };

  const handleNumPadDone = () => {
    let nextEntry = entryPrice;
    let nextStopLoss = stopLossPrice;
    let nextTakeProfit = takeProfitPrice;
    let nextStopLossPips = stopLossPips;
    let nextTakeProfitPips = takeProfitPips;

    if (showNumPad === "balance") setAccountBalance(numPadValue);
    else if (showNumPad === "takeProfit") {
      if (calculationMode === "pips") {
        nextTakeProfitPips = numPadValue;
        setTakeProfitPips(numPadValue);
      } else {
        nextTakeProfit = numPadValue;
        setTakeProfitPrice(numPadValue);
      }
    } else if (showNumPad === "entryPrice") {
      nextEntry = numPadValue;
      setEntryPrice(numPadValue);
    } else if (showNumPad === "stopLossPrice") {
      nextStopLoss = numPadValue;
      setStopLossPrice(numPadValue);
    } else if (showNumPad === "takeProfitPrice") {
      nextTakeProfit = numPadValue;
      setTakeProfitPrice(numPadValue);
    }

    if (showNumPad === "entryPrice" || showNumPad === "stopLossPrice" || showNumPad === "takeProfitPrice") {
      syncPipFieldsFromPrices(nextEntry, nextStopLoss, nextTakeProfit);
    } else if (showNumPad === "takeProfit" && calculationMode === "pips") {
      syncPriceFieldsFromPips(nextStopLossPips, nextTakeProfitPips, nextEntry);
    }

    setShowNumPad(null);
    setNumPadValue("");
  };

  const numPadLabel = {
    balance: "Account Balance",
    takeProfit: calculationMode === "pips" ? "Take Profit" : "Take Profit Price",
    entryPrice: "Entry Price",
    stopLossPrice: "Stop-Loss Price",
    takeProfitPrice: "Take Profit Price",
  }[showNumPad ?? "balance"];

  const numPadSuffix = showNumPad === "balance"
    ? currency.code
    : showNumPad === "takeProfit" && calculationMode === "pips"
      ? stopLossUnit
      : "";

  const toggleClass = (active: boolean) =>
    `h-11 flex-1 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] ${
      active ? "bg-brand text-brand-foreground" : "bg-secondary text-foreground"
    }`;

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title="Poscal"
        subtitle="Position size"
        logoSrc={poscalLogo}
        actions={
          <button
            onClick={() => navigate(user ? "/profile" : "/signin")}
            className="rounded-full transition-transform active:scale-95"
            aria-label={user ? "Open profile" : "Sign in"}
          >
            <UserAvatar
              size="sm"
              name={user?.full_name}
              email={user?.email}
              src={user?.avatar_url}
              className="rounded-xl"
            />
          </button>
        }
      />

      <main className="mx-auto w-full max-w-2xl px-6 pb-32 md:max-w-3xl">
        {/* Result first — hero outcome */}
        <section className="animate-scale-in mb-6">
          <div className="rounded-3xl bg-foreground px-6 py-7 text-background">
            <p className="mb-1 text-center text-sm font-medium opacity-60">Position size</p>
            <p className="text-center font-display text-5xl font-bold tracking-tight">
              {formatNumber(calculation.positionSize)}
            </p>
            <p className="mt-1 text-center text-lg font-medium opacity-80">lots</p>

            <div className="my-5 h-px bg-background/20" />

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="mb-1 text-xs font-medium opacity-60">Risk</p>
                <p className="text-lg font-semibold">
                  {currency.symbol}
                  {formatNumber(calculation.actualRisk || calculation.riskAmount, 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="mb-1 text-xs font-medium opacity-60">Units</p>
                <p className="text-lg font-semibold">{formatNumber(calculation.units, 0)}</p>
              </div>
            </div>

            {calculation.rewardToRisk > 0 && (
              <>
                <div className="my-5 h-px bg-background/20" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="mb-1 flex items-center justify-center gap-1">
                      <Target className="h-3 w-3 opacity-60" />
                      <p className="text-xs font-medium opacity-60">R:R</p>
                    </div>
                    <p className="text-lg font-semibold">1:{formatNumber(calculation.rewardToRisk, 1)}</p>
                  </div>
                  <div className="text-center">
                    <p className="mb-1 text-xs font-medium opacity-60">Potential</p>
                    <p className="text-lg font-semibold">
                      +{currency.symbol}
                      {formatNumber(calculation.potentialProfit, 0)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={saveToHistory}
            disabled={!calculation.isValid || calculation.positionSize <= 0}
            className="mt-3 h-12 w-full rounded-xl bg-brand font-semibold text-brand-foreground transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save to Journal
          </button>

          {calculation.wasMinLotClamped && (
            <p className="mt-3 rounded-xl bg-secondary px-4 py-3 text-center text-xs text-muted-foreground">
              Minimum lot size ({formatNumber(calculation.spec?.minLot ?? 0.01)} lots) caps actual risk at{" "}
              {currency.symbol}
              {formatNumber(calculation.actualRisk, 0)} instead of{" "}
              {currency.symbol}
              {formatNumber(calculation.riskAmount, 0)}.
            </p>
          )}
        </section>

        {/* Primary inputs — one grouped composition */}
        <section className="animate-slide-up space-y-1 overflow-hidden rounded-2xl bg-secondary">
          <button
            onClick={() => setShowCurrencyGrid(true)}
            className="flex w-full items-center justify-between px-4 py-3.5 transition-colors active:bg-secondary/80"
          >
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Pair</p>
              <p className="text-base font-bold text-foreground">{selectedPair.symbol}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="mx-4 h-px bg-border/60" />
          <button
            onClick={() => openNumPad("balance")}
            className="flex w-full items-center justify-between px-4 py-3.5 transition-colors active:bg-secondary/80"
          >
            <div className="text-left">
              <p className="text-xs text-muted-foreground">Account balance</p>
              <p className="text-base font-bold text-foreground">
                {accountBalance
                  ? `${currency.symbol}${parseFloat(accountBalance).toLocaleString()}`
                  : "Tap to enter"}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </section>

        <section className="mt-5 animate-slide-up" style={{ animationDelay: "40ms" }}>
          <p className="mb-2 ml-1 text-xs text-muted-foreground">Risk %</p>
          <div className="flex gap-2">
            {riskPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setRiskPercent(preset);
                  setShowCustomRisk(false);
                }}
                className={toggleClass(riskPercent === preset && !showCustomRisk)}
              >
                {preset}%
              </button>
            ))}
            <button
              onClick={() => setShowCustomRisk(true)}
              className={toggleClass(showCustomRisk || !riskPresets.includes(riskPercent))}
            >
              {showCustomRisk || !riskPresets.includes(riskPercent) ? `${riskPercent}%` : "Custom"}
            </button>
          </div>
          {showCustomRisk && (
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                value={customRiskInput}
                onChange={(e) => setCustomRiskInput(e.target.value)}
                placeholder="Enter risk %"
                className="h-11 flex-1 rounded-xl bg-secondary px-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
                autoFocus
                min="0.1"
                max="100"
                step="0.1"
              />
              <button
                onClick={() => {
                  const value = parseFloat(customRiskInput);
                  if (value > 0 && value <= 100) {
                    setRiskPercent(value);
                    setShowCustomRisk(false);
                    setCustomRiskInput("");
                  }
                }}
                disabled={!customRiskInput || parseFloat(customRiskInput) <= 0}
                className="h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background transition-all active:scale-95 disabled:opacity-50"
              >
                Set
              </button>
            </div>
          )}
        </section>

        <section className="mt-5 grid grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "60ms" }}>
          <div>
            <p className="mb-2 ml-1 text-xs text-muted-foreground">Direction</p>
            <div className="flex gap-2">
              <button onClick={() => setTradeDirection("buy")} className={toggleClass(tradeDirection === "buy")}>
                Buy
              </button>
              <button onClick={() => setTradeDirection("sell")} className={toggleClass(tradeDirection === "sell")}>
                Sell
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 ml-1 text-xs text-muted-foreground">SL input</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCalculationModeChange("pips")}
                className={toggleClass(calculationMode === "pips")}
              >
                Pips
              </button>
              <button
                type="button"
                onClick={() => handleCalculationModeChange("price")}
                className={toggleClass(calculationMode === "price")}
              >
                Price
              </button>
            </div>
          </div>
        </section>

        <section className="mt-5 animate-slide-up" style={{ animationDelay: "80ms" }}>
          {calculationMode === "pips" ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowStopLossSelector(true)}
                className="flex flex-col items-start rounded-2xl bg-secondary p-4 transition-all active:scale-[0.98]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <p className="text-xs text-muted-foreground">Stop loss</p>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {stopLossPips ? `${stopLossPips} ${stopLossUnit}` : "—"}
                </p>
              </button>
              <button
                onClick={() => openNumPad("takeProfit")}
                className="flex flex-col items-start rounded-2xl bg-secondary p-4 transition-all active:scale-[0.98]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand" />
                  <p className="text-xs text-muted-foreground">Take profit</p>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {takeProfitPips ? `${takeProfitPips} ${stopLossUnit}` : "—"}
                </p>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openNumPad("entryPrice")}
                className="flex flex-col items-start rounded-2xl bg-secondary p-4 transition-all active:scale-[0.98]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-foreground" />
                  <p className="text-xs text-muted-foreground">Entry</p>
                </div>
                <p className="text-lg font-bold text-foreground">{entryPrice || "—"}</p>
              </button>
              <button
                onClick={() => openNumPad("stopLossPrice")}
                className="flex flex-col items-start rounded-2xl bg-secondary p-4 transition-all active:scale-[0.98]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <p className="text-xs text-muted-foreground">Stop loss</p>
                </div>
                <p className="text-lg font-bold text-foreground">{stopLossPrice || "—"}</p>
              </button>
              <button
                onClick={() => openNumPad("takeProfitPrice")}
                className="col-span-2 flex flex-col items-start rounded-2xl bg-secondary p-4 transition-all active:scale-[0.98]"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Target className="h-4 w-4 text-brand" />
                  <p className="text-xs text-muted-foreground">Take profit</p>
                </div>
                <p className="text-lg font-bold text-foreground">{takeProfitPrice || "—"}</p>
              </button>
            </div>
          )}
        </section>

        <p className="mt-4 px-1 text-xs text-muted-foreground">
          {calculation.spec
            ? `${calculation.spec.displayName} · ${calculation.pipValue.toLocaleString("en-US", { maximumFractionDigits: 4 })} / ${stopLossUnit} · SL ${formatNumber(calculation.stopLossPips, 1)} ${stopLossUnit}`
            : "Unsupported instrument"}
          {calculation.warning ? ` · ${calculation.warning}` : ""}
        </p>
      </main>

      {/* NumPad Overlay */}
      {showNumPad && (
        <NumPad
          value={numPadValue}
          onChange={setNumPadValue}
          onDone={handleNumPadDone}
          label={numPadLabel}
          suffix={numPadSuffix}
        />
      )}

      {/* Currency Grid Overlay */}
      {showCurrencyGrid && (
        <CurrencyGrid
          selectedPair={selectedPair}
          onSelect={setSelectedPair}
          onBack={() => setShowCurrencyGrid(false)}
        />
      )}

      {/* Stop Loss Selector Modal */}
      {showStopLossSelector && (
        <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
          {/* Header */}
          <header className="pt-12 pb-4 px-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Select Stop Loss</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Risk: {currency.symbol}{formatNumber((parseFloat(accountBalance) || 0) * riskPercent / 100, 0)} ({riskPercent}%)
                </p>
              </div>
              <button
                onClick={() => setShowStopLossSelector(false)}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-all active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Stop Loss List */}
          <div className="flex-1 overflow-hidden">
            <StopLossSelector
              symbol={selectedPair.symbol}
              unitLabel={stopLossUnit}
              selectedStopLoss={parseFloat(stopLossPips) || null}
              onSelect={(sl) => {
                setStopLossPips(sl.toString());
                syncPriceFieldsFromPips(sl.toString(), takeProfitPips, entryPrice);
                setShowStopLossSelector(false);
              }}
              accountBalance={parseFloat(accountBalance) || 0}
              riskPercent={riskPercent}
            />
          </div>
        </div>
      )}
    </div>
  );
};
