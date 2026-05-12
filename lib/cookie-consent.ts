export type CookieConsentPreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export const COOKIE_CONSENT_STORAGE_KEY = "eventomotor_cookie_consent_v1";
export const COOKIE_CONSENT_EVENT = "eventomotor:cookie-consent-change";
export const COOKIE_SETTINGS_EVENT = "eventomotor:open-cookie-settings";

export function defaultCookieConsentPreferences(): CookieConsentPreferences {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    updatedAt: new Date().toISOString(),
  };
}

export function readCookieConsentPreferences() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<CookieConsentPreferences>;

    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    } satisfies CookieConsentPreferences;
  } catch {
    return null;
  }
}

export function saveCookieConsentPreferences(preferences: Omit<CookieConsentPreferences, "necessary" | "updatedAt">) {
  if (typeof window === "undefined") return;

  const nextPreferences: CookieConsentPreferences = {
    necessary: true,
    analytics: preferences.analytics,
    marketing: preferences.marketing,
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(nextPreferences));
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: nextPreferences }));
}

export function hasAnalyticsConsent() {
  return readCookieConsentPreferences()?.analytics === true;
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
