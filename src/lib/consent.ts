export type ConsentCategory = "preferences" | "analytics" | "marketing";

export type ConsentState = {
  version: 1;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export const CONSENT_STORAGE_KEY = "poscal.privacyConsent.v1";
export const CONSENT_CHANGED_EVENT = "poscal:consent-changed";
export const CONSENT_OPEN_EVENT = "poscal:consent-open";

const valid = (value: unknown): value is ConsentState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConsentState>;
  return (
    candidate.version === 1 &&
    typeof candidate.preferences === "boolean" &&
    typeof candidate.analytics === "boolean" &&
    typeof candidate.marketing === "boolean" &&
    typeof candidate.decidedAt === "string"
  );
};

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasConsent(category: ConsentCategory): boolean {
  return readConsent()?.[category] === true;
}

export function saveConsent(
  choices: Pick<ConsentState, "preferences" | "analytics" | "marketing">,
): ConsentState {
  const next: ConsentState = {
    version: 1,
    ...choices,
    decidedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: next }));
  }
  return next;
}

export const acceptAllConsent = () =>
  saveConsent({ preferences: true, analytics: true, marketing: true });

export const rejectNonEssentialConsent = () =>
  saveConsent({ preferences: false, analytics: false, marketing: false });

export function openConsentPreferences(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
