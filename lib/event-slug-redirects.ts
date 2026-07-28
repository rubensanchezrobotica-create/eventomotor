export const EVENT_SLUG_REDIRECTS = {
  "rpm-fest-night-demons-2026-2026-08-15": "rpm-fest-night-demons-2026",
} as const satisfies Record<string, string>;

type SearchParams = Record<string, string | string[] | undefined>;

export function resolveEventSlugRedirect(slug: string) {
  const destination = EVENT_SLUG_REDIRECTS[slug as keyof typeof EVENT_SLUG_REDIRECTS];
  if (!destination || destination === slug || destination in EVENT_SLUG_REDIRECTS) return null;
  return destination;
}

export function eventSlugRedirectHref(slug: string, searchParams: SearchParams = {}) {
  const destination = resolveEventSlugRedirect(slug);
  if (!destination) return null;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }

  const suffix = query.toString();
  return `/evento/${destination}${suffix ? `?${suffix}` : ""}`;
}
