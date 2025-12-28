import { Check } from "lucide-react";

export interface CurrencyPair {
  symbol: string;
  pipValue: number;
  pipDecimal: number;
}

export const CURRENCY_PAIRS: CurrencyPair[] = [
  { symbol: "EUR/USD", pipValue: 10, pipDecimal: 4 },
  { symbol: "GBP/USD", pipValue: 10, pipDecimal: 4 },
  { symbol: "USD/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "USD/CHF", pipValue: 10.64, pipDecimal: 4 },
  { symbol: "AUD/USD", pipValue: 10, pipDecimal: 4 },
  { symbol: "USD/CAD", pipValue: 7.58, pipDecimal: 4 },
  { symbol: "NZD/USD", pipValue: 10, pipDecimal: 4 },
  { symbol: "EUR/GBP", pipValue: 12.74, pipDecimal: 4 },
  { symbol: "EUR/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "GBP/JPY", pipValue: 9.09, pipDecimal: 2 },
  { symbol: "XAU/USD", pipValue: 1, pipDecimal: 2 },
  { symbol: "XAG/USD", pipValue: 0.5, pipDecimal: 3 },
];

interface CurrencyGridProps {
  selectedPair: CurrencyPair;
  onSelect: (pair: CurrencyPair) => void;
  onBack: () => void;
}

export const CurrencyGrid = ({ selectedPair, onSelect, onBack }: CurrencyGridProps) => {
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
