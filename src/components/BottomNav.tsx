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
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="relative flex items-center justify-around overflow-hidden rounded-full border border-border/50 bg-background/70 px-2 py-1.5 shadow-xl backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55 sm:px-3">
        {activeIndex >= 0 && (
          <motion.div
            layoutId="bottom-nav-active-glow"
            className="pointer-events-none absolute h-12 w-12 rounded-full bg-gradient-to-r from-primary/70 to-violet-500/70 blur-2xl"
            animate={{
              left: `calc(${activeIndex * (100 / navItems.length)}% + ${100 / navItems.length / 2}%)`,
              translateX: '-50%',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            aria-hidden="true"
          />
        )}

        {navItems.map(({ path, icon: Icon, label }, index) => {
          const isActive = index === activeIndex;

          return (
            <motion.div key={path} className="group relative flex flex-1 flex-col items-center">
              <motion.button
                type="button"
                onClick={() => navigate(path)}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.92 }}
                animate={{ scale: isActive ? 1.18 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-12 sm:w-12 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" aria-hidden="true" />
              </motion.button>

              <span className="pointer-events-none absolute bottom-full mb-3 rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
};
