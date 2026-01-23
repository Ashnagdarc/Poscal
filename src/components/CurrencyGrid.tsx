import { useState } from "react";
import { Check, Plus } from "lucide-react";

export interface CurrencyPair {
  symbol: string;
  pipDecimal: number; // Number of decimal places (4 for most pairs, 2 for JPY pairs)
}

export const CURRENCY_PAIRS: CurrencyPair[] = [
  // ============== MAJOR PAIRS (7) ==============
  { symbol: "EUR/USD", pipDecimal: 4 },
  { symbol: "GBP/USD", pipDecimal: 4 },
  { symbol: "USD/JPY", pipDecimal: 2 },
  { symbol: "USD/CHF", pipDecimal: 4 },
  { symbol: "AUD/USD", pipDecimal: 4 },
  { symbol: "USD/CAD", pipDecimal: 4 },
  { symbol: "NZD/USD", pipDecimal: 4 },
  
  // ============== EUR CROSS PAIRS (20) ==============
  { symbol: "EUR/GBP", pipDecimal: 4 },
  { symbol: "EUR/JPY", pipDecimal: 2 },
  { symbol: "EUR/CHF", pipDecimal: 4 },
  { symbol: "EUR/AUD", pipDecimal: 4 },
  { symbol: "EUR/CAD", pipDecimal: 4 },
  { symbol: "EUR/NZD", pipDecimal: 4 },
  { symbol: "EUR/SEK", pipDecimal: 4 },
  { symbol: "EUR/NOK", pipDecimal: 4 },
  { symbol: "EUR/DKK", pipDecimal: 4 },
  { symbol: "EUR/CZK", pipDecimal: 4 },
  { symbol: "EUR/HUF", pipDecimal: 4 },
  { symbol: "EUR/PLN", pipDecimal: 4 },
  { symbol: "EUR/RON", pipDecimal: 4 },
  { symbol: "EUR/RUB", pipDecimal: 4 },
  { symbol: "EUR/INR", pipDecimal: 4 },
  { symbol: "EUR/TRY", pipDecimal: 4 },
  { symbol: "EUR/MXN", pipDecimal: 4 },
  { symbol: "EUR/ZAR", pipDecimal: 4 },
  { symbol: "EUR/BRL", pipDecimal: 4 },
  { symbol: "EUR/SGD", pipDecimal: 4 },
  
  // ============== GBP CROSS PAIRS (15) ==============
  { symbol: "GBP/JPY", pipDecimal: 2 },
  { symbol: "GBP/CHF", pipDecimal: 4 },
  { symbol: "GBP/AUD", pipDecimal: 4 },
  { symbol: "GBP/CAD", pipDecimal: 4 },
  { symbol: "GBP/NZD", pipDecimal: 4 },
  { symbol: "GBP/SEK", pipDecimal: 4 },
  { symbol: "GBP/NOK", pipDecimal: 4 },
  { symbol: "GBP/DKK", pipDecimal: 4 },
  { symbol: "GBP/SGD", pipDecimal: 4 },
  { symbol: "GBP/HKD", pipDecimal: 4 },
  { symbol: "GBP/ZAR", pipDecimal: 4 },
  { symbol: "GBP/INR", pipDecimal: 4 },
  { symbol: "GBP/TRY", pipDecimal: 4 },
  { symbol: "GBP/MXN", pipDecimal: 4 },
  { symbol: "GBP/BRL", pipDecimal: 4 },
  
  // ============== AUD CROSS PAIRS (12) ==============
  { symbol: "AUD/JPY", pipDecimal: 2 },
  { symbol: "AUD/CHF", pipDecimal: 4 },
  { symbol: "AUD/CAD", pipDecimal: 4 },
  { symbol: "AUD/NZD", pipDecimal: 4 },
  { symbol: "AUD/SGD", pipDecimal: 4 },
  { symbol: "AUD/HKD", pipDecimal: 4 },
  { symbol: "AUD/CNY", pipDecimal: 4 },
  { symbol: "AUD/INR", pipDecimal: 4 },
  { symbol: "AUD/THB", pipDecimal: 4 },
  { symbol: "AUD/MXN", pipDecimal: 4 },
  { symbol: "AUD/SEK", pipDecimal: 4 },
  { symbol: "AUD/NOK", pipDecimal: 4 },
  
  // ============== CAD CROSS PAIRS (8) ==============
  { symbol: "CAD/JPY", pipDecimal: 2 },
  { symbol: "CAD/CHF", pipDecimal: 4 },
  { symbol: "CAD/SEK", pipDecimal: 4 },
  { symbol: "CAD/NOK", pipDecimal: 4 },
  { symbol: "CAD/SGD", pipDecimal: 4 },
  { symbol: "CAD/HKD", pipDecimal: 4 },
  { symbol: "CAD/CNY", pipDecimal: 4 },
  { symbol: "CAD/MXN", pipDecimal: 4 },
  
  // ============== JPY CROSS PAIRS (10) ==============
  { symbol: "NZD/JPY", pipDecimal: 2 },
  { symbol: "CHF/JPY", pipDecimal: 2 },
  { symbol: "SGD/JPY", pipDecimal: 2 },
  { symbol: "HKD/JPY", pipDecimal: 2 },
  { symbol: "CNY/JPY", pipDecimal: 2 },
  { symbol: "INR/JPY", pipDecimal: 2 },
  { symbol: "THB/JPY", pipDecimal: 2 },
  { symbol: "SEK/JPY", pipDecimal: 2 },
  { symbol: "NOK/JPY", pipDecimal: 2 },
  { symbol: "ZAR/JPY", pipDecimal: 2 },
  
  // ============== CHF CROSS PAIRS (6) ==============
  { symbol: "NZD/CHF", pipDecimal: 4 },
  { symbol: "SGD/CHF", pipDecimal: 4 },
  { symbol: "HKD/CHF", pipDecimal: 4 },
  { symbol: "CNY/CHF", pipDecimal: 4 },
  { symbol: "INR/CHF", pipDecimal: 4 },
  { symbol: "ZAR/CHF", pipDecimal: 4 },
  
  // ============== OTHER CROSS PAIRS (12) ==============
  { symbol: "NZD/CAD", pipDecimal: 4 },
  { symbol: "SGD/HKD", pipDecimal: 4 },
  { symbol: "SGD/CNY", pipDecimal: 4 },
  { symbol: "HKD/CNY", pipDecimal: 4 },
  { symbol: "CNY/INR", pipDecimal: 4 },
  { symbol: "SEK/NOK", pipDecimal: 4 },
  { symbol: "SEK/CHF", pipDecimal: 4 },
  { symbol: "NOK/CHF", pipDecimal: 4 },
  { symbol: "ZAR/INR", pipDecimal: 4 },
  { symbol: "AUD/ZAR", pipDecimal: 4 },
  { symbol: "NZD/ZAR", pipDecimal: 4 },
  
  // ============== USD EXOTIC PAIRS (20) ==============
  { symbol: "USD/MXN", pipDecimal: 4 },
  { symbol: "USD/ZAR", pipDecimal: 4 },
  { symbol: "USD/TRY", pipDecimal: 4 },
  { symbol: "USD/CNH", pipDecimal: 4 },
  { symbol: "USD/CNY", pipDecimal: 4 },
  { symbol: "USD/HKD", pipDecimal: 4 },
  { symbol: "USD/SGD", pipDecimal: 4 },
  { symbol: "USD/INR", pipDecimal: 4 },
  { symbol: "USD/THB", pipDecimal: 4 },
  { symbol: "USD/MYR", pipDecimal: 4 },
  { symbol: "USD/IDR", pipDecimal: 4 },
  { symbol: "USD/PHP", pipDecimal: 4 },
  { symbol: "USD/SEK", pipDecimal: 4 },
  { symbol: "USD/NOK", pipDecimal: 4 },
  { symbol: "USD/DKK", pipDecimal: 4 },
  { symbol: "USD/CZK", pipDecimal: 4 },
  { symbol: "USD/HUF", pipDecimal: 4 },
  { symbol: "USD/PLN", pipDecimal: 4 },
  { symbol: "USD/RUB", pipDecimal: 4 },
  { symbol: "USD/BRL", pipDecimal: 4 },
  
  // ============== PRECIOUS METALS (6) ==============
  { symbol: "XAU/USD", pipDecimal: 2 },
  { symbol: "XAG/USD", pipDecimal: 3 },
  { symbol: "XPT/USD", pipDecimal: 2 },
  { symbol: "XPD/USD", pipDecimal: 2 },
  { symbol: "XAU/EUR", pipDecimal: 2 },
  { symbol: "XAU/GBP", pipDecimal: 2 },
  
  // ============== ENERGY COMMODITIES (8) ==============
  { symbol: "BCO/USD", pipDecimal: 4 },
  { symbol: "WTI/USD", pipDecimal: 4 },
  { symbol: "NG/USD", pipDecimal: 4 },
  { symbol: "CO/USD", pipDecimal: 4 },
  { symbol: "RB/USD", pipDecimal: 4 },
  { symbol: "HO/USD", pipDecimal: 4 },
  { symbol: "CL/USD", pipDecimal: 4 },
  { symbol: "GC/USD", pipDecimal: 4 },
  
  // ============== AGRICULTURAL COMMODITIES (8) ==============
  { symbol: "ZW/USD", pipDecimal: 4 },
  { symbol: "ZC/USD", pipDecimal: 4 },
  { symbol: "ZS/USD", pipDecimal: 4 },
  { symbol: "CC/USD", pipDecimal: 4 },
  { symbol: "SB/USD", pipDecimal: 4 },
  { symbol: "CT/USD", pipDecimal: 4 },
  { symbol: "KC/USD", pipDecimal: 4 },
  { symbol: "OJ/USD", pipDecimal: 4 },
  
  // ============== US INDICES (10) ==============
  { symbol: "NAS/USD", pipDecimal: 0 },
  { symbol: "US100", pipDecimal: 0 },
  { symbol: "US100/USD", pipDecimal: 0 },
  { symbol: "SPX/USD", pipDecimal: 0 },
  { symbol: "US500", pipDecimal: 0 },
  { symbol: "US500/USD", pipDecimal: 0 },
  { symbol: "US30", pipDecimal: 0 },
  { symbol: "US30/USD", pipDecimal: 0 },
  { symbol: "RUT/USD", pipDecimal: 0 },
  { symbol: "NYA/USD", pipDecimal: 0 },
  
  // ============== EUROPEAN INDICES (8) ==============
  { symbol: "GER30", pipDecimal: 0 },
  { symbol: "GER30/EUR", pipDecimal: 0 },
  { symbol: "UK100", pipDecimal: 0 },
  { symbol: "UK100/GBP", pipDecimal: 0 },
  { symbol: "FRA40", pipDecimal: 0 },
  { symbol: "FRA40/EUR", pipDecimal: 0 },
  { symbol: "STOXX50", pipDecimal: 0 },
  { symbol: "AUS200", pipDecimal: 0 },
  
  // ============== ASIAN INDICES (10) ==============
  { symbol: "JPN225", pipDecimal: 0 },
  { symbol: "JPN225/USD", pipDecimal: 0 },
  { symbol: "HK50", pipDecimal: 0 },
  { symbol: "CHINA50", pipDecimal: 0 },
  { symbol: "SXIE", pipDecimal: 0 },
  { symbol: "SGX30", pipDecimal: 0 },
  { symbol: "SETINDEX", pipDecimal: 0 },
  { symbol: "MERIT50", pipDecimal: 0 },
  { symbol: "PSE", pipDecimal: 0 },
  { symbol: "JKSE", pipDecimal: 0 },
  
  // ============== CRYPTOCURRENCIES - MAJOR (15) ==============
  { symbol: "BTC/USD", pipDecimal: 2 },
  { symbol: "ETH/USD", pipDecimal: 2 },
  { symbol: "BNB/USD", pipDecimal: 2 },
  { symbol: "XRP/USD", pipDecimal: 2 },
  { symbol: "ADA/USD", pipDecimal: 2 },
  { symbol: "SOL/USD", pipDecimal: 2 },
  { symbol: "DOGE/USD", pipDecimal: 2 },
  { symbol: "DOT/USD", pipDecimal: 2 },
  { symbol: "MATIC/USD", pipDecimal: 2 },
  { symbol: "LTC/USD", pipDecimal: 2 },
  { symbol: "AVAX/USD", pipDecimal: 2 },
  { symbol: "ATOM/USD", pipDecimal: 2 },
  { symbol: "FIL/USD", pipDecimal: 2 },
  { symbol: "LINK/USD", pipDecimal: 2 },
  { symbol: "NEAR/USD", pipDecimal: 2 },
  
  // ============== CRYPTOCURRENCIES - ALTCOINS (25) ==============
  { symbol: "SHIB/USD", pipDecimal: 8 },
  { symbol: "ARB/USD", pipDecimal: 2 },
  { symbol: "BLUR/USD", pipDecimal: 2 },
  { symbol: "APE/USD", pipDecimal: 2 },
  { symbol: "GALA/USD", pipDecimal: 4 },
  { symbol: "SAND/USD", pipDecimal: 4 },
  { symbol: "MANA/USD", pipDecimal: 4 },
  { symbol: "ENJ/USD", pipDecimal: 4 },
  { symbol: "FLOW/USD", pipDecimal: 2 },
  { symbol: "ICP/USD", pipDecimal: 2 },
  { symbol: "THETA/USD", pipDecimal: 4 },
  { symbol: "VET/USD", pipDecimal: 6 },
  { symbol: "TRX/USD", pipDecimal: 6 },
  { symbol: "ETC/USD", pipDecimal: 2 },
  { symbol: "ZEC/USD", pipDecimal: 2 },
  { symbol: "XMR/USD", pipDecimal: 2 },
  { symbol: "DASH/USD", pipDecimal: 2 },
  { symbol: "BCH/USD", pipDecimal: 2 },
  { symbol: "BSV/USD", pipDecimal: 2 },
  { symbol: "DYDX/USD", pipDecimal: 2 },
  { symbol: "AAVE/USD", pipDecimal: 2 },
  { symbol: "UNI/USD", pipDecimal: 2 },
  { symbol: "SUSHI/USD", pipDecimal: 4 },
  { symbol: "SNX/USD", pipDecimal: 2 },
  { symbol: "CRV/USD", pipDecimal: 4 },
  
  // ============== CRYPTOCURRENCIES - STABLECOINS & LAYER 2 (10) ==============
  { symbol: "USDT/USD", pipDecimal: 4 },
  { symbol: "USDC/USD", pipDecimal: 4 },
  { symbol: "BUSD/USD", pipDecimal: 4 },
  { symbol: "DAI/USD", pipDecimal: 4 },
  { symbol: "FRAX/USD", pipDecimal: 4 },
  { symbol: "OP/USD", pipDecimal: 2 },
  { symbol: "LIDO/USD", pipDecimal: 2 },
  { symbol: "ARBITRUM/USD", pipDecimal: 4 },
  { symbol: "OPTIMISM/USD", pipDecimal: 4 },
  { symbol: "ZKSPACES/USD", pipDecimal: 6 },
  
  // ============== MULTI-PAIR CROSS CRYPTOS (8) ==============
  { symbol: "BTC/EUR", pipDecimal: 2 },
  { symbol: "BTC/GBP", pipDecimal: 2 },
  { symbol: "ETH/EUR", pipDecimal: 2 },
  { symbol: "ETH/GBP", pipDecimal: 2 },
  { symbol: "ETH/BTC", pipDecimal: 8 },
  { symbol: "BNB/BTC", pipDecimal: 8 },
  { symbol: "DOGE/BTC", pipDecimal: 8 },
  { symbol: "LTC/BTC", pipDecimal: 8 },
  
  // ============== ADDITIONAL FOREX EXOTICS (12) ==============
  { symbol: "USD/QAR", pipDecimal: 4 },
  { symbol: "USD/AED", pipDecimal: 4 },
  { symbol: "USD/SAR", pipDecimal: 4 },
  { symbol: "USD/KWD", pipDecimal: 4 },
  { symbol: "USD/OMR", pipDecimal: 4 },
  { symbol: "USD/JOD", pipDecimal: 4 },
  { symbol: "USD/LBP", pipDecimal: 4 },
  { symbol: "USD/IQD", pipDecimal: 4 },
  { symbol: "EUR/QAR", pipDecimal: 4 },
  { symbol: "GBP/AED", pipDecimal: 4 },
];

interface CurrencyGridProps {
  selectedPair: CurrencyPair;
  onSelect: (pair: CurrencyPair) => void;
  onBack: () => void;
}

export const CurrencyGrid = ({ selectedPair, onSelect, onBack }: CurrencyGridProps) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSymbol, setCustomSymbol] = useState("");

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
      const customPair: CurrencyPair = {
        symbol: customSymbol.toUpperCase(),
        pipDecimal: detectPipDecimal(customSymbol),
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
