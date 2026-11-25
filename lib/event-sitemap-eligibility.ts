const EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SitemapEligibleEvent = {
  slug: string | null;
  start_date: string | null;
  visible: boolean | null;
};

export function validDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function todayAtMidnight(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

export function isIndexableFutureEvent(event: SitemapEligibleEvent, now = new Date()) {
  const slug = event.slug?.trim() || "";
  const start = validDate(event.start_date);

  return event.visible !== false
    && EVENT_SLUG_PATTERN.test(slug)
    && Boolean(start && start.getTime() >= todayAtMidnight(now).getTime());
}
