import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { featureFlagApi } from "@/lib/api";
import {
  APP_FONT_OPTIONS,
  applyAppFont,
  persistAppFontCache,
  readCachedAppFont,
  resolveAppFontId,
  type AppFontId,
} from "@/lib/fonts";
import { FontContext } from "@/contexts/fontContextInstance";

export const FontProvider = ({ children }: { children: ReactNode }) => {
  const [fontId, setFontIdState] = useState<AppFontId>(() => readCachedAppFont());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    applyAppFont(fontId);
  }, [fontId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const remote = resolveAppFontId(await featureFlagApi.getAppFont());
        if (!mounted) return;
        setFontIdState(remote);
        persistAppFontCache(remote);
        applyAppFont(remote);
      } catch (error) {
        console.warn("[fonts] Could not fetch app font setting:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setFontId = async (next: AppFontId) => {
    const updated = resolveAppFontId(await featureFlagApi.setAppFont(next));
    setFontIdState(updated);
    persistAppFontCache(updated);
    applyAppFont(updated);
    return updated;
  };

  return (
    <FontContext.Provider
      value={{
        fontId,
        options: APP_FONT_OPTIONS,
        isLoading,
        setFontId,
      }}
    >
      {children}
    </FontContext.Provider>
  );
};
