export const NEWSLETTER_PROVINCE_OPTIONS = [
  { slug: "barcelona", name: "Barcelona" },
  { slug: "madrid", name: "Madrid" },
  { slug: "valencia", name: "Valencia" },
  { slug: "sevilla", name: "Sevilla" },
  { slug: "a-coruna", name: "A Coruña" },
  { slug: "santa-cruz-de-tenerife", name: "Santa Cruz de Tenerife" },
] as const;

export const NEWSLETTER_CONSENT_VERSION = "2026-07" as const;

export type NewsletterProvinceSlug = (typeof NEWSLETTER_PROVINCE_OPTIONS)[number]["slug"];

export function isNewsletterProvinceSlug(value: string): value is NewsletterProvinceSlug {
  return NEWSLETTER_PROVINCE_OPTIONS.some((province) => province.slug === value);
}
