import { Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { useSounds } from "@/hooks/use-sounds";
import { useHaptics } from "@/hooks/use-haptics";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle = ({ className = "" }: ThemeToggleProps) => {
  const [isDark, setIsDark] = useState(false);
  const { toggle: playToggle } = useSounds();
  const { lightTap } = useHaptics();

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    playToggle();
    lightTap();

    if (newValue) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`relative w-16 h-8 rounded-full transition-all duration-500 ease-out overflow-hidden ${className}`}
      style={{
        background: isDark
          ? "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(230 20% 20%) 100%)"
          : "linear-gradient(135deg, hsl(45 100% 85%) 0%, hsl(200 80% 85%) 100%)",
      }}
      aria-label="Toggle theme"
    >
      {/* Stars (dark mode) */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark ? "opacity-100" : "opacity-0"
        }`}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              top: `${20 + i * 12}%`,
              left: `${15 + i * 15}%`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Sun rays (light mode) */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="absolute top-1 right-3 w-1.5 h-1.5 bg-yellow-300/60 rounded-full" />
        <div className="absolute bottom-2 right-8 w-1 h-1 bg-orange-300/50 rounded-full" />
      </div>

      {/* Toggle circle with icon */}
      <div
        className={`absolute top-1 w-6 h-6 rounded-full shadow-lg transition-all duration-500 ease-out flex items-center justify-center ${
          isDark
            ? "translate-x-9 bg-slate-700"
            : "translate-x-1 bg-gradient-to-br from-yellow-300 to-orange-400"
        }`}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-slate-200" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-yellow-700" />
        )}
      </div>
    </button>
  );
};
