export function decimalPrecision(value: number): number {
  const decimal = value.toString().split(".")[1];
  return decimal ? decimal.length : 0;
}

/**
 * Floor a raw position to the broker volume step without letting binary
 * floating-point artifacts turn an exact step (0.20) into the previous one
 * (0.19). The tolerance only snaps values that are effectively an integer
 * number of steps; materially smaller values are still rounded down.
 */
export function normalizeVolumeDown(volume: number, step: number): number {
  if (
    !Number.isFinite(volume) ||
    volume <= 0 ||
    !Number.isFinite(step) ||
    step <= 0
  ) {
    return 0;
  }

  const precision = decimalPrecision(step);
  const rawSteps = volume / step;
  const nearestStep = Math.round(rawSteps);
  const tolerance = 1e-10 * Math.max(1, Math.abs(rawSteps));
  const stepCount =
    Math.abs(rawSteps - nearestStep) <= tolerance
      ? nearestStep
      : Math.floor(rawSteps);

  return Number((stepCount * step).toFixed(precision));
}
