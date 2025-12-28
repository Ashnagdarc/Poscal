import { useCallback, useRef } from "react";

type SoundType = "tap" | "toggle" | "success" | "error" | "calculate";

const SOUNDS: Record<SoundType, () => AudioBuffer | null> = {
  tap: createTapSound,
  toggle: createToggleSound,
  success: createSuccessSound,
  error: createErrorSound,
  calculate: createCalculateSound,
};

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

function createTapSound(): AudioBuffer | null {
  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
  }
  return buffer;
}

function createToggleSound(): AudioBuffer | null {
  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const freq = 800;
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 20) * 0.3;
  }
  return buffer;
}

function createSuccessSound(): AudioBuffer | null {
  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const freq = t < 0.1 ? 523 : 659;
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 8) * 0.3;
  }
  return buffer;
}

function createErrorSound(): AudioBuffer | null {
  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 10) * 0.3;
  }
  return buffer;
}

function createCalculateSound(): AudioBuffer | null {
  const ctx = getAudioContext();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const freq = 400 + t * 800;
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 15) * 0.25;
  }
  return buffer;
}

export const useSounds = () => {
  const soundsEnabled = useRef(localStorage.getItem("soundsEnabled") !== "false");

  const play = useCallback((type: SoundType) => {
    if (!soundsEnabled.current) return;
    
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      
      const buffer = SOUNDS[type]();
      if (!buffer) return;
      
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.gain.value = 0.5;
      source.start();
    } catch (e) {
      // Audio not supported
    }
  }, []);

  const tap = useCallback(() => play("tap"), [play]);
  const toggle = useCallback(() => play("toggle"), [play]);
  const success = useCallback(() => play("success"), [play]);
  const error = useCallback(() => play("error"), [play]);
  const calculate = useCallback(() => play("calculate"), [play]);

  const setEnabled = useCallback((enabled: boolean) => {
    soundsEnabled.current = enabled;
    localStorage.setItem("soundsEnabled", String(enabled));
  }, []);

  return {
    play,
    tap,
    toggle,
    success,
    error,
    calculate,
    setEnabled,
    isEnabled: () => soundsEnabled.current,
  };
};
