import type { EventUpsert } from "@/lib/supabase";

export type PublicationDraft = {
  title?: unknown;
  slug?: unknown;
  description?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  city?: unknown;
  province?: unknown;
  region?: unknown;
  venue?: unknown;
  discipline?: unknown;
  category?: unknown;
  vehicleType?: unknown;
  organizer?: unknown;
  sourceUrl?: unknown;
  ticketUrl?: unknown;
  registrationUrl?: unknown;
  posterUrl?: unknown;
  country?: unknown;
  shortDescription?: unknown;
  longDescription?: unknown;
  scheduleText?: unknown;
  tags?: unknown;
  sourceSubmissionId?: unknown;
};

const DIRECT_IMAGE_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const SOCIAL_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "m.facebook.com",
  "m.instagram.com",
  "www.facebook.com",
  "www.instagram.com",
]);

export function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function optionalText(value: unknown) {
  return textValue(value) || null;
}

export function parseHttpUrl(value: unknown): URL | null {
  const text = textValue(value);
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isSocialUrl(value: unknown) {
  const url = parseHttpUrl(value);
  return Boolean(url && SOCIAL_HOSTS.has(url.hostname.toLowerCase()));
}

export function isDirectImageUrl(value: unknown) {
  const text = textValue(value);
  if (!text) return false;
  if (text.startsWith("/") && !text.startsWith("//")) {
    return DIRECT_IMAGE_EXTENSIONS.test(text.split(/[?#]/, 1)[0]);
  }

  const url = parseHttpUrl(text);
  if (!url || isSocialUrl(url.toString())) return false;
  return DIRECT_IMAGE_EXTENSIONS.test(url.pathname);
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function spanishE164Digits(value: string) {
  const raw = value.trim();
  let digits = digitsOnly(raw);

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && /^[67]/.test(digits)) digits = `34${digits}`;
  if (digits.length === 11 && digits.startsWith("34") && /^[67]/.test(digits.slice(2))) return digits;
  return null;
}

export function normalizeWhatsAppRegistrationUrl(value: unknown) {
  const text = textValue(value);
  if (!text) return null;

  const parsed = parseHttpUrl(text);
  if (parsed && (parsed.hostname === "wa.me" || parsed.hostname === "www.wa.me")) {
    const digits = digitsOnly(parsed.pathname);
    return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
  }

  const numericHost = parsed && /^\d+$/.test(parsed.hostname) ? parsed.hostname : "";
  const digits = spanishE164Digits(numericHost || text);
  return digits ? `https://wa.me/${digits}` : null;
}

export function normalizeTicketUrl(value: unknown) {
  const text = textValue(value);
  if (/^https?:\/\/\d+(?:[/:?#]|$)/i.test(text)) return null;
  const url = parseHttpUrl(text);
  if (!url || /^\d+$/.test(url.hostname) || url.hostname === "wa.me" || url.hostname === "www.wa.me") return null;
  return url.toString();
}

export function normalizeSubmissionTicketInput(value: unknown) {
  const text = textValue(value);
  if (!text) return null;

  const whatsapp = normalizeWhatsAppRegistrationUrl(text);
  if (whatsapp) return whatsapp;

  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return normalizeTicketUrl(withProtocol);
}

export function normalizeRegistrationUrl(value: unknown, contactPhone?: unknown) {
  const whatsapp = normalizeWhatsAppRegistrationUrl(value) || normalizeWhatsAppRegistrationUrl(contactPhone);
  if (whatsapp) return whatsapp;

  const url = parseHttpUrl(value);
  return url && !/^\d+$/.test(url.hostname) ? url.toString() : null;
}

export function publicationImageFields(posterUrl: unknown) {
  const poster = textValue(posterUrl);
  const sourceUrl = parseHttpUrl(poster)?.toString() || null;

  return {
    image_url: isDirectImageUrl(poster) ? poster : null,
    image_source_url: sourceUrl,
  };
}

export function publicationDraftToEvent(draft: PublicationDraft): EventUpsert {
  const title = textValue(draft.title);
  const slug = textValue(draft.slug);
  const startDate = textValue(draft.startDate);
  const endDate = textValue(draft.endDate) || startDate;
  const discipline = textValue(draft.discipline) || textValue(draft.category) || "Motor";
  const city = textValue(draft.city);
  const province = textValue(draft.province);
  const organizer = textValue(draft.organizer);
  const country = textValue(draft.country) || "ES";
  const sourceUrl = parseHttpUrl(draft.sourceUrl)?.toString() || "";
  const rawTicket = textValue(draft.ticketUrl);
  const ticketUrl = normalizeTicketUrl(rawTicket);
  const registrationUrl = normalizeRegistrationUrl(draft.registrationUrl)
    || (!ticketUrl ? normalizeRegistrationUrl(rawTicket) : null);
  const image = publicationImageFields(draft.posterUrl);
  const explicitTags = Array.isArray(draft.tags)
    ? draft.tags.map(textValue)
    : textValue(draft.tags).split(/[,\n]/).map((tag) => tag.trim());
  const tags = [...explicitTags, discipline, textValue(draft.category), city, province]
    .filter((tag, index, list) => tag && list.indexOf(tag) === index);
  const shortDescription = sanitizePublicEditorialText(textValue(draft.shortDescription));
  const longDescription = sanitizePublicEditorialText(
    textValue(draft.longDescription) || textValue(draft.description),
  );
  const scheduleText = sanitizePublicEditorialText(textValue(draft.scheduleText));

  return {
    id: `admin-${slug}`,
    slug,
    title,
    championship: null,
    discipline,
    start_date: startDate,
    end_date: endDate,
    venue: optionalText(draft.venue),
    city,
    province,
    region: optionalText(draft.region) || province,
    country,
    level: "Publicado",
    source: organizer || "Solicitud de organizador",
    source_url: sourceUrl,
    official_url: sourceUrl,
    ticket_url: ticketUrl,
    registration_url: registrationUrl,
    image_url: image.image_url,
    image_source_url: image.image_source_url,
    event_status: "confirmed",
    short_description: shortDescription || null,
    long_description: longDescription || null,
    schedule_text: scheduleText || null,
    organizer_name: organizer || null,
    organizer_url: sourceUrl || null,
    source_type: "organizer",
    tags,
    vehicle_type: optionalText(draft.vehicleType),
    featured: false,
    visible: true,
    import_method: "admin-event-submission",
    data_quality: "published",
    notes: null,
    updated_at: new Date().toISOString(),
  };
}

const INTERNAL_PUBLIC_LINE = /^(?:Solicitud origen|Email contacto|Tel[eé]fono contacto|Cartel\/imagen)\s*:/i;
const REQUEST_UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export function sanitizePublicEditorialText(value: string | null | undefined) {
  return (value || "")
    .split(/\r?\n/)
    .filter((line) => !INTERNAL_PUBLIC_LINE.test(line.trim()) && !REQUEST_UUID.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
