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

export const CurrencyGrid = ({
  selectedPair,
  pairs = FEATURED_CURRENCY_PAIRS,
  onSelect,
  onBack,
}: CurrencyGridProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");
  const availableSymbols = new Set(pairs.map((pair) => pair.symbol));

  // Auto-detect pip decimal based on currency pair
  const detectPipDecimal = (symbol: string): number => {
    const upperSymbol = symbol.toUpperCase();

    // JPY pairs use 2 decimals
    if (upperSymbol.includes("JPY")) return 2;

    // Gold uses 2 decimals
    if (upperSymbol.includes("XAU")) return 2;

    // Silver uses 3 decimals
    if (upperSymbol.includes("XAG")) return 3;

    // Indices typically use 0 decimals
    if (
      upperSymbol.includes("US30") ||
      upperSymbol.includes("US100") ||
      upperSymbol.includes("SPX") ||
      upperSymbol.includes("NAS")
    )
      return 0;

    // Crypto typically uses 2 decimals
    if (upperSymbol.includes("BTC") || upperSymbol.includes("ETH")) return 2;

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
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050505]/95 text-white backdrop-blur-xl animate-slide-up">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_28%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.04),_transparent_26%)]" />

      <header className="relative z-10 border-b border-white/10 px-4 pb-4 pt-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              Instrument
            </p>
            <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.04em] text-white">
              Select Pair
            </h1>
          </div>
          <button
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-medium text-white/75 transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {showCustomInput ? (
            <div className="mb-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_-34px_rgba(0,0,0,0.95)]">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Symbol (e.g. EUR/GBP, BTC/USD)
                </label>
                <input
                  type="text"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  placeholder="XXX/XXX"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#0b0b0b] px-4 text-lg font-medium text-white outline-none transition placeholder:text-white/25 focus:border-white/25 focus:ring-2 focus:ring-white/10"
                  autoFocus
                />
                {customSymbol && (
                  <p className="mt-2 text-xs leading-6 text-white/50">
                    Pip decimals will be auto-detected:{" "}
                    {detectPipDecimal(customSymbol)} decimals
                  </p>
                )}
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomSymbol("");
                  }}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white/78 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customSymbol.trim()}
                  className="flex-1 rounded-2xl border border-white/10 bg-white px-4 py-3 font-semibold text-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
                >
                  Add Pair
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              className="mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-[1.35rem] border border-white/10 bg-white/5 text-sm font-semibold text-white/85 transition-all active:scale-[0.99]"
            >
              <Plus className="h-5 w-5" />
              Add Custom Pair
            </button>
          )}

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {pairs.map((pair) => {
              const isSelected = selectedPair.symbol === pair.symbol;
              return (
                <button
                  key={pair.symbol}
                  onClick={() => {
                    onSelect(pair);
                    onBack();
                  }}
                  className={`relative aspect-square rounded-[1.4rem] border p-3 text-left transition-all duration-200 active:scale-[0.98] ${
                    isSelected
                      ? "border-white/20 bg-white text-black shadow-[0_18px_40px_-24px_rgba(255,255,255,0.85)]"
                      : "border-white/10 bg-white/5 text-white/85 hover:border-white/20 hover:bg-white/8"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-2 top-2 rounded-full bg-black/10 p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex h-full flex-col justify-end">
                    <span className="text-sm font-bold tracking-tight">
                      {pair.symbol.split("/")[0]}
                    </span>
                    <span
                      className={`text-xs font-medium ${isSelected ? "text-black/55" : "text-white/45"}`}
                    >
                      {pair.symbol.split("/")[1]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs leading-6 text-white/45">
            Showing {pairs.length} locally supported instruments from the
            production catalog.
          </p>
        </div>
      </div>
    </div>
  );
};
