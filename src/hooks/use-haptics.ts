export const useHaptics = () => {
  const isEnabled = () => localStorage.getItem("hapticsEnabled") !== "false";

  const isSupported = () => {
    return typeof navigator !== "undefined" && "vibrate" in navigator;
  };

  // Audio feedback for iOS devices
  const playTapSound = (duration: 'short' | 'medium' | 'long' = 'short') => {
    if (!isEnabled()) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different tap types
      const frequencies = {
        short: 1000,
        medium: 800,
        long: 600
      };
      
      oscillator.frequency.value = frequencies[duration];
      oscillator.type = 'sine';
      
      // Quick fade out for a tap effect
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    } catch (error) {
      // Audio not supported or blocked
    }
  };

  const vibrate = (pattern: number | number[] = 10) => {
    if (!isEnabled()) return false;
    
    if (isSupported()) {
      try {
        const result = navigator.vibrate(pattern);
        return result;
      } catch (error) {
        console.warn("Vibration failed:", error);
        return false;
      }
    } else {
      // Fallback to audio for iOS
      playTapSound('short');
      return true;
    }
    return false;
  };

  const lightTap = () => {
    if (isSupported()) {
      return vibrate(10);
    } else {
      playTapSound('short');
      return true;
    }
  };
  
  const mediumTap = () => {
    if (isSupported()) {
      return vibrate(25);
    } else {
      playTapSound('medium');
      return true;
    }
  };
  
  const heavyTap = () => {
    if (isSupported()) {
      return vibrate(50);
    } else {
      playTapSound('long');
      return true;
    }
  };
  
  const success = () => {
    if (isSupported()) {
      return vibrate([10, 50, 10]);
    } else {
      playTapSound('short');
      setTimeout(() => playTapSound('short'), 100);
      return true;
    }
  };
  
  const error = () => {
    if (isSupported()) {
      return vibrate([50, 30, 50, 30, 50]);
    } else {
      playTapSound('long');
      setTimeout(() => playTapSound('long'), 80);
      setTimeout(() => playTapSound('long'), 160);
      return true;
    }
  };

  return {
    vibrate,
    lightTap,
    mediumTap,
    heavyTap,
    success,
    error,
    isEnabled,
    isSupported,
  };
};
