import { useCallback } from 'react';
import { useWebHaptics } from 'web-haptics/react';

import { STORAGE_KEYS } from '@/lib/constants';

type VibrationPattern = number | number[];

export const useHaptics = () => {
  const { trigger, cancel, isSupported: supported } = useWebHaptics();

  const isEnabled = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(STORAGE_KEYS.HAPTICS) !== 'false';
  }, []);

  const run = useCallback((input?: string | VibrationPattern) => {
    if (!isEnabled()) {
      return false;
    }

    void trigger(input);
    return true;
  }, [isEnabled, trigger]);

  const vibrate = useCallback((pattern: VibrationPattern = 10) => {
    return run(pattern);
  }, [run]);

  const lightTap = useCallback(() => run('light'), [run]);
  const mediumTap = useCallback(() => run('medium'), [run]);
  const heavyTap = useCallback(() => run('heavy'), [run]);
  const success = useCallback(() => run('success'), [run]);
  const error = useCallback(() => run('error'), [run]);
  const isSupported = useCallback(() => supported, [supported]);

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    success,
    error,
    cancel,
    isEnabled,
    isSupported,
  };
};
