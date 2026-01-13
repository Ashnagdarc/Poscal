import { Calculator, BookOpen, Radio, History, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const navItems = [
    { path: '/', icon: Calculator, label: 'Calculate' },
    { path: '/history', icon: History, label: 'History' },
    { path: '/journal', icon: BookOpen, label: 'Journal' },
    { path: '/signals', icon: Radio, label: 'Signals' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const activeIndex = navItems.findIndex(item => item.path === location.pathname);

  useEffect(() => {
    if (navRef.current && activeIndex >= 0) {
      const buttons = navRef.current.querySelectorAll('button');
      const activeButton = buttons[activeIndex];
      if (activeButton) {
        const navRect = navRef.current.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        setIndicatorStyle({
          left: buttonRect.left - navRect.left - 8,
          width: buttonRect.width + 16,
        });
      }
    }
  }, [activeIndex, location.pathname]);

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-3"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Liquid Glass Container */}
      <div 
        ref={navRef}
        className="relative flex justify-around items-center max-w-md mx-auto px-2 py-2 rounded-[28px] 
                   bg-background/70 dark:bg-card/60
                   backdrop-blur-xl backdrop-saturate-150
                   border border-white/20 dark:border-white/10
                   shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.4)]
                   dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4),0_4px_16px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]"
      >
        {/* Animated Pill Indicator */}
        <div
          className="absolute top-2 h-[calc(100%-16px)] rounded-[20px] 
                     bg-secondary/80 dark:bg-secondary/60
                     shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]
                     dark:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)]
                     transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: activeIndex >= 0 ? 1 : 0,
          }}
        />

        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative z-10 flex flex-col items-center gap-1 px-4 py-2 rounded-[16px] 
                         transition-all duration-300 ease-out
                         ${isActive
                           ? 'text-foreground scale-105'
                           : 'text-muted-foreground hover:text-foreground/80 active:scale-95'
                         }`}
            >
              <Icon 
                className={`w-5 h-5 transition-all duration-300 ${
                  isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'
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
