import { useState } from "react";
import { Check, Plus } from "lucide-react";

export interface CurrencyPair {
  symbol: string;
  pipValue: number;
  pipDecimal: number;
}

export const CURRENCY_PAIRS: CurrencyPair[] = [
  // Major Pairs
  { symbol: "EUR/USD", pipValue: 10, pipDecimal: 4 },
  { symbol: "GBP/USD", pipValue: 10, pipDecimal: 4 },
  { symbol: "USD/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "USD/CHF", pipValue: 10.64, pipDecimal: 4 },
  { symbol: "AUD/USD", pipValue: 10, pipDecimal: 4 },
  { symbol: "USD/CAD", pipValue: 7.58, pipDecimal: 4 },
  { symbol: "NZD/USD", pipValue: 10, pipDecimal: 4 },
  // Cross Pairs
  { symbol: "EUR/GBP", pipValue: 12.74, pipDecimal: 4 },
  { symbol: "EUR/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "GBP/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "EUR/AUD", pipValue: 6.45, pipDecimal: 4 },
  { symbol: "EUR/CAD", pipValue: 7.58, pipDecimal: 4 },
  { symbol: "EUR/CHF", pipValue: 10.64, pipDecimal: 4 },
  { symbol: "GBP/AUD", pipValue: 6.45, pipDecimal: 4 },
  { symbol: "GBP/CAD", pipValue: 7.58, pipDecimal: 4 },
  { symbol: "GBP/CHF", pipValue: 10.64, pipDecimal: 4 },
  { symbol: "AUD/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "AUD/CAD", pipValue: 7.58, pipDecimal: 4 },
  { symbol: "AUD/CHF", pipValue: 10.64, pipDecimal: 4 },
  { symbol: "AUD/NZD", pipValue: 10, pipDecimal: 4 },
  { symbol: "CAD/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "CHF/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "NZD/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "NZD/CAD", pipValue: 7.58, pipDecimal: 4 },
  { symbol: "NZD/CHF", pipValue: 10.64, pipDecimal: 4 },
  // Commodities
  { symbol: "XAU/USD", pipValue: 1, pipDecimal: 2 },
  { symbol: "XAG/USD", pipValue: 0.5, pipDecimal: 3 },
  // Indices & Crypto (approximate values)
  { symbol: "US30", pipValue: 1, pipDecimal: 0 },
  { symbol: "US100", pipValue: 1, pipDecimal: 0 },
  { symbol: "BTC/USD", pipValue: 1, pipDecimal: 2 },
  { symbol: "ETH/USD", pipValue: 1, pipDecimal: 2 },
];

interface CurrencyGridProps {
  selectedPair: CurrencyPair;
  onSelect: (pair: CurrencyPair) => void;
  onBack: () => void;
}

export const CurrencyGrid = ({ selectedPair, onSelect, onBack }: CurrencyGridProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");
  const [customPipValue, setCustomPipValue] = useState("10");
  const [customPipDecimal, setCustomPipDecimal] = useState("4");

  const handleCustomSubmit = () => {
    if (customSymbol.trim()) {
      const customPair: CurrencyPair = {
        symbol: customSymbol.toUpperCase(),
        pipValue: parseFloat(customPipValue) || 10,
        pipDecimal: parseInt(customPipDecimal) || 4,
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
                Symbol (e.g. BTC/USD)
              </label>
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="XXX/XXX"
                className="w-full h-12 px-4 bg-background text-foreground rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Pip Value ($)
                </label>
                <input
                  type="number"
                  value={customPipValue}
                  onChange={(e) => setCustomPipValue(e.target.value)}
                  placeholder="10"
                  className="w-full h-12 px-4 bg-background text-foreground rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Pip Decimals
                </label>
                <input
                  type="number"
                  value={customPipDecimal}
                  onChange={(e) => setCustomPipDecimal(e.target.value)}
                  placeholder="4"
                  className="w-full h-12 px-4 bg-background text-foreground rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCustomInput(false)}
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
          {CURRENCY_PAIRS.map((pair) => {
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
      </div>
    </div>
  );
};
