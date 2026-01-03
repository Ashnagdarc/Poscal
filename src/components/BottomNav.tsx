import { Calculator, BookOpen, Radio, History, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { VisuallyHidden } from './VisuallyHidden';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Calculator, label: 'Calculate' },
    { path: '/history', icon: History, label: 'History' },
    { path: '/journal', icon: BookOpen, label: 'Journal' },
    { path: '/signals', icon: Radio, label: 'Signals' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 pb-6 pt-2 z-40"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} aria-hidden="true" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
