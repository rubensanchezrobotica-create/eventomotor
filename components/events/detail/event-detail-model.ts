import type { EventItem } from "@/types/event";
import {
  parseHttpUrl,
  sanitizePublicEditorialText,
} from "@/lib/published-request-event";

export type EventPrimaryAction = {
  href: string;
  label: "Inscribirse" | "Inscribirse por WhatsApp" | "Comprar entradas" | "Fuente oficial";
  type: "registration" | "ticket" | "official";
};

export type EventDetailInfoItem = {
  label: string;
  value: string;
};

export type EventOfficialSource = {
  href: string;
  label: string;
};

export type EventDetailRelated = {
  context: string;
  event: EventItem;
};

export type EventTitleLength = "short" | "medium" | "long" | "extraLong";

export type EventStatusStyle = "confirmed" | "cancelled" | "postponed" | "default";

export type PracticalGridVariant = "one" | "two" | "three" | "four" | "five" | "six";

export type StructuredDescriptionBlock = {
  kind: "description" | "field" | "plain";
  label?: string;
  sourceLines: string[];
  value: string;
};

export type StructuredDescription = {
  blocks: StructuredDescriptionBlock[];
  sourceText: string;
};

const STRUCTURED_DESCRIPTION_PREFIXES = [
  { kind: "description", label: "Descripción", prefix: "Descripción" },
  { kind: "field", label: "Programa", prefix: "Programa" },
  { kind: "field", label: "Precio", prefix: "Precio" },
  { kind: "field", label: "Fecha límite de inscripción", prefix: "Fecha límite de inscripción" },
  { kind: "field", label: "Contacto", prefix: "Contacto" },
  { kind: "field", label: "Redes", prefix: "Redes" },
] as const;

const EVENT_FALLBACK_IMAGE_PREFIX = "/images/disciplines/eventomotor-fallback-";

const VEHICLE_LABELS: Record<string, string> = {
  moto: "Moto",
  coche: "Coche",
  mixto: "Mixto",
  karting: "Karting",
  otros: "Otros",
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmado",
  tentative: "Pendiente de confirmar",
  postponed: "Aplazado",
  cancelled: "Cancelado",
};

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const EMAIL_PATTERN = /\b[^@\s]+@[^@\s]+\.[^@\s]+\b/;
const ADMIN_METADATA_PATTERN = /\b(?:email|tel[eé]fono)\s+contacto\b|\bsolicitud\s+origen\b/i;

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function containsPhoneLikeValue(value: string) {
  const candidates = value.match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || [];
  return candidates.some((candidate) => candidate.replace(/\D/g, "").length >= 9);
}

function safeSourceLabel(value: string | null | undefined) {
  const label = cleanText(value);
  if (!label) return "";
  if (
    UUID_PATTERN.test(label)
    || EMAIL_PATTERN.test(label)
    || containsPhoneLikeValue(label)
    || ADMIN_METADATA_PATTERN.test(label)
  ) return "";

  return label;
}

function publicSourceUrl(value: string | null | undefined) {
  const url = parseHttpUrl(value);
  if (!url || url.username || url.password) return null;

  const decoded = (() => {
    try {
      return decodeURIComponent(url.href);
    } catch {
      return url.href;
    }
  })();
  const hostnameDigits = url.hostname.replace(/\D/g, "");

  if (UUID_PATTERN.test(decoded) || EMAIL_PATTERN.test(decoded) || containsPhoneLikeValue(decoded)) return null;
  if (hostnameDigits.length >= 9 && !/[a-z]/i.test(url.hostname)) return null;

  return url;
}

function readableDomain(url: URL) {
  const hostname = url.hostname.replace(/^www\./i, "").trim();
  return /[a-z]/i.test(hostname) ? hostname : "";
}

export function getOfficialSource(event: EventItem): EventOfficialSource | null {
  const url = [
    event.officialUrl,
    event.organizerUrl,
    event.sourceUrl,
  ].map((value) => publicSourceUrl(value)).find((candidate): candidate is URL => Boolean(candidate));

  if (!url) return null;

  const label = safeSourceLabel(event.organizerName)
    || safeSourceLabel(event.source)
    || readableDomain(url)
    || "Ver fuente oficial";

  return { href: url.toString(), label };
}

export function isFallbackEventImage(imageSource: string) {
  return imageSource.startsWith(EVENT_FALLBACK_IMAGE_PREFIX);
}

export function getPracticalGridVariant(itemCount: number): PracticalGridVariant {
  if (itemCount <= 1) return "one";
  if (itemCount === 2) return "two";
  if (itemCount === 3) return "three";
  if (itemCount === 4) return "four";
  if (itemCount === 5) return "five";
  return "six";
}

