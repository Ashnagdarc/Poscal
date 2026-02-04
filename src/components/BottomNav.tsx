import { Calculator, BookOpen, Radio, History, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayoutEffect, useRef, useState, useCallback } from 'react';

const navItems = [
  { path: '/', icon: Calculator, label: 'Calculate' },
  { path: '/signals', icon: Radio, label: 'Signals' },
  { path: '/journal', icon: BookOpen, label: 'Journal' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  const activeIndex = navItems.findIndex(item => item.path === location.pathname);

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
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Liquid Glass Container */}
      <div 
        ref={navRef}
        className="relative isolate flex justify-around items-center max-w-md mx-auto px-3 py-3.5 rounded-[2rem]
                   bg-[linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.08))]
                   dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))]
                   backdrop-blur-3xl backdrop-saturate-[1.9]
                   border border-white/40 dark:border-white/10
                   shadow-[0_20px_45px_-22px_rgba(0,0,0,0.45),0_8px_20px_-12px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.55)]
                   dark:shadow-[0_24px_52px_-24px_rgba(0,0,0,0.8),0_10px_24px_-16px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]"
      >
        {/* Glass sheen */}
        <div className="pointer-events-none absolute inset-x-3 top-[3px] h-1/2 rounded-[1.6rem] bg-gradient-to-b from-white/45 via-white/10 to-transparent dark:from-white/15 dark:via-white/5 dark:to-transparent" />

        {/* Floating glow */}
        <div className="pointer-events-none absolute -inset-1 rounded-[2.2rem] bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.22),transparent_60%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_60%)]" />

        {/* Animated active pill */}
        <div
          className={`absolute top-1.5 bottom-1.5 rounded-full
                     bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.72))]
                     dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(255,255,255,0.1))]
                     shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)]
                     dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.2)]
                     ${isInitialized ? 'transition-all duration-[400ms] ease-[cubic-bezier(0.25,1,0.5,1)]' : ''}`}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: activeIndex >= 0 && isInitialized ? 1 : 0,
          }}
        />

        {navItems.map(({ path, icon: Icon, label }, index) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              ref={(el) => { buttonRefs.current[index] = el; }}
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative z-10 flex flex-col items-center gap-1 px-3 py-1 rounded-full
                         transition-all duration-300 ease-out
                         ${isActive
                           ? 'text-[#0f1115] dark:text-white -translate-y-[1px]'
                           : 'text-muted-foreground hover:text-foreground/85 active:scale-95'
                         }`}
            >
              <Icon 
                className={`w-5 h-5 transition-all duration-300 ${
                  isActive ? 'stroke-[2.3] drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)] dark:drop-shadow-[0_1px_4px_rgba(255,255,255,0.35)]' : 'stroke-[1.7]'
                }`} 
                aria-hidden="true" 
              />
              <span className={`text-[10px] font-medium tracking-[0.01em] transition-all duration-300 ${
                isActive ? 'opacity-100' : 'opacity-65'
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
