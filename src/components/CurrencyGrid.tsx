import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { COMMON_PAIRS } from "@/lib/constants";
import { getInstrumentSpecBySymbol } from "@/lib/instrumentSpecs";

export interface CurrencyPair {
  symbol: string;
  pipDecimal: number; // Number of decimal places (4 for most pairs, 2 for JPY pairs)
}

/** Infer display pip decimals from instrument specs / symbol heuristics. */
export function detectPipDecimal(symbol: string): number {
  const spec = getInstrumentSpecBySymbol(symbol);
  if (spec) {
    if (spec.pipSize >= 1) return 0;
    if (spec.pipSize >= 0.01) return 2;
    if (spec.pipSize >= 0.001) return 3;
    return 4;
  }

  const upperSymbol = symbol.toUpperCase();
  if (upperSymbol.includes("JPY")) return 2;
  if (upperSymbol.includes("XAU") || upperSymbol.includes("XPT") || upperSymbol.includes("XCU")) {
    return 2;
  }
  if (upperSymbol.includes("XAG")) return 3;
  if (
    upperSymbol.includes("US30")
    || upperSymbol.includes("US100")
    || upperSymbol.includes("US500")
    || upperSymbol.includes("DE40")
    || upperSymbol.includes("UK100")
    || upperSymbol.includes("JP225")
  ) {
    return 0;
  }
  if (
    upperSymbol.includes("BTC")
    || upperSymbol.includes("ETH")
    || upperSymbol.includes("SOL")
    || upperSymbol.includes("XRP")
    || upperSymbol.includes("ADA")
  ) {
    return 2;
  }
  return 4;
}

/** Only instruments with calculator specs — no dead catalog entries. */
export const CURRENCY_PAIRS: CurrencyPair[] = COMMON_PAIRS.map((symbol) => ({
  symbol,
  pipDecimal: detectPipDecimal(symbol),
}));

export const FEATURED_CURRENCY_PAIRS = CURRENCY_PAIRS;

const featuredPairSymbols = new Set(FEATURED_CURRENCY_PAIRS.map((pair) => pair.symbol));

function pairLabelParts(symbol: string): { base: string; quote: string } {
  if (symbol.includes("/")) {
    const [base, quote = ""] = symbol.split("/");
    return { base, quote };
  }
  return { base: symbol, quote: "" };
}

interface CurrencyGridProps {
  selectedPair: CurrencyPair;
  onSelect: (pair: CurrencyPair) => void;
  onBack: () => void;
}

export const CurrencyGrid = ({ selectedPair, onSelect, onBack }: CurrencyGridProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");

  const handleCustomSubmit = () => {
    if (!customSymbol.trim()) return;

    const normalizedSymbol = customSymbol.trim().toUpperCase().replace(/-/g, "/");
    const withSlash =
      normalizedSymbol.includes("/") || normalizedSymbol.length !== 6
        ? normalizedSymbol
        : `${normalizedSymbol.slice(0, 3)}/${normalizedSymbol.slice(3)}`;

    if (!featuredPairSymbols.has(withSlash) && !featuredPairSymbols.has(normalizedSymbol)) {
      toast.error(`${normalizedSymbol} is not supported yet`);
      return;
    }

    const symbol = featuredPairSymbols.has(withSlash) ? withSlash : normalizedSymbol;
    onSelect({
      symbol,
      pipDecimal: detectPipDecimal(symbol),
    });
    onBack();
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      <header className="px-6 pb-4 pt-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Select Pair</h1>
          <button type="button" onClick={onBack} className="text-sm font-medium text-muted-foreground">
            Cancel
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {showCustomInput ? (
          <div className="mb-6 space-y-4 rounded-2xl bg-secondary p-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Symbol (e.g. EUR/GBP, BTC/USD)
              </label>
              <input
                type="text"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                placeholder="XXX/XXX"
                className="h-12 w-full rounded-xl bg-background px-4 text-lg font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
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
                type="button"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomSymbol("");
                }}
                className="h-12 flex-1 rounded-xl bg-background font-semibold text-foreground transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={!customSymbol.trim()}
                className="h-12 flex-1 rounded-xl bg-foreground font-semibold text-background transition-all active:scale-95 disabled:opacity-50"
              >
                Add Pair
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-secondary font-medium text-foreground transition-all active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            Search Supported Pair
          </button>
        )}

        <div className="grid grid-cols-3 gap-3">
          {FEATURED_CURRENCY_PAIRS.map((pair) => {
            const isSelected = selectedPair.symbol === pair.symbol;
            const { base, quote } = pairLabelParts(pair.symbol);
            return (
              <button
                key={pair.symbol}
                type="button"
                onClick={() => {
                  onSelect(pair);
                  onBack();
                }}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground"
                }`}
              >
                {isSelected && (
                  <div className="absolute right-2 top-2">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <span className="text-sm font-bold">{base}</span>
                {quote ? (
                  <span className="text-xs font-medium opacity-60">{quote}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Showing {FEATURED_CURRENCY_PAIRS.length} supported symbols with live lot sizing. Crosses
          (EUR/GBP, EUR/JPY, GBP/JPY) auto-convert quote→USD from mid rates.
        </p>
      </div>
    </div>
  );
};
