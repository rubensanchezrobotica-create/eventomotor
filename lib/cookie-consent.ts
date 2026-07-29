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

export function applyAnalyticsConsent(
  measurementId: string | undefined,
  allowed: boolean,
) {
  if (typeof window === "undefined" || !measurementId) return;

  const disableKey = `ga-disable-${measurementId}`;
  (window as unknown as Record<string, unknown>)[disableKey] = !allowed;
  if (allowed) return;

  const cookieNames = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=", 1)[0]?.trim())
    .filter((name): name is string =>
      Boolean(name && (name === "_ga" || name.startsWith("_ga_")))
    );
  const hostname = window.location.hostname;
  const domains = new Set([hostname, `.${hostname}`]);
  for (const name of cookieNames) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    for (const domain of domains) {
      document.cookie =
        `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`;
    }
  }
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}
