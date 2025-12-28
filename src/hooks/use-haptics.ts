export const useHaptics = () => {
  const isEnabled = () => localStorage.getItem("hapticsEnabled") !== "false";

  const vibrate = (pattern: number | number[] = 10) => {
    if (!isEnabled()) return;
    
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Vibration not supported
      }
    }
  };

  const lightTap = () => vibrate(10);
  const mediumTap = () => vibrate(25);
  const heavyTap = () => vibrate(50);
  const success = () => vibrate([10, 50, 10]);
  const error = () => vibrate([50, 30, 50, 30, 50]);

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    success,
    error,
    isEnabled,
  };
};
