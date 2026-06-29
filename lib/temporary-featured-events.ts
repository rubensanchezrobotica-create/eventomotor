const TEMPORARY_FEATURED_UNTIL: Record<string, string> = {
  "xxxvi-concentracion-lechazos-guardo-2026-06-26": "2026-06-28",
};

function madridDateKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${value.year}-${value.month}-${value.day}`;
}

export function isTemporaryFeaturedActive(slug: string | null | undefined, now = new Date()) {
  const featuredUntil = slug ? TEMPORARY_FEATURED_UNTIL[slug] : undefined;

  return !featuredUntil || madridDateKey(now) <= featuredUntil;
}

export function resolveFeaturedStatus(slug: string | null | undefined, featured: boolean | null | undefined, now = new Date()) {
  const temporarilyFeatured = Boolean(slug && TEMPORARY_FEATURED_UNTIL[slug]);

  return (Boolean(featured) || temporarilyFeatured) && isTemporaryFeaturedActive(slug, now);
}
