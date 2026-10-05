export function decimalPrecision(value: number): number {
  const decimal = value.toString().split(".")[1];
  return decimal ? decimal.length : 0;
}

export function normalizeVolumeDown(volume: number, step: number): number {
  if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(step) || step <= 0) {
    return 0;
  }

  const precision = decimalPrecision(step);
  const multiplier = 10 ** precision;
  const steps = Math.floor((volume + Number.EPSILON) / step);
  return Math.round(steps * step * multiplier) / multiplier;
}
