import type { SavedEvent } from "@/lib/saved-events";
import type { EventItem } from "@/types/event";
import {
  buildRelatedEventDetails,
  getAboutText,
  getEventPrimaryAction,
  getOfficialSource,
} from "@/components/events/detail/event-detail-model";
import { formatCalendarDisciplineLabel } from "@/components/redesign-v2/calendar/calendar-page-model";
import {
  assignV2HomeEventImages,
  type V2AssignedEventImage,
} from "@/components/redesign-v2/discipline-fallback-resolver";

export type EventDetailDate = {
  dateTime: string;
  label: string;
};

export type EventDetailLink = {
  href: string;
  label: string;
};

export type EventDetailInfo = {
  label: string;
  value: string;
};

export type EventDetailRelated = {
  context: string;
  date: EventDetailDate;
  discipline: string;
  href: string;
  image: V2AssignedEventImage;
  label: string;
  location: string;
  slug: string;
  title: string;
};

export type EventDetailV2Model = {
  date: EventDetailDate;
  description: string;
  discipline: string;
  heroDescription: string;
  image: V2AssignedEventImage;
  intro: string;
  location: string;
  practicalItems: EventDetailInfo[];
  primaryAction: EventDetailLink | null;
  publicUrl: string;
  related: EventDetailRelated[];
  savedEvent: SavedEvent;
  slug: string;
  source: EventDetailLink | null;
  title: string;
  upcomingCount: number;
  vehicle: string;
  venue: string;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const monthYearFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayMonthFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function normalize(value: string | null | undefined) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeVisibleLabel(value: string) {
  return cleanText(value).replace(/\s+/g, " ").toLocaleUpperCase("es-ES");
}

export function formatRelatedEventLabel(primaryLabel: string, secondaryLabel: string) {
  const primary = cleanText(primaryLabel).replace(/\s+/g, " ");
  const secondary = cleanText(secondaryLabel).replace(/\s+/g, " ");
  if (!primary) return secondary;
  if (!secondary || normalizeVisibleLabel(primary) === normalizeVisibleLabel(secondary)) return primary;
  return `${primary} · ${secondary}`;
}

function isUseful(value: string | null | undefined) {
  const normalized = normalize(value);
  return Boolean(
    normalized
    && !["por confirmar", "a confirmar", "pendiente", "desconocido", "desconocida"].includes(normalized),
  );
}

function dateKey(value: string | null | undefined) {
  const key = cleanText(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return key;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatEventDetailDate(
  startValue: string | null | undefined,
  endValue: string | null | undefined,
): EventDetailDate | null {
  const start = dateKey(startValue);
  if (!start) return null;
  const candidateEnd = dateKey(endValue);
  const end = candidateEnd && candidateEnd >= start ? candidateEnd : start;
  const startDate = dateFromKey(start);
  const endDate = dateFromKey(end);

  if (start === end) {
    return { dateTime: start, label: dateFormatter.format(startDate) };
  }

  if (
    startDate.getUTCFullYear() === endDate.getUTCFullYear()
    && startDate.getUTCMonth() === endDate.getUTCMonth()
  ) {
    return {
      dateTime: start,
      label: `${startDate.getUTCDate()}–${endDate.getUTCDate()} de ${monthYearFormatter.format(endDate)}`,
    };
  }

  if (startDate.getUTCFullYear() === endDate.getUTCFullYear()) {
    return {
      dateTime: start,
      label: `${dayMonthFormatter.format(startDate)} – ${dateFormatter.format(endDate)}`,
    };
  }

  return {
    dateTime: start,
    label: `${dateFormatter.format(startDate)} – ${dateFormatter.format(endDate)}`,
  };
}

export function formatEventDetailLocation(event: EventItem) {
  const parts = [event.city, event.province]
    .filter(isUseful)
    .map((value) => cleanText(value));
  return parts.filter((value, index) => (
    parts.findIndex((candidate) => normalize(candidate) === normalize(value)) === index
  )).join(", ");
}

function safeExternalHref(value: string | null | undefined) {
  try {
    const url = new URL(cleanText(value));
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function vehicleLabel(event: EventItem) {
  const value = cleanText(event.vehicleType || event.vehicle_type);
  const key = normalize(value);
  if (!value || ["otros", "otro", "unknown", "desconocido"].includes(key)) return "";
  const labels: Record<string, string> = {
    coche: "Coche",
    kart: "Karting",
    karting: "Karting",
    mixto: "Mixto",
    moto: "Moto",
  };
  return labels[key] || value;
}

function distinctVenue(event: EventItem, location: string) {
  const venue = isUseful(event.venue) ? cleanText(event.venue) : "";
  if (!venue || normalize(location).includes(normalize(venue))) return "";
  return venue;
}

function distinctPracticalValue(
  value: string | null | undefined,
  visibleValues: string[],
) {
  const candidate = isUseful(value) ? cleanText(value) : "";
  if (!candidate) return "";
  return visibleValues.some((visible) => normalize(visible) === normalize(candidate))
    ? ""
    : candidate;
}

function eventDescription(event: EventItem) {
  const longDescription = getAboutText(event);
  const shortDescription = cleanText(event.shortDescription);
  const description = longDescription || shortDescription;
  const intro = shortDescription
    && description
    && normalize(description) !== normalize(shortDescription)
    && !normalize(description).startsWith(normalize(shortDescription))
      ? shortDescription
      : "";
  return { description, intro };
}

function buildRelated(
  event: EventItem,
  events: EventItem[],
  today: string,
): EventDetailRelated[] {
  const sourceRelated = buildRelatedEventDetails(event, events, today).slice(0, 3);
  const relatedEvents = sourceRelated.map(({ event: related }) => related);
  const images = assignV2HomeEventImages(relatedEvents);

  return sourceRelated.flatMap(({ context, event: related }, index) => {
    const date = formatEventDetailDate(related.start, related.end);
    if (!date) return [];
    const slug = cleanText(related.slug || related.id);
    const discipline = formatCalendarDisciplineLabel(related.discipline);
    return [{
      context,
      date,
      discipline,
      href: `/preview/redesign-v2/evento/${slug}`,
      image: images[index],
      label: formatRelatedEventLabel(context, discipline),
      location: formatEventDetailLocation(related),
      slug,
      title: related.title,
    }];
  });
}

export function madridDateKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildEventDetailV2Model(
  event: EventItem,
  events: EventItem[],
  options: { siteUrl: string; today: string },
): EventDetailV2Model | null {
  const date = formatEventDetailDate(event.start, event.end);
  const slug = cleanText(event.slug || event.id);
  if (!date || !slug || !cleanText(event.title)) return null;

  const location = formatEventDetailLocation(event);
  const venue = distinctVenue(event, location);
  const discipline = formatCalendarDisciplineLabel(event.discipline);
  const vehicle = vehicleLabel(event);
  const officialSource = getOfficialSource(event);
  const rawPrimaryAction = getEventPrimaryAction(event);
  const primaryHref = safeExternalHref(rawPrimaryAction?.href);
  const sourceHref = safeExternalHref(officialSource?.href);
  const { description, intro } = eventDescription(event);
  const image = assignV2HomeEventImages([event])[0];
  const publicUrl = `${options.siteUrl.replace(/\/$/, "")}/evento/${slug}`;
  const schedule = distinctPracticalValue(event.scheduleText, []);
  const address = distinctPracticalValue(event.address, [location, venue]);
  const organizer = distinctPracticalValue(event.organizerName, []);
  const practicalItems: EventDetailInfo[] = [
    schedule ? { label: "Horario", value: schedule } : null,
    address ? { label: "Dirección", value: address } : null,
    organizer ? { label: "Organizador", value: organizer } : null,
  ].filter((item): item is EventDetailInfo => item !== null);

  return {
    date,
    description,
    discipline,
    heroDescription: [date.label, location].filter(Boolean).join(" · "),
    image,
    intro,
    location,
    practicalItems,
    primaryAction: rawPrimaryAction && primaryHref
      ? { href: primaryHref, label: rawPrimaryAction.type === "official" ? "Más información" : rawPrimaryAction.label }
      : null,
    publicUrl,
    related: buildRelated(event, events, options.today),
    savedEvent: {
      slug,
      title: event.title,
      start: event.start,
      end: event.end || event.start,
      city: event.city,
      province: event.province,
      venue: event.venue,
      discipline: event.discipline,
      vehicle_type: event.vehicleType || event.vehicle_type,
      source_url: officialSource?.href || "",
      ticket_url: safeExternalHref(event.registrationUrl) || safeExternalHref(event.ticketUrl),
    },
    slug,
    source: officialSource && sourceHref
      ? { href: sourceHref, label: officialSource.label }
      : null,
    title: event.title,
    upcomingCount: events.filter((candidate) => {
      const end = dateKey(candidate.end) || dateKey(candidate.start);
      return Boolean(end && end >= options.today);
    }).length,
    vehicle,
    venue,
  };
}
