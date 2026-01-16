import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { X } from 'lucide-react';

const STORAGE_KEY = 'poscal.upgradeBanner.dismissed';

export const UpgradeBanner: React.FC = () => {
  const { isPaid, isLoading } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // If user becomes paid, clear dismissal so banner won't reappear next time
    if (isPaid) {
      setDismissed(true);
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    }
  }, [isPaid]);

  if (isLoading || isPaid || dismissed) return null;

  return (
    <div className="w-full bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 fixed top-16 left-0 right-0 z-40 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div>
          <strong className="block">Upgrade to Premium</strong>
          <span className="text-sm block">Unlock unlimited features — journal, signals, and history.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/upgrade?tier=premium&redirectPath=/')}
            className="bg-amber-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-amber-700"
          >
            Upgrade
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
            }}
            aria-label="Dismiss upgrade banner"
            className="p-1 rounded-md hover:bg-amber-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeBanner;
