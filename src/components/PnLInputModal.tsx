import { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { PnLInputSchema } from "@/lib/formValidation";
import { toast } from "@/hooks/use-toast";
import { useFocusTrap } from "@/hooks/use-focus-trap";

interface PnLInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pnl: number) => void;
  pair: string;
}

export const PnLInputModal = ({ isOpen, onClose, onConfirm, pair }: PnLInputModalProps) => {
  const [pnlValue, setPnlValue] = useState("");
  const [isProfit, setIsProfit] = useState(true);
  const containerRef = useFocusTrap(isOpen);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // Validate the input
    const validation = PnLInputSchema.safeParse({ pnl: pnlValue });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Invalid Input",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    const value = parseFloat(pnlValue) || 0;
    onConfirm(isProfit ? value : -value);
    setPnlValue("");
    setIsProfit(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConfirm();
  };

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pnl-modal-title"
    >
      <div 
        ref={containerRef}
        className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-lg animate-scale-in"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 id="pnl-modal-title" className="text-lg font-bold text-foreground">Close Trade</h3>
            <p className="text-sm text-muted-foreground">{pair}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="flex gap-2" role="group" aria-label="Trade result type">
            <button
              type="button"
              onClick={() => setIsProfit(true)}
              aria-pressed={isProfit}
              aria-label="Profit"
              className={`flex-1 h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                isProfit
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              <TrendingUp className="w-5 h-5" aria-hidden="true" />
              Profit
            </button>
            <button
              type="button"
              onClick={() => setIsProfit(false)}
              aria-pressed={!isProfit}
              aria-label="Loss"
              className={`flex-1 h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                !isProfit
                  ? "bg-destructive text-background"
                  : "bg-secondary text-foreground"
              }`}
            >
              <TrendingDown className="w-5 h-5" aria-hidden="true" />
              Loss
            </button>
          </fieldset>

          <div>
            <label htmlFor="pnl-amount" className="block text-sm text-muted-foreground mb-2">
              P&L Amount ($)
            </label>
            <input
              id="pnl-amount"
              type="number"
              value={pnlValue}
              onChange={(e) => setPnlValue(e.target.value)}
              placeholder="0.00"
              step="0.01"
              aria-required="true"
              className="w-full h-14 px-4 bg-secondary text-foreground text-xl font-bold rounded-xl outline-none focus:ring-2 focus:ring-foreground/10"
              autoFocus
            />
          </div>

          <div 
            className={`p-4 rounded-xl ${isProfit ? 'bg-foreground/5' : 'bg-destructive/10'}`}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground text-center">Final P&L</p>
            <p className={`text-2xl font-bold text-center ${isProfit ? 'text-foreground' : 'text-destructive'}`}>
              {isProfit ? '+' : '-'}${Math.abs(parseFloat(pnlValue) || 0).toFixed(2)}
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-secondary text-foreground font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-12 bg-foreground text-background font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              Close Trade
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