export function parseStructuredDescription(value: string): StructuredDescription | null {
  if (!value.trim()) return null;

  const blocks: Array<StructuredDescriptionBlock & { valueLines: string[] }> = [];
  const lines = value.split(/\r?\n/);
  let current: (StructuredDescriptionBlock & { valueLines: string[] }) | null = null;
  let recognizedPrefix = false;

  const pushCurrent = () => {
    if (!current) return;
    blocks.push({ ...current, value: current.valueLines.join("\n") });
  };

  for (const line of lines) {
    const definition = STRUCTURED_DESCRIPTION_PREFIXES.find(({ prefix }) => line.startsWith(`${prefix}:`));

    if (definition) {
      pushCurrent();
      recognizedPrefix = true;
      current = {
        kind: definition.kind,
        label: definition.label,
        sourceLines: [line],
        value: "",
        valueLines: [line.slice(definition.prefix.length + 1).replace(/^ /, "")],
      };
      continue;
    }

    if (!current) {
      current = {
        kind: "plain",
        sourceLines: [line],
        value: "",
        valueLines: [line],
      };
      continue;
    }

    current.sourceLines.push(line);
    current.valueLines.push(line);
  }

  pushCurrent();

  if (!recognizedPrefix) return null;

  return {
    blocks: blocks.map((block) => ({
      kind: block.kind,
      label: block.label,
      sourceLines: block.sourceLines,
      value: block.value,
    })),
    sourceText: value,
  };
}

export function classifyEventTitleLength(title: string): EventTitleLength {
  const length = cleanText(title).length;

  if (length <= 28) return "short";
  if (length <= 44) return "medium";
  if (length <= 54) return "long";
  return "extraLong";
}

function normalizeText(value: string | null | undefined) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isUsefulValue(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return Boolean(normalized && normalized !== "por confirmar" && normalized !== "a confirmar");
}

function sameText(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(isUsefulValue(left) && normalizeText(left) === normalizeText(right));
}

export function vehicleTypeOf(event: EventItem) {
  return event.vehicleType || event.vehicle_type || "otros";
}

export function vehicleLabel(event: EventItem) {
  return VEHICLE_LABELS[vehicleTypeOf(event)] || "Otros";
}

