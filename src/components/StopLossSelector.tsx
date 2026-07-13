import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { calculatePositionSize, getInstrumentSpec } from "@/lib/positionSizeCalculator";

interface StopLossSelectorProps {
  symbol: string;
  selectedStopLoss: number | null;
  onSelect: (stopLoss: number) => void;
  accountBalance: number;
  riskPercent: number;
}

export const StopLossSelector = ({
  symbol,
  selectedStopLoss,
  onSelect,
  accountBalance,
  riskPercent
}: StopLossSelectorProps) => {
  const [customInput, setCustomInput] = useState("");
  const hasInstrumentSpec = !!getInstrumentSpec(symbol);
  
  // Generate stop loss range with calculated lot sizes
  const stopLossOptions = useMemo(() => {
    if (!hasInstrumentSpec || accountBalance <= 0) return [];
    
    const options: { stopLoss: number; lotSize: number }[] = [];
    
    // Generate range with smart increments similar to Stinu
    // Small values: 0.1 increments (10 to 30)
    for (let sl = 10; sl <= 30; sl += 0.1) {
      const stopLoss = Math.round(sl * 10) / 10;
      const lotSize = calculatePositionSize({
        symbol,
        accountBalance,
        riskPercent,
        stopLossPips: stopLoss,
      }).positionSize;
      options.push({ stopLoss, lotSize });
    }
    
    // Medium values: 0.5 increments (30.5 to 50)
    for (let sl = 30.5; sl <= 50; sl += 0.5) {
      const stopLoss = Math.round(sl * 10) / 10;
      const lotSize = calculatePositionSize({
        symbol,
        accountBalance,
        riskPercent,
        stopLossPips: stopLoss,
      }).positionSize;
      options.push({ stopLoss, lotSize });
    }
    
    // Large values: 1.0 increments (51 to 100)
    for (let sl = 51; sl <= 100; sl += 1) {
      const lotSize = calculatePositionSize({
        symbol,
        accountBalance,
        riskPercent,
        stopLossPips: sl,
      }).positionSize;
      options.push({ stopLoss: sl, lotSize });
    }
    
    return options;
  }, [accountBalance, hasInstrumentSpec, riskPercent, symbol]);

  if (!hasInstrumentSpec) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Local instrument spec is not available for {symbol}</p>
      </div>
    );
  }

  if (stopLossOptions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Enter account balance to see options</p>
      </div>
    );
  }

  const handleCustomSubmit = () => {
    const value = parseFloat(customInput);
    if (value > 0) {
      onSelect(value);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Custom Input Section - Sticky */}
      <div className="sticky top-0 z-10 bg-background border-b border-border pb-4">
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="number"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCustomSubmit();
                }
              }}
              placeholder="Type stop loss (pips)..."
              className="w-full h-14 pl-12 pr-4 bg-secondary text-foreground rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
              autoFocus
              step="0.1"
              min="0.1"
            />
          </div>
          {customInput && (
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput || parseFloat(customInput) <= 0}
              className="w-full mt-3 h-12 bg-primary text-primary-foreground rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
            >
              Set {customInput} pips
            </button>
          )}
        </div>
        
        {/* Table Header */}
        <div className="grid grid-cols-2 px-6 py-3 mt-4">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Stop Loss
          </div>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide text-right">
            Lots
          </div>
        </div>
      </div>
      
      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto">
        {stopLossOptions.map((option) => {
          const isSelected = selectedStopLoss === option.stopLoss;
          
          return (
            <button
              key={option.stopLoss}
              onClick={() => onSelect(option.stopLoss)}
              className={`w-full grid grid-cols-2 px-6 py-4 transition-all duration-150 border-b border-border/30 ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary/50 active:bg-secondary"
              }`}
            >
              <div className={`text-left ${isSelected ? "font-bold text-lg" : "font-medium"}`}>
                {option.stopLoss}
              </div>
              <div className={`text-right font-mono ${isSelected ? "font-bold text-lg" : "font-medium text-muted-foreground"}`}>
                {option.lotSize.toFixed(2)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
