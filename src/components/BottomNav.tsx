import { BookOpen, Calculator, Radio, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';

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

  const activeIndex = navItems.findIndex(({ path }) =>
    path === '/'
      ? location.pathname === '/' || location.pathname === '/calculator'
      : location.pathname === path,
  );

  // When a persistent nav is mounted at app shell level, suppress page-level nav instances.
  if (!persistent && (window as Window & { __POSCAL_PERSISTENT_NAV_MOUNTED?: boolean }).__POSCAL_PERSISTENT_NAV_MOUNTED) {
    return null;
  }

  if (persistent) {
    (window as Window & { __POSCAL_PERSISTENT_NAV_MOUNTED?: boolean }).__POSCAL_PERSISTENT_NAV_MOUNTED = true;
  }

  return (
    <nav
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="relative flex items-center justify-around overflow-hidden rounded-2xl border border-border/60 bg-background/80 px-1.5 py-1.5 shadow-soft backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 sm:px-2">
        {activeIndex >= 0 && (
          <motion.div
            layoutId="bottom-nav-active-pill"
            className="pointer-events-none absolute inset-y-1.5 rounded-xl bg-brand/15"
            animate={{
              left: `calc(${activeIndex * (100 / navItems.length)}% + 0.25rem)`,
              width: `calc(${100 / navItems.length}% - 0.5rem)`,
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            aria-hidden="true"
          />
        )}

        {navItems.map(({ path, icon: Icon, label }, index) => {
          const isActive = index === activeIndex;

          return (
            <motion.div key={path} className="relative flex flex-1 flex-col items-center">
              <motion.button
                type="button"
                onClick={() => navigate(path)}
                whileTap={{ scale: 0.96 }}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative z-10 flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isActive
                    ? 'text-brand'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" aria-hidden="true" />
                <span className="text-[10px] font-medium leading-none sm:text-[11px]">{label}</span>
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
};
