import { useState, useEffect } from "react";
import { ArrowLeft, History as HistoryIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadCalculatorHistory,
  migrateLocalCalculatorHistoryToConvex,
  type CalculatorHistoryItem,
} from "@/lib/calculatorHistory";

const History = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [history, setHistory] = useState<CalculatorHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setIsLoading(true);
      try {
        await migrateLocalCalculatorHistoryToConvex(user?.id);
        const items = await loadCalculatorHistory(user?.id);
        if (isMounted) {
          setHistory(items);
        }
      } catch (error) {
        console.error("[calculator-history] Failed to load history", error);
        if (isMounted) {
          setHistory([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <main className="mx-auto w-full max-w-[36rem] px-4 pb-8 pt-6 sm:px-5 lg:px-6">
        <header className="mb-8 flex items-start gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.08] text-white/85 transition active:scale-95 sm:h-11 sm:w-11"
            aria-label="Go back"
          >
            <ArrowLeft className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
          </button>
          <div>
            <h1 className="text-[clamp(1.55rem,3vw,2.2rem)] font-semibold tracking-[-0.04em] text-white">
              History
            </h1>
            <p className="mt-1 text-sm text-white/55 sm:text-base">
              Saved calculations
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="flex min-h-[48vh] items-center justify-center text-white/45">
            <p className="text-base">Loading calculations...</p>
          </div>
        ) : history.length === 0 ? (
          <section className="flex min-h-[55vh] flex-col items-center justify-center text-center text-white/45">
            <HistoryIcon className="mb-4 h-14 w-14 text-white/15 sm:h-16 sm:w-16" />
            <p className="text-[clamp(1.6rem,3vw,2.1rem)] font-medium tracking-[-0.04em] text-white/58">
              No trades yet
            </p>
            <p className="mt-2 text-sm sm:text-base">
              Tap + to add your first trade
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {history.map((item) => (
              <article
                key={item.id}
                className="rounded-[1.25rem] border border-white/8 bg-white/[0.05] p-4 sm:p-[18px]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white sm:text-xl">
                      {item.pair}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/45 sm:text-xs sm:tracking-[0.2em]">
                      {new Date(item.timestamp).toLocaleString("en-US")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/45 sm:text-xs">
                      Position Size
                    </p>
                    <p className="text-lg font-semibold text-white sm:text-xl">
                      {item.positionSize.toFixed(2)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default History;
