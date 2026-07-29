export const NEWSLETTER_PROVINCE_OPTIONS = [
  { slug: "barcelona", name: "Barcelona", regionSlug: "cataluna" },
  { slug: "madrid", name: "Madrid", regionSlug: "comunidad-de-madrid" },
  { slug: "valencia", name: "Valencia", regionSlug: "comunidad-valenciana" },
  { slug: "sevilla", name: "Sevilla", regionSlug: "andalucia" },
  { slug: "a-coruna", name: "A Coruña", regionSlug: "galicia" },
  {
    slug: "santa-cruz-de-tenerife",
    name: "Santa Cruz de Tenerife",
    regionSlug: "canarias",
  },
] as const;

export const NEWSLETTER_CONSENT_VERSION = "2026-07" as const;

export type NewsletterProvinceSlug = (typeof NEWSLETTER_PROVINCE_OPTIONS)[number]["slug"];

export function isNewsletterProvinceSlug(value: string): value is NewsletterProvinceSlug {
  return NEWSLETTER_PROVINCE_OPTIONS.some((province) => province.slug === value);
}

export function newsletterRegionForProvince(
  provinceSlug: NewsletterProvinceSlug | null,
): string | null {
  if (provinceSlug === null) return null;
  return NEWSLETTER_PROVINCE_OPTIONS.find(
    (province) => province.slug === provinceSlug,
  )?.regionSlug ?? null;
}
