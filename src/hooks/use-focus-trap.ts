import { useEffect, useRef, RefObject } from 'react';

/**
 * Custom hook to trap focus within a container element
 * Useful for modals and dialogs to ensure keyboard users stay within the modal
 */
export const useFocusTrap = (isActive: boolean): RefObject<HTMLDivElement> => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Store previously focused element
    const previouslyFocused = document.activeElement as HTMLElement;

    // Focus first element
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleTabKey);
      // Restore focus to previously focused element
      previouslyFocused?.focus();
    };
  }, [isActive]);

  return containerRef;
};
