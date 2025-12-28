import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Trash2, LogOut, User, ChevronRight, Smartphone, Download, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BottomNav } from "@/components/BottomNav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useHaptics } from "@/hooks/use-haptics";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [defaultRisk, setDefaultRisk] = useState("1");
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const { lightTap } = useHaptics();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

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
      <header className="pt-12 pb-4 px-6 flex items-center gap-3 animate-fade-in">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </header>

      {/* Settings List */}
      <main className="flex-1 overflow-y-auto px-6 py-4 space-y-4 animate-slide-up">
        {/* Account Section */}
        {user ? (
          <div className="bg-secondary rounded-2xl overflow-hidden">
            <button
              onClick={() => navigate("/profile")}
              className="w-full px-4 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-foreground/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-foreground" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{user.email}</p>
                  <p className="text-sm text-muted-foreground">View profile</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/signin")}
            className="w-full bg-secondary rounded-2xl px-4 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-foreground" />
              <span className="font-medium text-foreground">Sign In</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        )}

        {/* Appearance */}
        <div className="bg-secondary rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="font-medium text-foreground">Appearance</span>
            <ThemeToggle />
          </div>
        </div>

        {/* Haptics */}
        <div className="bg-secondary rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-foreground" />
              <span className="font-medium text-foreground">Haptic Feedback</span>
            </div>
            <button
              onClick={toggleHaptics}
              className={`w-12 h-7 rounded-full transition-all duration-300 ${
                hapticsEnabled ? "bg-foreground" : "bg-muted"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-background transition-all duration-300 ${
                  hapticsEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-secondary rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-foreground" />
              <span className="font-medium text-foreground">Notifications</span>
            </div>
            <button
              onClick={toggleNotifications}
              className={`w-12 h-7 rounded-full transition-all duration-300 ${
                notifications ? "bg-foreground" : "bg-muted"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-background transition-all duration-300 ${
                  notifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Install App */}
        {isInstallable && !isInstalled && (
          <button
            onClick={handleInstall}
            className="w-full bg-primary/10 rounded-2xl px-4 py-3 flex items-center gap-3 transition-all duration-200 active:scale-[0.98]"
          >
            <Download className="w-5 h-5 text-primary" />
            <span className="font-medium text-primary">Install App</span>
          </button>
        )}

        {/* Default Risk */}
        <div className="bg-secondary rounded-2xl overflow-hidden">
          <div className="px-4 py-3">
            <p className="font-medium text-foreground mb-3">Default Risk %</p>
            <div className="flex gap-2">
              {["0.5", "1", "2", "3"].map((risk) => (
                <button
                  key={risk}
                  onClick={() => handleRiskChange(risk)}
                  className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    defaultRisk === risk
                      ? "bg-foreground text-background"
                      : "bg-background text-foreground"
                  }`}
                >
                  {risk}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Clear History */}
        <button
          onClick={clearHistory}
          className="w-full bg-secondary rounded-2xl px-4 py-3 flex items-center gap-3 transition-all duration-200 active:scale-[0.98]"
        >
          <Trash2 className="w-5 h-5 text-destructive" />
          <span className="font-medium text-destructive">Clear Calculator History</span>
        </button>

        {/* Reset Onboarding */}
        <button
          onClick={resetOnboarding}
          className="w-full bg-secondary rounded-2xl px-4 py-3 flex items-center gap-3 transition-all duration-200 active:scale-[0.98]"
        >
          <RotateCcw className="w-5 h-5 text-foreground" />
          <span className="font-medium text-foreground">View Welcome Screens Again</span>
        </button>

        {/* Logout */}
        {user && (
          <button
            onClick={handleLogout}
            className="w-full bg-secondary rounded-2xl px-4 py-3 flex items-center gap-3 transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5 text-foreground" />
            <span className="font-medium text-foreground">Sign Out</span>
          </button>
        )}
      </main>

      {/* App Info */}
      <div className="px-6 pb-4 text-center">
        <p className="text-xs text-muted-foreground">Position Size Calculator v1.0</p>
        <p className="text-xs text-muted-foreground mt-1">Made with ♥ for traders</p>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
