import { ACCOUNT_CURRENCIES, type AccountCurrency } from "@/contexts/CurrencyContext";
import { api } from "../../convex/_generated/api";
import { createAuthenticatedConvexClient, isConvexEnabled } from "@/lib/convexClient";

export interface UserSettingsRecord {
  defaultRiskPercent: number | null;
  accountCurrency: string | null;
  theme: "light" | "dark" | null;
  hapticsEnabled: boolean | null;
}

export const DEFAULT_USER_SETTINGS: UserSettingsRecord = {
  defaultRiskPercent: null,
  accountCurrency: null,
  theme: null,
  hapticsEnabled: null,
};

export const getStoredUserSettings = (): UserSettingsRecord => {
  const defaultRisk = localStorage.getItem("defaultRisk");
  const savedTheme = localStorage.getItem("theme");
  const savedHaptics = localStorage.getItem("hapticsEnabled");
  const savedCurrency = localStorage.getItem("accountCurrency");

  let accountCurrency: string | null = null;
  if (savedCurrency) {
    try {
      const parsed = JSON.parse(savedCurrency) as Partial<AccountCurrency>;
      accountCurrency = typeof parsed.code === "string" ? parsed.code : null;
    } catch {
      accountCurrency = null;
    }
  }

  return {
    defaultRiskPercent: defaultRisk ? Number(defaultRisk) : null,
    accountCurrency,
    theme: savedTheme === "light" || savedTheme === "dark" ? savedTheme : null,
    hapticsEnabled: savedHaptics === null ? null : savedHaptics === "true",
  };
};

export const persistUserSettingsLocally = (settings: UserSettingsRecord) => {
  if (typeof settings.defaultRiskPercent === "number" && Number.isFinite(settings.defaultRiskPercent)) {
    localStorage.setItem("defaultRisk", String(settings.defaultRiskPercent));
  }

  if (settings.theme) {
    localStorage.setItem("theme", settings.theme);
  }

  if (typeof settings.hapticsEnabled === "boolean") {
    localStorage.setItem("hapticsEnabled", String(settings.hapticsEnabled));
  }

  if (settings.accountCurrency) {
    const currency = ACCOUNT_CURRENCIES.find((item) => item.code === settings.accountCurrency);
    if (currency) {
      localStorage.setItem("accountCurrency", JSON.stringify(currency));
    }
  }
};

export const loadUserSettings = async (authToken?: string | null): Promise<UserSettingsRecord> => {
  const localSettings = getStoredUserSettings();

  if (!authToken || !isConvexEnabled()) {
    return localSettings;
  }

  const client = createAuthenticatedConvexClient(authToken);
  if (!client) {
    return localSettings;
  }

  const row = await client.query(api.userSettings.viewer, {});
  if (!row) {
    return localSettings;
  }

  const merged: UserSettingsRecord = {
    defaultRiskPercent: row.defaultRiskPercent ?? localSettings.defaultRiskPercent,
    accountCurrency: row.accountCurrency ?? localSettings.accountCurrency,
    theme: row.theme === "light" || row.theme === "dark" ? row.theme : localSettings.theme,
    hapticsEnabled: typeof row.hapticsEnabled === "boolean" ? row.hapticsEnabled : localSettings.hapticsEnabled,
  };

  persistUserSettingsLocally(merged);
  return merged;
};

export const saveUserSettings = async (settings: UserSettingsRecord, authToken?: string | null) => {
  persistUserSettingsLocally(settings);

  if (!authToken || !isConvexEnabled()) {
    return;
  }

  const client = createAuthenticatedConvexClient(authToken);
  if (!client) {
    return;
  }

  await client.mutation(api.userSettings.upsertViewer, {
    defaultRiskPercent: settings.defaultRiskPercent,
    accountCurrency: settings.accountCurrency,
    theme: settings.theme,
    hapticsEnabled: settings.hapticsEnabled ?? undefined,
  });
};
