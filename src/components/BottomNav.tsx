import { Calculator, BookOpen, Radio, History, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayoutEffect, useRef, useState, useCallback } from 'react';

const navItems = [
  { path: '/', icon: Calculator, label: 'Calculate' },
  { path: '/history', icon: History, label: 'History' },
  { path: '/journal', icon: BookOpen, label: 'Journal' },
  { path: '/signals', icon: Radio, label: 'Signals' },
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
      {/* Liquid Glass Container - full pill shape like reference */}
      <div 
        ref={navRef}
        className="relative flex justify-around items-center max-w-md mx-auto px-3 py-3 rounded-full
                   bg-background/80 dark:bg-card/70
                   backdrop-blur-2xl backdrop-saturate-[1.8]
                   border border-border/50 dark:border-white/10
                   shadow-[0_8px_40px_-12px_rgba(0,0,0,0.15),0_4px_20px_-8px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]
                   dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),0_4px_20px_-8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        {/* Animated Pill Indicator - smoother, always visible */}
        <div
          className={`absolute top-2 bottom-2 rounded-full
                     bg-secondary dark:bg-secondary/80
                     shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]
                     dark:shadow-[0_2px_12px_-3px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]
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
              className={`relative z-10 flex flex-col items-center gap-1 px-3 py-1.5 rounded-full
                         transition-all duration-200 ease-out
                         ${isActive
                           ? 'text-foreground'
                           : 'text-muted-foreground hover:text-foreground/80 active:scale-95'
                         }`}
            >
              <Icon 
                className={`w-5 h-5 transition-all duration-200 ${
                  isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'
                }`} 
                aria-hidden="true" 
              />
              <span className={`text-[10px] font-medium transition-opacity duration-200 ${
                isActive ? 'opacity-100' : 'opacity-60'
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