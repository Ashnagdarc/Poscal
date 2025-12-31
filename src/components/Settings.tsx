import { useState, useEffect } from "react";
import { X, Bell, Trash2, LogOut, Smartphone, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useHaptics } from "@/hooks/use-haptics";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useAuth } from "@/contexts/AuthContext";

interface SettingsProps {
  onClose: () => void;
}

export const Settings = ({ onClose }: SettingsProps) => {
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
  };

  const handleLogout = async () => {
    lightTap();
    await signOut();
    navigate("/signin");
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col animate-slide-up">
      {/* Header */}
      <header className="pt-12 pb-4 px-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </header>

      {/* Settings List */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Appearance */}
        <div className="bg-secondary rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-medium text-foreground">Appearance</span>
            </div>
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
            onClick={promptInstall}
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
          <span className="font-medium text-destructive">Clear History</span>
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
      </div>

      {/* App Info */}
      <div className="px-6 pb-8 text-center">
        <p className="text-xs text-muted-foreground">Position Size Calculator v1.0</p>
        <p className="text-xs text-muted-foreground mt-1">Officially sponsored by MandeFX</p>
      </div>
    </div>
  );
};
