import { useRef, type ReactNode, type Ref } from "react";
import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarDaysIcon } from "@/components/ui/calendar-days";
import { ChartLineIcon } from "@/components/ui/chart-line";
import { FileStackIcon } from "@/components/ui/file-stack";
import { SettingsIcon } from "@/components/ui/settings";
import { useAuth } from "@/contexts/AuthContext";

interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface NavItem {
  path: string;
  label: string;
  renderIcon: (ref: Ref<AnimatedIconHandle>) => ReactNode;
}

const iconClassName = "flex h-5 w-5 items-center justify-center";

const navItems: NavItem[] = [
  {
    path: "/",
    label: "Calculate",
    renderIcon: (ref) => (
      <ChartLineIcon
        ref={ref}
        aria-hidden="true"
        data-animated-icon="nav-calculate"
        size={18}
        className={iconClassName}
      />
    ),
  },
  {
    path: "/calendar",
    label: "Calendar",
    renderIcon: (ref) => (
      <CalendarDaysIcon
        ref={ref}
        aria-hidden="true"
        data-animated-icon="nav-calendar"
        size={18}
        className={iconClassName}
      />
    ),
  },
  {
    path: "/journal",
    label: "Journal",
    renderIcon: (ref) => (
      <FileStackIcon
        ref={ref}
        aria-hidden="true"
        data-animated-icon="nav-journal"
        size={18}
        className={iconClassName}
      />
    ),
  },
  {
    path: "/settings",
    label: "Settings",
    renderIcon: (ref) => (
      <SettingsIcon
        ref={ref}
        aria-hidden="true"
        data-animated-icon="nav-settings"
        size={18}
        className={iconClassName}
      />
    ),
  },
];

interface BottomNavProps {
  persistent?: boolean;
}

export const BottomNav = ({ persistent = false }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const activeIndex = navItems.findIndex(({ path }) => {
    if (path === "/") {
      return location.pathname === "/" || location.pathname === "/calculator";
    }
    if (path === "/calendar") {
      return location.pathname === "/calendar" || location.pathname === "/news";
    }
    if (path === "/settings") {
      return (
        location.pathname === "/settings" || location.pathname === "/profile"
      );
    }
    return location.pathname === path;
  });

  // When a persistent nav is mounted at app shell level, suppress page-level nav instances.
  if (
    !persistent &&
    (window as Window & { __POSCAL_PERSISTENT_NAV_MOUNTED?: boolean })
      .__POSCAL_PERSISTENT_NAV_MOUNTED
  ) {
    return null;
  }

  if (persistent) {
    (
      window as Window & { __POSCAL_PERSISTENT_NAV_MOUNTED?: boolean }
    ).__POSCAL_PERSISTENT_NAV_MOUNTED = true;
  }

  const handleNav = (path: string) => {
    // Guests can open Calculate freely; other destinations need auth (MC-023).
    if (!user && path !== "/") {
      navigate(`/signin?returnTo=${encodeURIComponent(path)}&reason=protected`);
      return;
    }
    navigate(path);
  };

  return (
    <nav
      className="z-40 shrink-0 border-t border-border/60 bg-background/95 px-3 pt-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
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

        {navItems.map((item, index) => {
          const isActive = index === activeIndex;
          const locked = !user && item.path !== "/";

          return (
            <BottomNavItem
              key={item.path}
              item={item}
              isActive={isActive}
              locked={locked}
              onNavigate={handleNav}
            />
          );
        })}
      </div>
    </nav>
  );
};

function BottomNavItem({
  item,
  isActive,
  locked,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  locked: boolean;
  onNavigate: (path: string) => void;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const startIconAnimation = () => iconRef.current?.startAnimation();
  const stopIconAnimation = () => iconRef.current?.stopAnimation();

  return (
    <motion.div className="relative flex flex-1 flex-col items-center">
      <motion.button
        type="button"
        onClick={() => onNavigate(item.path)}
        onMouseEnter={startIconAnimation}
        onMouseLeave={stopIconAnimation}
        onFocus={startIconAnimation}
        onBlur={stopIconAnimation}
        whileTap={{ scale: 0.96 }}
        aria-label={locked ? `${item.label} (sign in required)` : item.label}
        aria-current={isActive ? "page" : undefined}
        className={`relative z-10 flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isActive
            ? "text-brand"
            : locked
              ? "text-muted-foreground/50"
              : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {item.renderIcon(iconRef)}
        <span className="max-w-full truncate whitespace-nowrap text-[10px] font-medium leading-none sm:text-[11px]">
          {item.label}
        </span>
      </motion.button>
    </motion.div>
  );
}
