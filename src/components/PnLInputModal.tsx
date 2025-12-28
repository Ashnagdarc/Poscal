import { useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";

interface PnLInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pnl: number) => void;
  pair: string;
}

export const PnLInputModal = ({ isOpen, onClose, onConfirm, pair }: PnLInputModalProps) => {
  const [pnlValue, setPnlValue] = useState("");
  const [isProfit, setIsProfit] = useState(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const value = parseFloat(pnlValue) || 0;
    onConfirm(isProfit ? value : -value);
    setPnlValue("");
    setIsProfit(true);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-lg animate-scale-in">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Close Trade</h3>
            <p className="text-sm text-muted-foreground">{pair}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setIsProfit(true)}
              className={`flex-1 h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                isProfit
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              Profit
            </button>
            <button
              onClick={() => setIsProfit(false)}
              className={`flex-1 h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                !isProfit
                  ? "bg-destructive text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              <TrendingDown className="w-5 h-5" />
              Loss
            </button>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              P&L Amount ($)
            </label>
            <input
              type="number"
              value={pnlValue}
              onChange={(e) => setPnlValue(e.target.value)}
              placeholder="0.00"
              className="w-full h-14 px-4 bg-secondary text-foreground text-xl font-bold rounded-xl outline-none focus:ring-2 focus:ring-foreground/10"
              autoFocus
            />
          </div>

          <div className={`p-4 rounded-xl ${isProfit ? 'bg-foreground/5' : 'bg-destructive/10'}`}>
            <p className="text-sm text-muted-foreground text-center">Final P&L</p>
            <p className={`text-2xl font-bold text-center ${isProfit ? 'text-foreground' : 'text-destructive'}`}>
              {isProfit ? '+' : '-'}${Math.abs(parseFloat(pnlValue) || 0).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-12 bg-secondary text-foreground font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 h-12 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            Close Trade
          </button>
        </div>
      </div>
    </div>
  );
};
