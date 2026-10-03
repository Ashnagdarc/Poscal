import { BookOpen, Calculator, CalendarDays, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/', icon: Calculator, label: 'Calculate' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '/journal', icon: BookOpen, label: 'Journal' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

interface BottomNavProps {
  persistent?: boolean;
}

export const BottomNav = ({ persistent = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const activeIndex = navItems.findIndex(({ path }) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/calculator';
    }
    if (path === '/calendar') {
      return location.pathname === '/calendar' || location.pathname === '/news';
    }
    return location.pathname === path;
  });

  // When a persistent nav is mounted at app shell level, suppress page-level nav instances.
  if (!persistent && (window as Window & { __POSCAL_PERSISTENT_NAV_MOUNTED?: boolean }).__POSCAL_PERSISTENT_NAV_MOUNTED) {
    return null;
  }

  if (persistent) {
    (window as Window & { __POSCAL_PERSISTENT_NAV_MOUNTED?: boolean }).__POSCAL_PERSISTENT_NAV_MOUNTED = true;
  }

  const handleNav = (path: string) => {
    // Guests can open Calculate freely; other destinations need auth (MC-023).
    if (!user && path !== '/') {
      navigate(`/signin?returnTo=${encodeURIComponent(path)}&reason=protected`);
      return;
    }
    navigate(path);
  };

  return (
    <nav
      className="z-40 shrink-0 border-t border-border/60 bg-background/95 px-3 pt-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="relative mx-auto flex h-14 w-full max-w-md items-center justify-around overflow-hidden rounded-2xl border border-border/60 bg-secondary/50 px-1.5">
        {activeIndex >= 0 && (
          <motion.div
            className="pointer-events-none absolute inset-y-1.5 rounded-xl bg-background shadow-sm"
            initial={false}
            animate={{
              left: `calc(${activeIndex * (100 / navItems.length)}% + 0.25rem)`,
              width: `calc(${100 / navItems.length}% - 0.5rem)`,
            }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />
        )}

        {navItems.map(({ path, icon: Icon, label }, index) => {
          const isActive = index === activeIndex;
          const locked = !user && path !== '/';

          return (
            <motion.div key={path} className="relative flex flex-1 flex-col items-center">
              <motion.button
                type="button"
                onClick={() => handleNav(path)}
                whileTap={{ scale: 0.96 }}
                aria-label={locked ? `${label} (sign in required)` : label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative z-10 flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isActive
                    ? 'text-brand'
                    : locked
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" aria-hidden="true" />
                <span className="max-w-full truncate whitespace-nowrap text-[10px] font-medium leading-none sm:text-[11px]">
                  {locked ? `${label}` : label}
                </span>
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
};
