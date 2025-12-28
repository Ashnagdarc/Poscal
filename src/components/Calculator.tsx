import { useState, useMemo, useEffect } from "react";
import { 
  Calculator as CalculatorIcon, 
  TrendingDown, 
  TrendingUp,
  ChevronRight,
  History,
  Settings as SettingsIcon,
  Target
} from "lucide-react";
import { NumPad } from "./NumPad";
import { CurrencyGrid, CURRENCY_PAIRS, CurrencyPair } from "./CurrencyGrid";
import { Settings } from "./Settings";
import { HistoryPanel, HistoryItem } from "./HistoryPanel";

export const Calculator = () => {
  const [accountBalance, setAccountBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState(1);
  const [stopLossPips, setStopLossPips] = useState("");
  const [takeProfitPips, setTakeProfitPips] = useState("");
  const [selectedPair, setSelectedPair] = useState<CurrencyPair>(CURRENCY_PAIRS[0]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // UI State
  const [showNumPad, setShowNumPad] = useState<"balance" | "stopLoss" | "takeProfit" | null>(null);
  const [showCurrencyGrid, setShowCurrencyGrid] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [numPadValue, setNumPadValue] = useState("");

  const riskPresets = [0.5, 1, 2, 3];

  // Load saved settings and history
  useEffect(() => {
    const savedHistory = localStorage.getItem("positionSizeHistory");
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      setHistory(parsed.map((item: HistoryItem) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      })));
    }

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
    const risk = riskPercent;
    const slPips = parseFloat(stopLossPips) || 0;
    const tpPips = parseFloat(takeProfitPips) || 0;
    const pipVal = selectedPair.pipValue;

    if (balance <= 0 || slPips <= 0 || pipVal <= 0) {
      return { riskAmount: 0, positionSize: 0, units: 0, riskReward: 0, potentialProfit: 0 };
    }

    const riskAmount = (balance * risk) / 100;
    const positionSize = riskAmount / (slPips * pipVal);
    const units = positionSize * 100000;
    const riskReward = tpPips > 0 ? tpPips / slPips : 0;
    const potentialProfit = tpPips > 0 ? riskAmount * riskReward : 0;

    return { riskAmount, positionSize, units, riskReward, potentialProfit };
  }, [accountBalance, riskPercent, stopLossPips, takeProfitPips, selectedPair]);

  const saveToHistory = () => {
    if (calculation.positionSize <= 0) return;

    const newItem: HistoryItem = {
      id: Date.now().toString(),
      pair: selectedPair.symbol,
      balance: parseFloat(accountBalance),
      risk: riskPercent,
      stopLoss: parseFloat(stopLossPips),
      takeProfit: parseFloat(takeProfitPips) || 0,
      positionSize: calculation.positionSize,
      riskReward: calculation.riskReward,
      timestamp: new Date()
    };

    const newHistory = [newItem, ...history].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem("positionSizeHistory", JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("positionSizeHistory");
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num === 0) return "—";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const openNumPad = (type: "balance" | "stopLoss" | "takeProfit") => {
    const values = { balance: accountBalance, stopLoss: stopLossPips, takeProfit: takeProfitPips };
    setNumPadValue(values[type]);
    setShowNumPad(type);
  };

  const handleNumPadDone = () => {
    if (showNumPad === "balance") setAccountBalance(numPadValue);
    else if (showNumPad === "stopLoss") setStopLossPips(numPadValue);
    else if (showNumPad === "takeProfit") setTakeProfitPips(numPadValue);
    setShowNumPad(null);
    setNumPadValue("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="pt-12 pb-6 px-6 animate-fade-in flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-foreground rounded-xl flex items-center justify-center">
            <CalculatorIcon className="w-5 h-5 text-background" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Position Size</h1>
            <p className="text-sm text-muted-foreground">Calculator</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <History className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <SettingsIcon className="w-5 h-5 text-foreground" />
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
              {accountBalance ? `$${parseFloat(accountBalance).toLocaleString()}` : "Tap to enter"}
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
                onClick={() => setRiskPercent(preset)}
                className={`flex-1 h-12 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                  riskPercent === preset
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground"
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* Stop Loss & Take Profit */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => openNumPad("stopLoss")}
            className="bg-secondary rounded-2xl p-4 flex flex-col items-start transition-all duration-200 active:scale-[0.98] animate-slide-up"
            style={{ animationDelay: "150ms" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Stop Loss</p>
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
              <p className="text-xs text-muted-foreground">Take Profit</p>
            </div>
            <p className="text-lg font-bold text-foreground">
              {takeProfitPips ? `${takeProfitPips} pips` : "—"}
            </p>
          </button>
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
                  ${formatNumber(calculation.riskAmount, 0)}
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
            {calculation.riskReward > 0 && (
              <>
                <div className="h-px bg-background/20 my-4" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Target className="w-3 h-3 opacity-60" />
                      <p className="text-xs font-medium opacity-60">R:R Ratio</p>
                    </div>
                    <p className="text-xl font-semibold">
                      1:{formatNumber(calculation.riskReward, 1)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium opacity-60 mb-1">Potential Profit</p>
                    <p className="text-xl font-semibold">
                      +${formatNumber(calculation.potentialProfit, 0)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={saveToHistory}
            disabled={calculation.positionSize <= 0}
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
          label={
            showNumPad === "balance" ? "Account Balance" :
            showNumPad === "stopLoss" ? "Stop Loss" : "Take Profit"
          }
          suffix={showNumPad === "balance" ? "USD" : "pips"}
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

      {/* History Panel */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onClose={() => setShowHistory(false)}
          onClear={clearHistory}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};