function formatDatePart(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateWithoutYear(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

export function formatEventDate(event: EventItem) {
  if (!event.start) return "Fecha por confirmar";
  if (!event.end || event.end === event.start) return formatDatePart(event.start);

  const start = new Date(`${event.start}T12:00:00`);
  const end = new Date(`${event.end}T12:00:00`);

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    const monthYear = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(end);
    return `${start.getDate()}–${end.getDate()} de ${monthYear}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${formatDateWithoutYear(event.start)} – ${formatDatePart(event.end)}`;
  }

  return `${formatDatePart(event.start)} – ${formatDatePart(event.end)}`;
}

export function eventLocationLabel(event: EventItem) {
  const venue = isUsefulValue(event.venue) ? cleanText(event.venue) : "";
  const locality = [event.city, event.province].filter(isUsefulValue).join(", ");

  if (!venue) return locality;
  if (!locality) return venue;

  const normalizedVenue = normalizeText(venue);
  const localityParts = [event.city, event.province].filter(isUsefulValue).map(normalizeText);
  const venueAlreadyContainsLocality = localityParts.every((part) => normalizedVenue.includes(part));

  return venueAlreadyContainsLocality ? venue : `${venue} · ${locality}`;
}

export function eventStatusLabel(event: EventItem) {
  return EVENT_STATUS_LABELS[cleanText(event.eventStatus)] || "";
}

export function getEventStatusStyle(status: string | null | undefined): EventStatusStyle {
  const normalizedStatus = cleanText(status).toLowerCase();

  if (normalizedStatus === "confirmed") return "confirmed";
  if (normalizedStatus === "cancelled") return "cancelled";
  if (normalizedStatus === "postponed") return "postponed";
  return "default";
}

export function formatVerifiedAt(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getEventPrimaryAction(event: EventItem): EventPrimaryAction | null {
  const registrationUrl = cleanText(event.registrationUrl);
  const ticketUrl = cleanText(event.ticketUrl);
  const officialUrl = getOfficialSource(event)?.href || "";

  if (registrationUrl && (!ticketUrl || registrationUrl !== ticketUrl)) {
    return {
      href: registrationUrl,
      label: /^https:\/\/(?:www\.)?wa\.me\//i.test(registrationUrl) ? "Inscribirse por WhatsApp" : "Inscribirse",
      type: "registration",
    };
  }

  if (ticketUrl) {
    return { href: ticketUrl, label: "Comprar entradas", type: "ticket" };
  }

  if (registrationUrl) {
    return {
      href: registrationUrl,
      label: /^https:\/\/(?:www\.)?wa\.me\//i.test(registrationUrl) ? "Inscribirse por WhatsApp" : "Inscribirse",
      type: "registration",
    };
  }

  return officialUrl ? { href: officialUrl, label: "Fuente oficial", type: "official" } : null;
}

export function getHeroSummary(event: EventItem) {
  return cleanText(event.shortDescription);
}

export function getAboutText(event: EventItem) {
  const longDescription = sanitizePublicEditorialText(event.longDescription);
  if (longDescription) return longDescription;

  const shortDescription = cleanText(event.shortDescription);
  if (shortDescription) return "";

  const notes = sanitizePublicEditorialText(event.notes);
  const normalizedNotes = normalizeText(notes);
  const isAdministrativeNote = normalizedNotes.includes("importado para revision editorial")
    || normalizedNotes.includes("verificar ubicacion exacta");

  return notes.length >= 80 && !isAdministrativeNote ? notes : "";
}

export function getSummaryItems(event: EventItem): EventDetailInfoItem[] {
  const status = eventStatusLabel(event);
  const verifiedAt = formatVerifiedAt(event.verifiedAt);
  const discipline = cleanText(event.discipline);

  return [
    status ? { label: "Estado", value: status } : null,
    discipline ? { label: "Disciplina", value: discipline } : null,
    verifiedAt ? { label: "Última verificación", value: verifiedAt } : null,
  ].filter((item): item is EventDetailInfoItem => Boolean(item));
}

function countryLabel(country: string | null | undefined) {
  const normalized = normalizeText(country);
  if (!normalized || normalized === "es" || normalized === "espana") return "";
  if (normalized === "pt" || normalized === "portugal") return "Portugal";
  return cleanText(country);
}

export function getPracticalItems(event: EventItem): EventDetailInfoItem[] {
  const location = eventLocationLabel(event);
  const address = cleanText(event.address);
  const championship = sameText(event.championship, event.discipline) ? "" : cleanText(event.championship);
  const primaryAction = getEventPrimaryAction(event);
  const country = countryLabel(event.country);

  return [
    { label: "Fecha", value: formatEventDate(event) },
    location ? { label: "Lugar", value: location } : null,
    address && !sameText(address, location) ? { label: "Dirección", value: address } : null,
    isUsefulValue(event.discipline) ? { label: "Disciplina", value: cleanText(event.discipline) } : null,
    championship ? { label: "Campeonato", value: championship } : null,
    primaryAction && primaryAction.type !== "official"
      ? { label: "Acceso", value: primaryAction.type === "registration" ? "Inscripción disponible" : "Entradas disponibles" }
      : null,
    country ? { label: "País", value: country } : null,
  ].filter((item): item is EventDetailInfoItem => Boolean(item)).slice(0, 6);
}

export function getUsefulTags(event: EventItem) {
  const excluded = new Set([
    normalizeText(event.championship),
    normalizeText(event.discipline),
    normalizeText(vehicleLabel(event)),
    normalizeText(vehicleTypeOf(event)),
  ]);
  const seen = new Set<string>();

  return event.tags.filter((tag) => {
    const key = normalizeText(tag);
    if (!key || excluded.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eventWeekendRange(event: EventItem) {
  const start = new Date(`${event.start}T12:00:00`);
  const day = start.getDay();
  const saturday = new Date(start);
  saturday.setDate(start.getDate() + (day === 0 ? -1 : 6 - day));
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { saturday, sunday };
}

function eventOverlapsRange(event: EventItem, start: Date, end: Date) {
  const eventStart = new Date(`${event.start}T12:00:00`);
  const eventEnd = new Date(`${event.end || event.start}T12:00:00`);
  return eventStart.getTime() <= end.getTime() && eventEnd.getTime() >= start.getTime();
}

function sameEvent(left: EventItem, right: EventItem) {
  return left.id === right.id || Boolean(left.slug && right.slug && left.slug === right.slug);
}

export function buildRelatedEventDetails(
  current: EventItem,
  events: EventItem[],
  today = new Date().toISOString().slice(0, 10),
) {
  const eligible = events
    .filter((event) => !sameEvent(event, current) && event.start >= today)
    .sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title));
  const province = isUsefulValue(current.province) ? normalizeText(current.province) : "";
  const discipline = isUsefulValue(current.discipline) ? normalizeText(current.discipline) : "";
  const { saturday, sunday } = eventWeekendRange(current);
  const groups = [
    {
      context: "Cerca",
      events: province ? eligible.filter((event) => normalizeText(event.province) === province).slice(0, 4) : [],
    },
    {
      context: "Mismo fin de semana",
      events: eligible.filter((event) => eventOverlapsRange(event, saturday, sunday)).slice(0, 4),
    },
    {
      context: cleanText(current.discipline) || "Disciplina similar",
      events: discipline ? eligible.filter((event) => normalizeText(event.discipline) === discipline).slice(0, 4) : [],
    },
  ];
  const seen = new Set<string>();
  const related: EventDetailRelated[] = [];

  for (const group of groups) {
    for (const event of group.events) {
      const key = event.slug || event.id;
      if (seen.has(key)) continue;
      seen.add(key);
      related.push({ context: group.context, event });
      if (related.length === 6) return related;
    }
  }

  return related;
}
