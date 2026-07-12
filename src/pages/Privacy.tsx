import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
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
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-1">Last updated: July 12, 2026</p>
      </header>

      <main className="px-6 space-y-6">
        <section className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">
            Poscal is a position size calculator. We only collect the data needed to run the calculator, optional accounts, and optional saved settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">1. Data We Collect</h2>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Account email and profile details if you sign up</li>
            <li>Calculator settings such as default risk, theme, and account currency</li>
            <li>Saved broker profiles and saved calculation history if you choose to store them</li>
            <li>Basic device and browser information needed to render the app safely</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Data</h2>
          <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1 ml-4">
            <li>Run the calculator and save your optional preferences</li>
            <li>Authenticate your account if you use Convex-backed storage</li>
            <li>Improve reliability and investigate errors</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">3. Storage</h2>
          <p className="text-muted-foreground leading-relaxed">
            Poscal stores calculator preferences locally in your browser by default. If you configure Convex and sign in, Poscal can also store profile data, user settings, broker profiles, and saved calculations in Convex.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">4. Third Parties</h2>
          <p className="text-muted-foreground leading-relaxed">
            Poscal may call public market-data providers for optional market-order quotes. Those quotes are not required for manual-entry calculations. Poscal does not sell your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">5. Your Choices</h2>
          <p className="text-muted-foreground leading-relaxed">
            You can use Poscal without configuring Convex. You can also clear local calculation history and local preferences from the app settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">6. Contact</h2>
          <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
            <p className="text-foreground">
              <span className="font-medium">Email:</span> info@poscalfx.com
            </p>
            <p className="text-foreground">
              <span className="font-medium">App Name:</span> Poscal
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Privacy;
