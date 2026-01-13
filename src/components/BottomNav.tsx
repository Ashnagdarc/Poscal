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
  const [isAnimating, setIsAnimating] = useState(false);

  const activeIndex = navItems.findIndex(item => item.path === location.pathname);
  const prevIndexRef = useRef(activeIndex);

  const updateIndicator = useCallback(() => {
    if (navRef.current && activeIndex >= 0) {
      const activeButton = buttonRefs.current[activeIndex];
      if (activeButton) {
        const navRect = navRef.current.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        
        // Trigger bounce animation when changing tabs
        if (isInitialized && prevIndexRef.current !== activeIndex) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 500);
        }
        prevIndexRef.current = activeIndex;
        
        setIndicatorStyle({
          left: buttonRect.left - navRect.left - 6,
          width: buttonRect.width + 12,
        });
        if (!isInitialized) setIsInitialized(true);
      }
    }
  }, [activeIndex, isInitialized]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

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
      {/* Liquid Glass Container - Apple-style frosted glass */}
      <div 
        ref={navRef}
        className="relative flex justify-around items-center max-w-md mx-auto px-2 py-2.5 rounded-[32px]
                   bg-white/60 dark:bg-black/40
                   backdrop-blur-3xl backdrop-saturate-200
                   border border-white/30 dark:border-white/[0.08]
                   shadow-[0_2px_24px_-4px_rgba(0,0,0,0.08),0_8px_48px_-12px_rgba(0,0,0,0.12),inset_0_0.5px_0_rgba(255,255,255,0.8),inset_0_-0.5px_0_rgba(0,0,0,0.05)]
                   dark:shadow-[0_2px_24px_-4px_rgba(0,0,0,0.3),0_8px_48px_-12px_rgba(0,0,0,0.4),inset_0_0.5px_0_rgba(255,255,255,0.1),inset_0_-0.5px_0_rgba(0,0,0,0.2)]"
        style={{
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        }}
      >
        {/* Animated Pill Indicator with spring bounce */}
        <div
          className={`absolute top-1.5 bottom-1.5 rounded-[26px] pointer-events-none
                     bg-white/90 dark:bg-white/[0.12]
                     shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,1)]
                     dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_12px_-2px_rgba(0,0,0,0.3),inset_0_0.5px_0_rgba(255,255,255,0.15)]
                     ${isInitialized 
                       ? isAnimating 
                         ? 'transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]' 
                         : 'transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)]'
                       : ''
                     }`}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: activeIndex >= 0 && isInitialized ? 1 : 0,
            transform: isAnimating ? 'scale(1.02)' : 'scale(1)',
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
              className={`relative z-10 flex flex-col items-center gap-0.5 px-4 py-2 rounded-[22px]
                         transition-all duration-300 ease-out select-none
                         active:scale-[0.92] active:opacity-70
                         ${isActive
                           ? 'text-foreground'
                           : 'text-muted-foreground/70 hover:text-muted-foreground'
                         }`}
            >
              <Icon 
                className={`w-[22px] h-[22px] transition-all duration-300 ${
                  isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'
                }`} 
                aria-hidden="true" 
              />
              <span className={`text-[10px] font-semibold tracking-tight transition-all duration-300 ${
                isActive ? 'opacity-100' : 'opacity-50'
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