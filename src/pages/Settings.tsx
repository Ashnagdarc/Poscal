import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Moon, Plus, Smartphone, Trash2 } from "lucide-react";

import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_CURRENCIES, useCurrency } from "@/contexts/CurrencyContext";
import { BROKER_PROFILES } from "@/domain/brokers";
import { clearCalculatorHistory } from "@/lib/calculatorHistory";
import {
  createBrokerProfile,
  deleteBrokerProfile,
  loadBrokerProfiles,
  type SavedBrokerProfile,
} from "@/lib/convexBrokerProfiles";
import { loadUserSettings, saveUserSettings } from "@/lib/convexUserSettings";
import { useHaptics } from "@/hooks/use-haptics";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { user, session, signOut } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { lightTap } = useHaptics();
  const [defaultRisk, setDefaultRisk] = useState("1");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [brokerProfiles, setBrokerProfiles] = useState<SavedBrokerProfile[]>([]);
  const [brokerName, setBrokerName] = useState("");
  const [baseBrokerId, setBaseBrokerId] = useState(BROKER_PROFILES[0]?.id ?? "paper");
  const [brokerCurrency, setBrokerCurrency] = useState("USD");
  const [brokerNotes, setBrokerNotes] = useState("");
  const [isSavingBroker, setIsSavingBroker] = useState(false);

  const isSignedIn = Boolean(user && session?.access_token);
  const themeOptions = useMemo(() => (["light", "dark"] as const), []);

  useEffect(() => {
    const syncSettings = async () => {
      const settings = await loadUserSettings(session?.access_token);

      if (typeof settings.defaultRiskPercent === "number" && settings.defaultRiskPercent > 0) {
        setDefaultRisk(String(settings.defaultRiskPercent));
      }

      if (typeof settings.hapticsEnabled === "boolean") {
        setHapticsEnabled(settings.hapticsEnabled);
      } else {
        setHapticsEnabled(localStorage.getItem("hapticsEnabled") !== "false");
      }

      const nextTheme = settings.theme ?? (document.documentElement.classList.contains("dark") ? "dark" : "light");
      setTheme(nextTheme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");

      const nextCurrency = ACCOUNT_CURRENCIES.find((option) => option.code === settings.accountCurrency);
      if (nextCurrency) {
        setCurrency(nextCurrency);
        setBrokerCurrency(nextCurrency.code);
      }

      if (isSignedIn) {
        setBrokerProfiles(await loadBrokerProfiles(session?.access_token));
      }
    };

    void syncSettings();
  }, [isSignedIn, session?.access_token, setCurrency]);

  const persistSettings = async (overrides?: {
    defaultRiskPercent?: number;
    accountCurrency?: string;
    theme?: "light" | "dark";
    hapticsEnabled?: boolean;
  }) => {
    await saveUserSettings({
      defaultRiskPercent: overrides?.defaultRiskPercent ?? Number(defaultRisk),
      accountCurrency: overrides?.accountCurrency ?? currency.code,
      theme: overrides?.theme ?? theme,
      hapticsEnabled: overrides?.hapticsEnabled ?? hapticsEnabled,
    }, session?.access_token);
  };

  const handleRiskChange = async (value: string) => {
    setDefaultRisk(value);
    await persistSettings({ defaultRiskPercent: Number(value) });
    lightTap();
  };

  const handleCurrencyChange = async (code: string) => {
    const nextCurrency = ACCOUNT_CURRENCIES.find((option) => option.code === code);
    if (!nextCurrency) {
      return;
    }

    setCurrency(nextCurrency);
    setBrokerCurrency(code);
    await persistSettings({ accountCurrency: code });
    lightTap();
  };

  const handleThemeChange = async (value: "light" | "dark") => {
    setTheme(value);
    document.documentElement.classList.toggle("dark", value === "dark");
    await persistSettings({ theme: value });
    lightTap();
  };

  const toggleHaptics = async () => {
    const nextValue = !hapticsEnabled;
    setHapticsEnabled(nextValue);
    await persistSettings({ hapticsEnabled: nextValue });
    if (nextValue) {
      lightTap();
    }
  };

  const refreshBrokerProfiles = async () => {
    setBrokerProfiles(await loadBrokerProfiles(session?.access_token));
  };

  const handleCreateBrokerProfile = async () => {
    if (!brokerName.trim()) {
      toast.error("Enter a broker profile name.");
      return;
    }

    setIsSavingBroker(true);
    try {
      await createBrokerProfile({
        name: brokerName.trim(),
        brokerId: baseBrokerId,
        accountCurrency: brokerCurrency,
        notes: brokerNotes.trim() || null,
      }, session?.access_token);
      setBrokerName("");
      setBrokerNotes("");
      await refreshBrokerProfiles();
      toast.success("Broker profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save broker profile");
    } finally {
      setIsSavingBroker(false);
    }
  };

  const handleDeleteBrokerProfile = async (id: SavedBrokerProfile["id"]) => {
    try {
      await deleteBrokerProfile(id, session?.access_token);
      await refreshBrokerProfiles();
      toast.success("Broker profile removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove broker profile");
    }
  };

  const handleClearHistory = async () => {
    await clearCalculatorHistory(user?.id);
    lightTap();
    toast.success("History cleared");
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/signin");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-secondary/80 rounded-xl flex items-center justify-center transition-all active:scale-95 hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Calculator preferences</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-2 space-y-6">
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Defaults</h2>
          <div className="bg-secondary/50 rounded-2xl p-4 space-y-4">
            <div>
              <p className="font-medium text-foreground mb-3">Default Risk %</p>
              <div className="flex gap-2">
                {["0.5", "1", "2", "3"].map((risk) => (
                  <button
                    key={risk}
                    onClick={() => void handleRiskChange(risk)}
                    className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all ${
                      defaultRisk === risk ? "bg-foreground text-background" : "bg-background text-foreground"
                    }`}
                  >
                    {risk}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium text-foreground mb-3">Account Currency</p>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_CURRENCIES.slice(0, 6).map((option) => (
                  <button
                    key={option.code}
                    onClick={() => void handleCurrencyChange(option.code)}
                    className={`h-10 rounded-xl text-sm font-semibold transition-all ${
                      currency.code === option.code ? "bg-foreground text-background" : "bg-background text-foreground"
                    }`}
                  >
                    {option.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Experience</h2>
          <div className="bg-secondary/50 rounded-2xl overflow-hidden border border-border/50">
            <div className="px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-3 mb-3">
                <Moon className="w-5 h-5 text-foreground" />
                <span className="font-medium text-foreground">Theme</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {themeOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => void handleThemeChange(option)}
                    className={`h-10 rounded-xl text-sm font-semibold capitalize ${
                      theme === option ? "bg-foreground text-background" : "bg-background text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-foreground" />
                <span className="font-medium text-foreground">Haptic Feedback</span>
              </div>
              <button
                onClick={() => void toggleHaptics()}
                className={`w-12 h-7 rounded-full transition-all ${hapticsEnabled ? "bg-foreground" : "bg-muted"}`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-background transition-all ${
                    hapticsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {isSignedIn && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Broker Profiles</h2>
            <div className="bg-secondary/50 rounded-2xl p-4 space-y-3">
              <input
                value={brokerName}
                onChange={(event) => setBrokerName(event.target.value)}
                placeholder="Profile name"
                className="h-11 w-full rounded-xl bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={baseBrokerId}
                  onChange={(event) => setBaseBrokerId(event.target.value)}
                  className="h-11 rounded-xl bg-background px-4 text-sm text-foreground focus:outline-none"
                >
                  {BROKER_PROFILES.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <select
                  value={brokerCurrency}
                  onChange={(event) => setBrokerCurrency(event.target.value)}
                  className="h-11 rounded-xl bg-background px-4 text-sm text-foreground focus:outline-none"
                >
                  {ACCOUNT_CURRENCIES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.code}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={brokerNotes}
                onChange={(event) => setBrokerNotes(event.target.value)}
                placeholder="Optional notes"
                className="h-11 w-full rounded-xl bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <button
                onClick={() => void handleCreateBrokerProfile()}
                disabled={isSavingBroker}
                className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                Save broker profile
              </button>
              {brokerProfiles.length > 0 && (
                <div className="space-y-2 pt-2">
                  {brokerProfiles.map((profile) => (
                    <div key={profile.id} className="rounded-xl bg-background px-4 py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{profile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {BROKER_PROFILES.find((item) => item.id === profile.brokerId)?.name ?? profile.brokerId}
                          {" • "}
                          {profile.accountCurrency ?? "USD"}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleDeleteBrokerProfile(profile.id)}
                        className="text-sm text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Data</h2>
          <div className="space-y-2">
            <button
              onClick={() => void handleClearHistory()}
              className="w-full bg-secondary/50 rounded-2xl px-5 py-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
            >
              <Trash2 className="w-5 h-5 text-destructive" />
              <div>
                <p className="font-medium text-foreground">Clear History</p>
                <p className="text-sm text-muted-foreground">Remove saved calculations from local and optional cloud storage.</p>
              </div>
            </button>
          </div>
        </section>

        {user && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Account</h2>
            <button
              onClick={() => void handleLogout()}
              className="w-full bg-secondary/50 rounded-2xl px-5 py-4 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5 text-foreground" />
              <div>
                <p className="font-medium text-foreground">Sign Out</p>
                <p className="text-sm text-muted-foreground">Sign out without affecting calculator data on this device.</p>
              </div>
            </button>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Settings;
