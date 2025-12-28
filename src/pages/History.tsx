import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { History as HistoryIcon, Trash2, ArrowLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export interface HistoryItem {
  id: string;
  pair: string;
  balance: number;
  risk: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskReward: number;
  timestamp: Date;
}

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const savedHistory = localStorage.getItem("positionSizeHistory");
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      setHistory(parsed.map((item: HistoryItem) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      })));
    }
  }, []);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("positionSizeHistory");
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <header className="pt-12 pb-4 px-6 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-2xl font-bold text-foreground">History</h1>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <Trash2 className="w-5 h-5 text-destructive" />
          </button>
        )}
      </header>

      {/* History List */}
      <main className="flex-1 overflow-y-auto px-6 py-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground animate-fade-in">
            <HistoryIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No calculations saved</p>
            <p className="text-sm">Your saved calculations will appear here</p>
          </div>
        ) : (
          <div className="space-y-3 animate-slide-up">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-secondary rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-foreground">{item.pair}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(item.timestamp)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Size</p>
                    <p className="font-semibold text-foreground">
                      {formatNumber(item.positionSize)} lots
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Risk</p>
                    <p className="font-semibold text-foreground">{item.risk}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">R:R</p>
                    <p className="font-semibold text-foreground">
                      {item.riskReward > 0 ? `1:${formatNumber(item.riskReward, 1)}` : "—"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2 pt-2 border-t border-border">
                  <div>
                    <p className="text-muted-foreground text-xs">Balance</p>
                    <p className="font-semibold text-foreground">${formatNumber(item.balance, 0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Stop Loss</p>
                    <p className="font-semibold text-foreground">{item.stopLoss} pips</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default History;