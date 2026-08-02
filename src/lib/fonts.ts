/**
 * App-wide font pairings. Admins can switch via Settings → Admin.
 * `markets` mirrors TradingView’s public site stack (in.tradingview.com).
 */

export const APP_FONT_IDS = ["classic", "markets"] as const;

export type AppFontId = (typeof APP_FONT_IDS)[number];

export type AppFontOption = {
  id: AppFontId;
  label: string;
  subtitle: string;
  sample: string;
};

export const APP_FONT_OPTIONS: AppFontOption[] = [
  {
    id: "classic",
    label: "Classic",
    subtitle: "DM Sans + Syne",
    sample: "Aa",
  },
  {
    id: "markets",
    label: "Markets",
    subtitle: "TradingView-style system stack",
    sample: "Aa",
  },
];

export const DEFAULT_APP_FONT: AppFontId = "markets";
export const APP_FONT_STORAGE_KEY = "appFont";
export const APP_FONT_SETTING_KEY = "app_font";

export const isAppFontId = (value: unknown): value is AppFontId =>
  typeof value === "string" && (APP_FONT_IDS as readonly string[]).includes(value);

export const resolveAppFontId = (value: unknown): AppFontId =>
  isAppFontId(value) ? value : DEFAULT_APP_FONT;

export const applyAppFont = (fontId: AppFontId) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-font", fontId);
};

export const persistAppFontCache = (fontId: AppFontId) => {
  try {
    localStorage.setItem(APP_FONT_STORAGE_KEY, fontId);
  } catch {
    // Ignore quota / private mode failures
  }
};

export const readCachedAppFont = (): AppFontId => {
  try {
    return resolveAppFontId(localStorage.getItem(APP_FONT_STORAGE_KEY));
  } catch {
    return DEFAULT_APP_FONT;
  }
};
