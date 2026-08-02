import { createContext } from "react";
import { APP_FONT_OPTIONS, type AppFontId } from "@/lib/fonts";

export type FontContextValue = {
  fontId: AppFontId;
  options: typeof APP_FONT_OPTIONS;
  isLoading: boolean;
  setFontId: (fontId: AppFontId) => Promise<AppFontId>;
};

/** Stable context identity — keep createContext out of HMR'd provider modules. */
export const FontContext = createContext<FontContextValue | undefined>(undefined);
