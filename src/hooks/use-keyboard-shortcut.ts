import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Custom hook for keyboard shortcuts
 * @param shortcuts - Array of shortcut configurations with handlers
 * @param enabled - Whether shortcuts are enabled
 */
export const useKeyboardShortcut = (
  shortcuts: Array<KeyboardShortcutOptions & { handler: () => void }>,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach(({ key, ctrl, shift, alt, meta, handler }) => {
        const matchesKey = e.key.toLowerCase() === key.toLowerCase();
        const matchesCtrl = ctrl ? e.ctrlKey : !e.ctrlKey;
        const matchesShift = shift ? e.shiftKey : !e.shiftKey;
        const matchesAlt = alt ? e.altKey : !e.altKey;
        const matchesMeta = meta ? e.metaKey : !e.metaKey;

        if (matchesKey && matchesCtrl && matchesShift && matchesAlt && matchesMeta) {
          e.preventDefault();
          handler();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
};
