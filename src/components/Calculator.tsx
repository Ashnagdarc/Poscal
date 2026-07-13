import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calculator as CalculatorIcon, 
  TrendingDown, 
  TrendingUp,
  ChevronRight,
  Target,
  User,
  X
} from "lucide-react";
import { NumPad } from "./NumPad";
import { CurrencyGrid, FEATURED_CURRENCY_PAIRS, CurrencyPair } from "./CurrencyGrid";
import { StopLossSelector } from "./StopLossSelector";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { saveCalculatorHistory } from "@/lib/calculatorHistory";
import { calculatePositionSize } from "@/lib/positionSizeCalculator";
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

export const Calculator = () => {
  const navigate = useNavigate();
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
    if (!FEATURED_CURRENCY_PAIRS.some((pair) => pair.symbol === selectedPair.symbol)) {
      setSelectedPair(FEATURED_CURRENCY_PAIRS[0]);
    }
  }, [selectedPair.symbol]);

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
      entryPrice: calculationMode === "price" ? parseFloat(entryPrice) || null : null,
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

  const saveToHistory = async () => {
    if (!calculation.isValid || calculation.positionSize <= 0) return;

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
      await saveCalculatorHistory({
        ...newItem,
        riskAmount: calculation.riskAmount,
        units: calculation.units,
        pipValue: calculation.pipValue,
        priceSource: "local_instrument_spec",
        spreadPips: null,
      }, user?.id);
      toast.success("Saved to history");
    } catch (error) {
      console.error("[calculator-history] Failed to save to Convex, falling back to local history", error);
      await saveCalculatorHistory({
        ...newItem,
        riskAmount: calculation.riskAmount,
        units: calculation.units,
        pipValue: calculation.pipValue,
        priceSource: "local_instrument_spec",
        spreadPips: null,
      });
      toast.success("Saved locally");
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
    if (showNumPad === "balance") setAccountBalance(numPadValue);
    else if (showNumPad === "takeProfit") {
      if (calculationMode === "pips") setTakeProfitPips(numPadValue);
      else setTakeProfitPrice(numPadValue);
    }
    else if (showNumPad === "entryPrice") setEntryPrice(numPadValue);
    else if (showNumPad === "stopLossPrice") setStopLossPrice(numPadValue);
    else if (showNumPad === "takeProfitPrice") setTakeProfitPrice(numPadValue);
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
      ? "pips"
      : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center shadow-md shadow-foreground/20">
              <CalculatorIcon className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Position Size</h1>
              <p className="text-xs text-muted-foreground">Calculator</p>
            </div>
          </div>
          <button
            onClick={() => navigate(user ? '/profile' : '/signin')}
            className="w-10 h-10 bg-secondary/80 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all active:scale-95 hover:bg-secondary"
          >
            <User className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-8 space-y-4">
        {/* Currency Pair Selector */}
        <button
          onClick={() => setShowCurrencyGrid(true)}
          className="w-full bg-secondary rounded-2xl p-4 flex items-center justify-between transition-all duration-200 active:scale-[0.98] animate-slide-up"
        >
          <div>
            <p className="text-xs text-muted-foreground mb-1">Currency Pair</p>
            <p className="text-lg font-bold text-foreground">{selectedPair.symbol}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Account Balance */}
        <button
          onClick={() => openNumPad("balance")}
          className="w-full bg-secondary rounded-2xl p-4 flex items-center justify-between transition-all duration-200 active:scale-[0.98] animate-slide-up"
          style={{ animationDelay: "50ms" }}
        >
          <div>
            <p className="text-xs text-muted-foreground mb-1">Account Balance</p>
            <p className="text-lg font-bold text-foreground">
              {accountBalance ? `${currency.symbol}${parseFloat(accountBalance).toLocaleString()}` : "Tap to enter"}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Risk Percentage */}
        <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <p className="text-xs text-muted-foreground mb-3 ml-1">Risk Percentage</p>
          <div className="flex gap-2">
            {riskPresets.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setRiskPercent(preset);
                  setShowCustomRisk(false);
                }}
                className={`flex-1 h-12 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                  riskPercent === preset && !showCustomRisk
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground"
                }`}
              >
                {preset}%
              </button>
            ))}
            <button
              onClick={() => setShowCustomRisk(true)}
              className={`flex-1 h-12 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                showCustomRisk || !riskPresets.includes(riskPercent)
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground"
              }`}
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
                className="flex-1 h-12 px-4 bg-secondary text-foreground rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20"
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
                className="px-6 h-12 bg-foreground text-background rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
              >
                Set
              </button>
            </div>
          )}
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "125ms" }}>
          <p className="text-xs text-muted-foreground mb-3 ml-1">Trade Direction</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTradeDirection('buy')}
              className={`h-12 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                tradeDirection === 'buy'
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeDirection('sell')}
              className={`h-12 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                tradeDirection === 'sell'
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              Sell
            </button>
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "135ms" }}>
          <p className="text-xs text-muted-foreground mb-3 ml-1">Stop Loss Input</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCalculationMode("pips")}
              className={`h-12 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                calculationMode === "pips"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              Pips
            </button>
            <button
              onClick={() => setCalculationMode("price")}
              className={`h-12 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                calculationMode === "price"
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              Entry / SL
            </button>
          </div>
        </div>

        {/* Stop Loss & Take Profit */}
        {calculationMode === "pips" ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowStopLossSelector(true)}
              className="bg-secondary rounded-2xl p-4 flex flex-col items-start transition-all duration-200 active:scale-[0.98] animate-slide-up"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <p className="text-xs text-muted-foreground">Stop Loss (pips)</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {stopLossPips ? `${stopLossPips} pips` : "—"}
              </p>
            </button>

            <button
              onClick={() => openNumPad("takeProfit")}
              className="bg-secondary rounded-2xl p-4 flex flex-col items-start transition-all duration-200 active:scale-[0.98] animate-slide-up"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-foreground" />
                <p className="text-xs text-muted-foreground">Take Profit (pips)</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {takeProfitPips ? `${takeProfitPips} pips` : "—"}
              </p>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => openNumPad("entryPrice")}
              className="bg-secondary rounded-2xl p-4 flex flex-col items-start transition-all duration-200 active:scale-[0.98] animate-slide-up"
              style={{ animationDelay: "150ms" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-foreground" />
                <p className="text-xs text-muted-foreground">Entry Price</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {entryPrice || "—"}
              </p>
            </button>

            <button
              onClick={() => openNumPad("stopLossPrice")}
              className="bg-secondary rounded-2xl p-4 flex flex-col items-start transition-all duration-200 active:scale-[0.98] animate-slide-up"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <p className="text-xs text-muted-foreground">Stop-Loss Price</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {stopLossPrice || "—"}
              </p>
            </button>

            <button
              onClick={() => openNumPad("takeProfitPrice")}
              className="col-span-2 bg-secondary rounded-2xl p-4 flex flex-col items-start transition-all duration-200 active:scale-[0.98] animate-slide-up"
              style={{ animationDelay: "225ms" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-foreground" />
                <p className="text-xs text-muted-foreground">Take Profit Price</p>
              </div>
              <p className="text-lg font-bold text-foreground">
                {takeProfitPrice || "—"}
              </p>
            </button>
          </div>
        )}

        <div
          className="bg-secondary/70 rounded-2xl px-4 py-3 animate-slide-up"
          style={{ animationDelay: "225ms" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Instrument Spec</p>
              <p className="text-base font-semibold text-foreground">
                {calculation.spec
                  ? `${calculation.spec.displayName} • ${calculation.pipValue.toLocaleString("en-US", { maximumFractionDigits: 4 })} / pip`
                  : "Unsupported instrument"}
              </p>
            </div>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground">
              LOCAL
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Estimated using local instrument spec
            {calculation.warning ? ` • ${calculation.warning}` : ""}
          </p>
        </div>

        {/* Result Card */}
        <div 
          className="mt-4 animate-scale-in" 
          style={{ animationDelay: "250ms" }}
        >
          <div className="bg-foreground text-background rounded-3xl p-6">
            <div className="text-center mb-5">
              <p className="text-sm font-medium opacity-60 mb-1">Position Size</p>
              <p className="text-5xl font-bold tracking-tight">
                {formatNumber(calculation.positionSize)}
              </p>
              <p className="text-lg font-medium opacity-80 mt-1">lots</p>
            </div>

            <div className="h-px bg-background/20 my-4" />

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-xs font-medium opacity-60 mb-1">Risk Amount</p>
                <p className="text-xl font-semibold">
                  {currency.symbol}{formatNumber(calculation.actualRisk || calculation.riskAmount, 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium opacity-60 mb-1">Units</p>
                <p className="text-xl font-semibold">
                  {formatNumber(calculation.units, 0)}
                </p>
              </div>
            </div>

            {/* Risk/Reward Section */}
            {calculation.rewardToRisk > 0 && (
              <>
                <div className="h-px bg-background/20 my-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Target className="w-3 h-3 opacity-60" />
                      <p className="text-xs font-medium opacity-60">R:R Ratio</p>
                    </div>
                    <p className="text-xl font-semibold">
                      1:{formatNumber(calculation.rewardToRisk, 1)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium opacity-60 mb-1">Potential Profit</p>
                    <p className="text-xl font-semibold">
                      +{currency.symbol}{formatNumber(calculation.potentialProfit, 0)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={saveToHistory}
            disabled={!calculation.isValid || calculation.positionSize <= 0}
            className="w-full mt-4 h-12 bg-secondary text-foreground font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save to History
          </button>
        </div>
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
              selectedStopLoss={parseFloat(stopLossPips) || null}
              onSelect={(sl) => {
                setStopLossPips(sl.toString());
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
