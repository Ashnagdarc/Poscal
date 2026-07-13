import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="pt-12 pb-6 px-6 bg-gradient-to-b from-background to-background/50 sticky top-0 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-secondary/80 rounded-xl flex items-center justify-center transition-all active:scale-95 hover:bg-secondary mb-4"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-3xl font-bold text-foreground">Terms and Conditions</h1>
        <p className="text-sm text-muted-foreground mt-1">Last updated: July 12, 2026</p>
      </header>

      <main className="px-6 space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">1. Scope</h2>
          <p className="text-muted-foreground leading-relaxed">
            Poscal is a position size calculator. It is not a broker, exchange, signal service, or investment adviser.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">2. Trading Risk</h2>
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
            <p className="text-destructive font-medium mb-2">Risk Warning</p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              Trading leveraged products involves substantial risk. Poscal provides calculation tools only. You remain fully responsible for every trade and order you place.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">3. No Advice</h2>
          <p className="text-muted-foreground leading-relaxed">
            Poscal does not provide financial, legal, tax, or investment advice. Optional market quotes are informational and may be delayed, stale, or unavailable.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">4. Accounts</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you create an account, you are responsible for your credentials and for the accuracy of the information you provide.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">5. Availability</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may change, suspend, or remove parts of the app at any time. We do not guarantee continuous availability of optional external services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">6. Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the maximum extent permitted by law, Poscal is provided as-is without warranties, and we are not liable for losses arising from your use of the app or reliance on its calculations or market quotes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">7. Contact</h2>
          <div className="mt-3 bg-secondary/50 rounded-xl p-4">
            <p className="text-foreground font-medium">Email: info@poscalfx.com</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Terms;
