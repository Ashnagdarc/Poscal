import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { CURRENCY_PAIRS, type CurrencyPair } from "@/lib/currencyPairs";

export const FEATURED_CURRENCY_PAIRS = CURRENCY_PAIRS;

interface CurrencyGridProps {
  selectedPair: CurrencyPair;
  pairs?: CurrencyPair[];
  onSelect: (pair: CurrencyPair) => void;
  onBack: () => void;
}

export const CurrencyGrid = ({ selectedPair, pairs = FEATURED_CURRENCY_PAIRS, onSelect, onBack }: CurrencyGridProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");
  const availableSymbols = new Set(pairs.map((pair) => pair.symbol));

  // Auto-detect pip decimal based on currency pair
  const detectPipDecimal = (symbol: string): number => {
    const upperSymbol = symbol.toUpperCase();
    
    // JPY pairs use 2 decimals
    if (upperSymbol.includes('JPY')) return 2;
    
    // Gold uses 2 decimals
    if (upperSymbol.includes('XAU')) return 2;
    
    // Silver uses 3 decimals
    if (upperSymbol.includes('XAG')) return 3;
    
    // Indices typically use 0 decimals
    if (upperSymbol.includes('US30') || upperSymbol.includes('US100') || 
        upperSymbol.includes('SPX') || upperSymbol.includes('NAS')) return 0;
    
    // Crypto typically uses 2 decimals
    if (upperSymbol.includes('BTC') || upperSymbol.includes('ETH')) return 2;
    
    // Default: standard forex pairs use 4 decimals
    return 4;
  };

  const handleCustomSubmit = () => {
    if (customSymbol.trim()) {
      const normalizedSymbol = customSymbol.toUpperCase();
      if (!availableSymbols.has(normalizedSymbol)) {
        toast.error(`${normalizedSymbol} is coming soon`);
        return;
      }

      const customPair: CurrencyPair = {
        symbol: normalizedSymbol,
        pipDecimal: detectPipDecimal(normalizedSymbol),
      };
      onSelect(customPair);
      onBack();
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      {/* Header */}
      <header className="pt-12 pb-4 px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Select Pair</h1>
          <button
            onClick={onBack}
            className="text-sm font-medium text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {/* Custom Input Section */}
        {showCustomInput ? (
          <div className="mb-6 p-4 bg-secondary rounded-2xl space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Symbol (e.g. EUR/GBP, BTC/USD)
              </label>
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="XXX/XXX"
                className="w-full h-12 px-4 bg-background text-foreground rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20"
                autoFocus
              />
              {customSymbol && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Pip decimals will be auto-detected: {detectPipDecimal(customSymbol)} decimals
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomSymbol("");
                }}
                className="flex-1 h-12 bg-background text-foreground rounded-xl font-semibold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomSubmit}
                disabled={!customSymbol.trim()}
                className="flex-1 h-12 bg-foreground text-background rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                Add Pair
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full mb-4 h-14 bg-secondary rounded-2xl flex items-center justify-center gap-2 text-foreground font-medium transition-all active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            Add Custom Pair
          </button>
        )}

        <div className="grid grid-cols-3 gap-3">
          {pairs.map((pair) => {
            const isSelected = selectedPair.symbol === pair.symbol;
            return (
              <button
                key={pair.symbol}
                onClick={() => {
                  onSelect(pair);
                  onBack();
                }}
                className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-4 h-4" />
                  </div>
                )}
                <span className="text-sm font-bold">{pair.symbol.split("/")[0]}</span>
                <span className="text-xs font-medium opacity-60">
                  {pair.symbol.split("/")[1]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Showing {pairs.length} locally supported instruments from the production catalog.
        </p>
      </div>
    </div>
  );
};
