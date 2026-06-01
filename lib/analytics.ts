import { hasAnalyticsConsent } from "@/lib/cookie-consent";
import type { SavedEvent } from "@/lib/saved-events";
import type { EventItem } from "@/types/event";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;
type AnalyticsEventLike = Partial<EventItem & SavedEvent> & {
  category?: string | null;
  source_url?: string | null;
  ticket_url?: string | null;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function currentPagePath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || !hasAnalyticsConsent() || typeof window.gtag !== "function") return;

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );

  window.gtag("event", name, cleanParams);
}

export function urlDomain(value: string | null | undefined) {
  if (!value) return undefined;

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function eventAnalyticsParams(event: AnalyticsEventLike, overrides: AnalyticsParams = {}): AnalyticsParams {
  const vehicleType = event.vehicleType || event.vehicle_type;
  const ticketUrl = event.ticketUrl || event.ticket_url;
  const sourceUrl = event.sourceUrl || event.source_url;

  return {
    event_slug: event.slug,
    event_title: event.title,
    event_discipline: event.discipline,
    event_province: event.province,
    event_city: event.city,
    event_vehicle_type: vehicleType,
    event_date: event.start,
    event_source: event.source || urlDomain(sourceUrl),
    event_has_ticket_url: Boolean(ticketUrl),
    ...overrides,
  };
}
