import { Calculator, History, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLayoutEffect, useRef, useState, useCallback } from 'react';

const navItems = [
  { path: '/', icon: Calculator, label: 'Calculate' },
  { path: '/history', icon: History, label: 'History' },
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
      {/* Liquid Glass Container */}
      <div 
        ref={navRef}
        className="relative isolate flex justify-around items-center max-w-[28rem] mx-auto px-3 py-2.5 rounded-[2rem]
                   bg-[#141414]
                   border border-white/10
                   shadow-[0_14px_32px_-24px_rgba(0,0,0,0.85)]"
      >
        {/* Animated active orb */}
        <div
          className={`absolute top-1 bottom-1 rounded-[1.75rem]
                     bg-[#2a2a2a]
                     border border-white/10
                     shadow-[0_12px_24px_-18px_rgba(0,0,0,0.95)]
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
            className={`relative z-10 flex min-w-[4.7rem] flex-col items-center gap-1 px-2.5 py-1.5 rounded-[1.4rem]
                         transition-all duration-300 ease-out
                         ${isActive
                           ? 'text-white -translate-y-[1px]'
                           : 'text-white/55 hover:text-white/82 active:scale-95'
                         }`}
            >
              <Icon 
                className={`w-5 h-5 transition-all duration-300 ${
                  isActive ? 'stroke-[2.25] drop-shadow-[0_0_10px_rgba(255,255,255,0.14)]' : 'stroke-[1.8]'
                }`} 
                aria-hidden="true" 
              />
              <span className={`text-[11px] font-medium tracking-[0.01em] transition-all duration-300 ${
                isActive ? 'opacity-100 text-white/92' : 'opacity-75 text-white/45'
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
