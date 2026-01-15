// ...existing code...
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Trash2, LogOut, User, ChevronRight, Smartphone, Download, RotateCcw, Coins, Megaphone, Wallet, Mail, CreditCard, FileText, Shield } from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, ACCOUNT_CURRENCIES } from "@/contexts/CurrencyContext";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useHaptics } from "@/hooks/use-haptics";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { AdminUsersTab } from "@/components/AdminUsersTab";
import { NotificationSettings } from "@/components/NotificationSettings";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const [notifications, setNotifications] = useState(true);
  const [defaultRisk, setDefaultRisk] = useState("1");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const { lightTap, isSupported } = useHaptics();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    const savedRisk = localStorage.getItem("defaultRisk");
    if (savedRisk) setDefaultRisk(savedRisk);
    
    const savedNotif = localStorage.getItem("notifications");
    if (savedNotif) setNotifications(savedNotif === "true");

    const savedHaptics = localStorage.getItem("hapticsEnabled");
    setHapticsEnabled(savedHaptics !== "false");
  }, []);

  const toggleNotifications = () => {
    const newValue = !notifications;
    setNotifications(newValue);
    localStorage.setItem("notifications", String(newValue));
    lightTap();
  };

  const toggleHaptics = () => {
    const newValue = !hapticsEnabled;
    setHapticsEnabled(newValue);
    localStorage.setItem("hapticsEnabled", String(newValue));
    if (newValue) lightTap();
  };

  const handleRiskChange = (value: string) => {
    setDefaultRisk(value);
    localStorage.setItem("defaultRisk", value);
    lightTap();
  };

  const clearHistory = () => {
    localStorage.removeItem("positionSizeHistory");
    lightTap();
    toast.success("History cleared");
  };

  const resetOnboarding = () => {
    localStorage.removeItem("hasSeenOnboarding");
    lightTap();
    toast.success("Onboarding reset");
    navigate("/welcome");
  };

  const handleLogout = async () => {
    lightTap();
    await signOut();
    toast.success("Signed out");
    navigate("/signin");
  };

  const handleInstall = async () => {
    lightTap();
    const installed = await promptInstall();
    if (installed) {
      toast.success("App installed successfully!");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 pt-12 pb-6 px-6 bg-gradient-to-b from-background via-background to-background/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-secondary/80 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your preferences and account</p>
          </div>
        </div>
      </header>

      {/* Settings List */}
      <main className="flex-1 overflow-y-auto px-6 py-2 space-y-6 animate-slide-up">
        {/* Account Section */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Account</h2>
          <div className="space-y-2">
            {user ? (
              <div className="bg-secondary/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-border/50">
                <button
                  onClick={() => navigate("/profile")}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center ring-2 ring-primary/20">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">{user.email}</p>
                      <p className="text-sm text-muted-foreground">Manage profile & preferences</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate("/signin")}
                className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center justify-between border border-border/50 hover:bg-secondary/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-foreground" />
                  <span className="font-medium text-foreground">Sign In</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </section>

        {/* Trading & Admin Section */}
        {(user || isAdmin) && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Trading & Management</h2>
            <div className="space-y-2">
              {user && (
                <button
                  onClick={() => navigate('/manage-accounts')}
                  className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center justify-between border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Wallet className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Trading Accounts</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              )}

              {/* Admin User Management */}
              <AdminUsersTab />

              {/* Admin App Updates */}
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin/updates')}
                  className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center justify-between border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Megaphone className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">App Updates</span>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Admin</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              )}

              {/* Admin Payments Dashboard */}
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin/payments')}
                  className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center justify-between border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Wallet className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Payments Dashboard</span>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">Admin</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
            </div>
          </section>
        )}

        {/* Appearance & Preferences Section */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Appearance & Preferences</h2>
          <div className="bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
            {/* Theme Toggle */}
            <div className="px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                  <span className="text-lg">🎨</span>
                </div>
                <span className="font-medium text-foreground">Appearance</span>
              </div>
              <ThemeToggle />
            </div>

            {/* Account Currency */}
            <div className="overflow-hidden">
              <button
                onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                    <Coins className="w-4.5 h-4.5 text-foreground" />
                  </div>
                  <span className="font-medium text-foreground">Account Currency</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{currency.symbol} {currency.code}</span>
                  <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showCurrencyPicker ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {showCurrencyPicker && (
                <div className="px-5 pb-4 bg-background/50">
                  <div className="grid grid-cols-2 gap-2">
                    {ACCOUNT_CURRENCIES.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => {
                          setCurrency(curr);
                          setShowCurrencyPicker(false);
                          lightTap();
                          toast.success(`Currency set to ${curr.name}`);
                        }}
                        className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                          currency.code === curr.code
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-secondary border-border hover:border-foreground/20'
                        }`}
                      >
                        <p className="font-semibold text-sm">{curr.symbol} {curr.code}</p>
                        <p className={`text-xs mt-0.5 ${currency.code === curr.code ? 'opacity-80' : 'text-muted-foreground'}`}>{curr.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Haptic Feedback */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                  <Smartphone className="w-4.5 h-4.5 text-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">Haptic Feedback</span>
                  {!isSupported() && (
                    <span className="text-xs text-muted-foreground mt-0.5">Audio feedback active</span>
                  )}
                </div>
              </div>
              <button
                onClick={toggleHaptics}
                className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                  hapticsEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 rounded-full bg-background shadow-sm transition-all duration-300 ${
                    hapticsEnabled ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Notifications</h2>
          <div className="space-y-2">
            {/* Push Notifications */}
            <NotificationSettings />

            {/* In-App Toasts */}
            <div className="bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                    <Bell className="w-4.5 h-4.5 text-foreground" />
                  </div>
                  <span className="font-medium text-foreground">In-App Toasts</span>
                </div>
                <button
                  onClick={toggleNotifications}
                  className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
                    notifications ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-5 h-5 rounded-full bg-background shadow-sm transition-all duration-300 ${
                      notifications ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Calculator Settings Section */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Calculator</h2>
          <div className="bg-secondary/50 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                  <span className="text-lg">📊</span>
                </div>
                <p className="font-medium text-foreground">Default Risk Percentage</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {["0.5", "1", "2", "3"].map((risk) => (
                  <button
                    key={risk}
                    onClick={() => handleRiskChange(risk)}
                    className={`h-11 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                      defaultRisk === risk
                        ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                        : "bg-background text-foreground border-border hover:border-foreground/30"
                    }`}
                  >
                    {risk}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Advanced Section */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Advanced</h2>
          <div className="space-y-2">
            {/* Clear History */}
            <button
              onClick={clearHistory}
              className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center gap-3 border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="w-9 h-9 bg-destructive/10 rounded-xl flex items-center justify-center">
                <Trash2 className="w-4.5 h-4.5 text-destructive" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-foreground">Clear Calculator History</p>
                <p className="text-xs text-muted-foreground">Remove all saved calculations</p>
              </div>
            </button>

            {/* Reset Onboarding */}
            <button
              onClick={resetOnboarding}
              className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center gap-3 border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                <RotateCcw className="w-4.5 h-4.5 text-foreground" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-foreground">View Welcome Screens</p>
                <p className="text-xs text-muted-foreground">Show onboarding guide again</p>
              </div>
            </button>
          </div>
        </section>

        {/* Help & Legal Section */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Help & Legal</h2>
          <div className="space-y-2">
            {/* Support Email */}
            <a
              href="mailto:info@poscalfx.com"
              className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center justify-between border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-4.5 h-4.5 text-blue-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-foreground">Support Email</p>
                  <p className="text-xs text-muted-foreground">Get help from our team</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </a>

            {/* Restore Purchase */}
            <button
              disabled
              className="w-full bg-secondary/30 rounded-2xl px-5 py-4 flex items-center justify-between border border-border/30 cursor-not-allowed opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-foreground/5 rounded-xl flex items-center justify-center">
                  <CreditCard className="w-4.5 h-4.5 text-muted-foreground" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-foreground">Restore Purchase</p>
                  <p className="text-xs text-muted-foreground">Coming soon with premium features</p>
                </div>
              </div>
            </button>

            {/* Terms and Conditions */}
            <button
              onClick={() => window.open('/terms', '_blank')}
              className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center justify-between border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5 text-foreground" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-foreground">Terms and Conditions</p>
                  <p className="text-xs text-muted-foreground">View our terms of service</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Privacy Policy */}
            <button
              onClick={() => window.open('/privacy', '_blank')}
              className="w-full bg-secondary/50 backdrop-blur-sm rounded-2xl px-5 py-4 flex items-center justify-between border border-border/50 hover:bg-secondary/80 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-foreground/10 rounded-xl flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5 text-foreground" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-foreground">Privacy Policy</p>
                  <p className="text-xs text-muted-foreground">How we protect your data</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </section>

        {/* Logout Section */}
        {user && (
          <section>
            <button
              onClick={handleLogout}
              className="w-full bg-destructive/10 rounded-2xl px-5 py-4 flex items-center gap-3 border border-destructive/30 hover:bg-destructive/20 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="w-9 h-9 bg-destructive/20 rounded-xl flex items-center justify-center">
                <LogOut className="w-4.5 h-4.5 text-destructive" />
              </div>
              <span className="font-semibold text-destructive">Sign Out</span>
            </button>
          </section>
        )}
      </main>

      {/* App Info */}
      <div className="px-6 pb-4 text-center space-y-1 pt-2">
        <p className="text-xs text-muted-foreground/80">Position Size Calculator v1.0</p>
        <p className="text-xs text-muted-foreground/60">Officially sponsored by MandeFX</p>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
