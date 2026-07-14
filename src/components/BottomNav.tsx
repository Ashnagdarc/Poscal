import { Calculator, BookOpen, Radio, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayoutEffect, useRef, useState, useCallback } from 'react';

const navItems = [
  { path: '/', icon: Calculator, label: 'Calculate' },
  { path: '/signals', icon: Radio, label: 'Signals' },
  { path: '/journal', icon: BookOpen, label: 'Journal' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

interface BottomNavProps {
  persistent?: boolean;
}

export const BottomNav = ({ persistent = false }: BottomNavProps) => {
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

  // When a persistent nav is mounted at app shell level, suppress page-level nav instances.
  if (!persistent && (window as any).__POSCAL_PERSISTENT_NAV_MOUNTED) {
    return null;
  }

  if (persistent) {
    (window as any).__POSCAL_PERSISTENT_NAV_MOUNTED = true;
  }

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3"
      role="navigation"
      aria-label="Main navigation"
    >
      <div 
        ref={navRef}
        className="relative flex justify-around items-center max-w-md mx-auto px-2 py-2 rounded-[1.75rem]
                   border border-border/70 bg-background/95
                   shadow-[0_14px_34px_-20px_rgba(0,0,0,0.65)]"
      >
        <div
          className={`absolute top-2 bottom-2 rounded-[1.2rem] border border-border/80
                     bg-secondary
                     shadow-[0_8px_18px_-14px_rgba(0,0,0,0.6)]
                    ${isInitialized ? 'transition-all duration-500 ease-out' : ''}`}
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: activeIndex >= 0 && isInitialized ? 1 : 0,
            transitionTimingFunction: isInitialized ? 'cubic-bezier(0.25, 1, 0.5, 1)' : undefined,
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
              className={`relative z-10 flex min-w-0 flex-col items-center gap-1 px-3 py-2 rounded-[1.2rem]
                         transition-all duration-300 ease-out
                         ${isActive
                           ? 'text-foreground'
                           : 'text-muted-foreground hover:text-foreground/85 active:scale-95'
                         }`}
            >
              <Icon 
                className={`w-5 h-5 transition-all duration-300 ${
                  isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'
                }`} 
                aria-hidden="true" 
              />
              <span className={`text-[10px] font-medium transition-all duration-300 ${
                isActive ? 'opacity-100' : 'opacity-70'
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
