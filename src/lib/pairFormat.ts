import { getPriceDecimals } from "@/lib/calculatorModeSync";
import { getInstrumentSpec } from "@/lib/positionSizeCalculator";
import { getInstrumentSpecBySymbol } from "@/lib/instrumentSpecs";

/** Normalize broker-style symbols into slash form when possible (EURUSD → EUR/USD). */
export function canonicalizePairSymbol(symbol: string): string {
  const normalized = symbol
    .trim()
    .toUpperCase()
    .replace(/-/g, "/")
    .replace(/\s+/g, "");

  if (!normalized) return "";
  if (normalized.includes("/")) return normalized;

  if (/^[A-Z]{6}$/.test(normalized)) {
    return `${normalized.slice(0, 3)}/${normalized.slice(3)}`;
  }

  return normalized;
}

export function getPairPriceDecimals(symbol: string): number {
  const pair = canonicalizePairSymbol(symbol);
  const spec = getInstrumentSpec(pair) ?? getInstrumentSpecBySymbol(pair);
  if (spec) return getPriceDecimals(spec);

  if (pair.includes("JPY")) return 2;
  if (pair.includes("XAG")) return 3;
  if (pair.includes("XAU") || pair.includes("BTC") || pair.includes("ETH")) return 2;
  if (pair.includes("US30") || pair.includes("US100") || pair.includes("US500") || pair.includes("NAS100")) {
    return 0;
  }
  return 4;
}

export function pricePlaceholderForPair(symbol: string): string {
  const pair = canonicalizePairSymbol(symbol);
  const decimals = getPairPriceDecimals(pair);

  if (decimals === 0) return "39500";
  if (pair.includes("XAU")) return "2650.50";
  if (pair.includes("XAG")) return "28.450";
  if (pair.includes("JPY")) return "150.25";
  if (pair.includes("BTC")) return "64000.00";
  if (decimals === 3) return "1.085";
  if (decimals === 2) return "1.09";
  if (decimals === 1) return "1.1";
  return "1.0850";
}

export function priceStepForPair(symbol: string): string {
  const decimals = getPairPriceDecimals(symbol);
  if (decimals <= 0) return "1";
  return (1 / 10 ** decimals).toFixed(decimals);
}

/** Keep typing fluid while capping fractional digits to the pair format. */
export function sanitizePriceInput(raw: string, maxDecimals: number, allowNegative = false): string {
  const negative = allowNegative && raw.trim().startsWith("-");
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return negative ? "-" : "";

  const firstDot = cleaned.indexOf(".");
  let next: string;
  if (firstDot === -1) {
    next = cleaned;
  } else {
    const whole = cleaned.slice(0, firstDot).replace(/\./g, "") || "0";
    const fraction = cleaned
      .slice(firstDot + 1)
      .replace(/\./g, "")
      .slice(0, Math.max(0, maxDecimals));

    if (maxDecimals <= 0) {
      next = whole;
    } else if (cleaned.endsWith(".") && fraction.length === 0) {
      next = `${whole}.`;
    } else {
      next = `${whole}.${fraction}`;
    }
  }

  return negative ? `-${next}` : next;
}

export function formatPriceForPair(value: number | null | undefined, symbol: string): string {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toFixed(getPairPriceDecimals(symbol));
}

export function parsePriceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === ".") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
