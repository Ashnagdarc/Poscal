import { useRef } from 'react';

export const useHaptics = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const isEnabled = () => localStorage.getItem("hapticsEnabled") !== "false";

  const isSupported = () => {
    return typeof navigator !== "undefined" && "vibrate" in navigator;
  };

  // Initialize audio context lazily
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch (_e) {
        return null;
      }
    }
    return audioContextRef.current;
  };

  // Audio feedback for iOS devices
  const playTapSound = (duration: 'short' | 'medium' | 'long' = 'short') => {
    if (!isEnabled()) return;
    
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;

      // Resume context if suspended (iOS requirement)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different tap types
      const frequencies = {
        short: 1200,
        medium: 900,
        long: 700
      };
      
      oscillator.frequency.value = frequencies[duration];
      oscillator.type = 'sine';
      
      // Very subtle volume and quick fade
      const now = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0.05, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      
      oscillator.start(now);
      oscillator.stop(now + 0.04);
      
      // Clean up
      setTimeout(() => {
        try {
          oscillator.disconnect();
          gainNode.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }, 100);
    } catch (error) {
      // Audio not supported or blocked
      console.debug('Audio feedback failed:', error);
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
