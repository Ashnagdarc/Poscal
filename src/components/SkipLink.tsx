/**
 * Skip Link component for keyboard navigation
 * Allows users to skip directly to main content
 */
export const SkipLink = () => {
  const handleSkip = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      // Remove tabindex after focus to restore natural tab order
      setTimeout(() => main.removeAttribute('tabindex'), 100);
    }
  };

  return (
    <a
      href="#main-content"
      onClick={handleSkip}
      className="fixed top-0 left-0 z-[9999] bg-foreground text-background px-4 py-2 font-medium 
                 -translate-y-full focus:translate-y-0 transition-transform duration-200"
    >
      Skip to main content
    </a>
  );
};
