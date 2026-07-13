import { BookOpen, Calculator, History, Radio, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLayoutEffect, useRef, useState, useCallback } from "react";

const navItems = [
  { path: "/", icon: Calculator, label: "Calculate" },
  { path: "/signals", icon: Radio, label: "Signals" },
  { path: "/journal", icon: BookOpen, label: "Journal" },
  { path: "/history", icon: History, label: "History" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export const BottomNav = () => {
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  const activeIndex = navItems.findIndex(
    (item) => item.path === location.pathname,
  );

  const updateIndicator = useCallback(() => {
    if (navRef.current && activeIndex >= 0) {
      const activeButton = buttonRefs.current[activeIndex];
      if (activeButton) {
        const navRect = navRef.current.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        setIndicatorStyle({
          left: buttonRect.left - navRect.left - 6,
          width: buttonRect.width + 12,
        });
        if (!isInitialized) setIsInitialized(true);
      }
    }
  }, [activeIndex, isInitialized]);

  // Use layoutEffect to measure before paint - prevents flicker
  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Also update on resize
  useLayoutEffect(() => {
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-3"
      role="navigation"
      aria-label="Main navigation"
    >
      <div
        ref={navRef}
        className="relative isolate mx-auto flex max-w-[31rem] items-center justify-around rounded-[1.5rem] border border-white/8 bg-[#090909]/94 px-2.5 py-2 shadow-[0_14px_28px_-22px_rgba(0,0,0,0.9)] backdrop-blur-lg"
      >
        <div
          className={`pointer-events-none absolute top-1 bottom-1 rounded-[1.2rem] border border-white/10 bg-white/[0.08] shadow-[0_10px_18px_-14px_rgba(0,0,0,0.9)] ${isInitialized ? "transition-all duration-500 ease-out" : ""}`}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: activeIndex >= 0 && isInitialized ? 1 : 0,
            transitionTimingFunction: isInitialized
              ? "cubic-bezier(0.25, 1, 0.5, 1)"
              : undefined,
          }}
        />

        {navItems.map(({ path, icon: Icon, label }, index) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              ref={(el) => {
                buttonRefs.current[index] = el as HTMLButtonElement | null;
              }}
              to={path}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={`relative z-10 flex min-w-[4.4rem] flex-col items-center gap-1 rounded-[1rem] px-2 py-1.25 transition-all duration-300 ease-out ${isActive ? "text-white -translate-y-[1px]" : "text-white/55 hover:text-white/85 active:scale-95"}`}
            >
              <Icon
                className={`h-[1.15rem] w-[1.15rem] transition-all duration-300 ${isActive ? "stroke-[2.2]" : "stroke-[1.75]"}`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] font-medium tracking-[0.01em] transition-all duration-300 ${isActive ? "text-white" : "text-white/42"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
