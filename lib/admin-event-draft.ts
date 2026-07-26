import { VEHICLE_TYPE_OPTIONS } from "@/lib/event-classification";
import {
  isDirectImageUrl,
  normalizeRegistrationUrl,
  normalizeTicketUrl,
  parseHttpUrl,
} from "@/lib/published-request-event";

export const EVENT_DRAFT_DISCIPLINES = [
  "Rallyes",
  "Circuito",
  "Concentraciones",
  "Rutas",
  "Ferias",
  "Offroad",
  "Clásicos",
  "Karting",
  "Otros",
] as const;

export const EVENT_DRAFT_CATEGORIES = [
  "Rallye",
  "Rallysprint",
  "Circuito",
  "Concentración motera",
  "Ruta",
  "Motoalmuerzo",
  "Matinal motera",
  "Rodada / trackday",
  "Feria del motor",
  "Clásicos",
  "Karting",
  "Offroad",
  "Otros",
] as const;

export const EVENT_DRAFT_REGIONS = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y León",
  "Cataluña",
  "Ceuta",
  "Comunidad de Madrid",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "Islas Baleares",
  "Islas Canarias",
  "La Rioja",
  "Melilla",
  "Murcia",
  "Navarra",
  "País Vasco",
] as const;

export const EVENT_DRAFT_COUNTRIES = [
  { label: "España", value: "ES" },
  { label: "Portugal", value: "PT" },
  { label: "Francia", value: "FR" },
  { label: "Andorra", value: "AD" },
] as const;

export type EditableEventDraft = {
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  venue: string;
  city: string;
  province: string;
  region: string;
  country: string;
  discipline: string;
  category: string;
  vehicleType: string;
  organizer: string;
  sourceUrl: string;
  ticketUrl: string;
  registrationUrl: string;
  posterUrl: string;
  shortDescription: string;
  longDescription: string;
  scheduleText: string;
  tags: string[];
  sourceSubmissionId: string;
  status: "draft" | "pending_review";
};

export type EditableDraftField = Exclude<keyof EditableEventDraft, "sourceSubmissionId" | "status" | "tags"> | "tags";

export type EventDraftSource = {
  id: string;
  event_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  province: string | null;
  venue: string | null;
  discipline: string | null;
  vehicle_type: string | null;
  source_url: string;
  ticket_url: string | null;
  description: string | null;
  organizer_name: string | null;
  poster_url: string | null;
};

export type EventDraftValidation = {
  draft: EditableEventDraft;
  errors: string[];
  warnings: string[];
  fieldErrors: Partial<Record<EditableDraftField, string>>;
};

const PROVINCE_REGIONS: Record<string, string> = {
  alava: "País Vasco",
  albacete: "Castilla-La Mancha",
  alicante: "Comunidad Valenciana",
  almeria: "Andalucía",
  asturias: "Asturias",
  avila: "Castilla y León",
  badajoz: "Extremadura",
  barcelona: "Cataluña",
  burgos: "Castilla y León",
  caceres: "Extremadura",
  cadiz: "Andalucía",
  cantabria: "Cantabria",
  castellon: "Comunidad Valenciana",
  "ciudad real": "Castilla-La Mancha",
  cordoba: "Andalucía",
  cuenca: "Castilla-La Mancha",
  girona: "Cataluña",
  granada: "Andalucía",
  guadalajara: "Castilla-La Mancha",
  gipuzkoa: "País Vasco",
  guipuzcoa: "País Vasco",
  huelva: "Andalucía",
  huesca: "Aragón",
  jaen: "Andalucía",
  "la rioja": "La Rioja",
  leon: "Castilla y León",
  lleida: "Cataluña",
  lugo: "Galicia",
  madrid: "Comunidad de Madrid",
  malaga: "Andalucía",
  murcia: "Murcia",
  navarra: "Navarra",
  ourense: "Galicia",
  palencia: "Castilla y León",
  pontevedra: "Galicia",
  salamanca: "Castilla y León",
  segovia: "Castilla y León",
  sevilla: "Andalucía",
  soria: "Castilla y León",
  tarragona: "Cataluña",
  teruel: "Aragón",
  toledo: "Castilla-La Mancha",
  valencia: "Comunidad Valenciana",
  valladolid: "Castilla y León",
  bizkaia: "País Vasco",
  vizcaya: "País Vasco",
  zamora: "Castilla y León",
  zaragoza: "Aragón",
};

const ALLOWED_INPUT_FIELDS = new Set([
  "title",
  "slug",
  "description",
  "startDate",
  "endDate",
  "venue",
  "city",
  "province",
  "region",
  "country",
  "discipline",
  "category",
  "vehicleType",
  "organizer",
  "sourceUrl",
  "ticketUrl",
  "registrationUrl",
  "posterUrl",
  "shortDescription",
  "longDescription",
  "scheduleText",
  "tags",
  "sourceSubmissionId",
  "status",
]);

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const EMAIL_PATTERN = /\b[^@\s]+@[^@\s]+\.[^@\s]+\b/i;
const ADMIN_METADATA_PATTERN = /\b(?:solicitud\s+origen|email\s+contacto|tel[eé]fono\s+contacto)\b/i;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugPart(value: string | null | undefined) {
  return normalizeText(value || "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function draftSlug(title: string, city: string, startDate: string) {
  return [title, city, startDate]
    .map(slugPart)
    .filter(Boolean)
    .join("-")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

function inferRegion(province: string) {
  return PROVINCE_REGIONS[normalizeText(province).trim()] || "";
}

function inferCategory(source: EventDraftSource) {
  const searchable = normalizeText([source.event_name, source.discipline, source.description].filter(Boolean).join(" "));
  if (searchable.includes("motoalmuerzo") || searchable.includes("almuerzo motero")) return "Motoalmuerzo";
  if (searchable.includes("matinal")) return "Matinal motera";
  if (searchable.includes("rallysprint")) return "Rallysprint";
  if (searchable.includes("rally")) return "Rallye";
  if (searchable.includes("trackday") || searchable.includes("tandas") || searchable.includes("rodada")) return "Rodada / trackday";
  if (searchable.includes("feria") || searchable.includes("salon")) return "Feria del motor";
  if (searchable.includes("clasico")) return "Clásicos";
  if (searchable.includes("concentracion")) return "Concentración motera";
  return EVENT_DRAFT_CATEGORIES.includes(source.discipline as (typeof EVENT_DRAFT_CATEGORIES)[number])
    ? source.discipline || "Otros"
    : "Otros";
}

function normalizeTags(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : [];
  return values
    .map(text)
    .filter((tag, index, tags) => tag && tags.indexOf(tag) === index)
    .slice(0, 20);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

function containsPhone(value: string) {
  const candidates = value.match(/(?:\+|00)?\d[\d\s().-]{7,}\d/g) || [];
  return candidates.some((candidate) => candidate.replace(/\D/g, "").length >= 9);
}

function hasPrivatePublicContent(value: string) {
  return EMAIL_PATTERN.test(value)
    || UUID_PATTERN.test(value)
    || ADMIN_METADATA_PATTERN.test(value)
    || containsPhone(value);
}

function hasAdministrativeIdentity(value: string) {
  return EMAIL_PATTERN.test(value)
    || UUID_PATTERN.test(value)
    || ADMIN_METADATA_PATTERN.test(value);
}

export function createEditableEventDraft(source: EventDraftSource): EditableEventDraft {
  const title = text(source.event_name);
  const startDate = text(source.start_date);
  const city = text(source.city);
  const province = text(source.province);
  const ticketUrl = normalizeTicketUrl(source.ticket_url) || "";
  const registrationUrl = ticketUrl ? "" : normalizeRegistrationUrl(source.ticket_url) || "";
  const discipline = EVENT_DRAFT_DISCIPLINES.includes(source.discipline as (typeof EVENT_DRAFT_DISCIPLINES)[number])
    ? source.discipline || "Otros"
    : "Otros";
  const vehicleType = VEHICLE_TYPE_OPTIONS.includes(source.vehicle_type as (typeof VEHICLE_TYPE_OPTIONS)[number])
    ? source.vehicle_type || "otros"
    : "otros";

  return {
    title,
    slug: draftSlug(title, city, startDate),
    startDate,
    endDate: text(source.end_date) || startDate,
    venue: text(source.venue),
    city,
    province,
    region: inferRegion(province),
    country: "ES",
    discipline,
    category: inferCategory(source),
    vehicleType,
    organizer: text(source.organizer_name),
    sourceUrl: parseHttpUrl(source.source_url)?.toString() || "",
    ticketUrl,
    registrationUrl,
    posterUrl: isDirectImageUrl(source.poster_url) ? text(source.poster_url) : "",
    shortDescription: "",
    longDescription: text(source.description),
    scheduleText: "",
    tags: [discipline, city, province].filter(Boolean),
    sourceSubmissionId: source.id,
    status: city && province ? "draft" : "pending_review",
  };
}

export function normalizeEditableEventDraft(value: unknown): EditableEventDraft {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const longDescription = text(input.longDescription) || text(input.description);
  const draft: EditableEventDraft = {
    title: text(input.title),
    slug: text(input.slug),
    startDate: text(input.startDate),
    endDate: text(input.endDate) || text(input.startDate),
    venue: text(input.venue),
    city: text(input.city),
    province: text(input.province),
    region: text(input.region),
    country: text(input.country) || "ES",
    discipline: text(input.discipline),
    category: text(input.category),
    vehicleType: text(input.vehicleType),
    organizer: text(input.organizer),
    sourceUrl: text(input.sourceUrl),
    ticketUrl: text(input.ticketUrl),
    registrationUrl: text(input.registrationUrl),
    posterUrl: text(input.posterUrl),
    shortDescription: text(input.shortDescription),
    longDescription,
    scheduleText: text(input.scheduleText),
    tags: normalizeTags(input.tags),
    sourceSubmissionId: text(input.sourceSubmissionId),
    status: text(input.status) === "pending_review" ? "pending_review" : "draft",
  };
  return draft;
}

export function eventDraftFingerprint(draft: EditableEventDraft) {
  return JSON.stringify(draft);
}

export function updateEditableEventDraft(
  draft: EditableEventDraft,
  field: EditableDraftField,
  value: string,
): EditableEventDraft {
  const nextValue = field === "tags"
    ? value
        .split(/[,\n]/)
        .map((tag) => tag.trim())
        .filter((tag, index, tags) => tag && tags.indexOf(tag) === index)
    : value;
  const updated: EditableEventDraft = {
    ...draft,
    [field]: nextValue,
    status: "pending_review",
  };
  if (field === "province") {
    const region = inferRegion(String(nextValue));
    return { ...updated, region: region || draft.region };
  }
  return updated;
}

export function resetEditableEventDraft(original: EditableEventDraft) {
  return structuredClone(original);
}

export function isCurrentEventDraftValidated(
  draft: EditableEventDraft,
  validatedFingerprint: string | null | undefined,
) {
  return Boolean(validatedFingerprint && validatedFingerprint === eventDraftFingerprint(draft));
}

export function validateEditableEventDraft(value: unknown): EventDraftValidation {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const draft = normalizeEditableEventDraft(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldErrors: EventDraftValidation["fieldErrors"] = {};
  const unknownFields = Object.keys(input).filter((field) => !ALLOWED_INPUT_FIELDS.has(field));

  if (unknownFields.length) errors.push(`El borrador contiene campos no permitidos: ${unknownFields.join(", ")}.`);
  if (!draft.title) fieldErrors.title = "Indica el título del evento.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug)) fieldErrors.slug = "Indica un slug válido.";
  if (!validDate(draft.startDate)) fieldErrors.startDate = "Indica una fecha de inicio válida.";
  if (!validDate(draft.endDate)) fieldErrors.endDate = "Indica una fecha de fin válida.";
  if (validDate(draft.startDate) && validDate(draft.endDate) && draft.endDate < draft.startDate) {
    fieldErrors.endDate = "La fecha fin no puede ser anterior a la fecha inicio.";
  }
  if (!draft.city) fieldErrors.city = "Indica la ciudad del evento.";
  if (!draft.province) fieldErrors.province = "Indica la provincia del evento.";
  if (!EVENT_DRAFT_REGIONS.includes(draft.region as (typeof EVENT_DRAFT_REGIONS)[number])) {
    fieldErrors.region = "Selecciona una región válida.";
  }
  if (!EVENT_DRAFT_COUNTRIES.some(({ value: country }) => country === draft.country)) {
    fieldErrors.country = "Selecciona un país válido.";
  }
  if (!EVENT_DRAFT_DISCIPLINES.includes(draft.discipline as (typeof EVENT_DRAFT_DISCIPLINES)[number])) {
    fieldErrors.discipline = "Selecciona una disciplina válida.";
  }
  if (!EVENT_DRAFT_CATEGORIES.includes(draft.category as (typeof EVENT_DRAFT_CATEGORIES)[number])) {
    fieldErrors.category = "Selecciona una categoría válida.";
  }
  if (!VEHICLE_TYPE_OPTIONS.includes(draft.vehicleType as (typeof VEHICLE_TYPE_OPTIONS)[number])) {
    fieldErrors.vehicleType = "Selecciona un tipo de vehículo válido.";
  }
  if (!parseHttpUrl(draft.sourceUrl)) fieldErrors.sourceUrl = "Indica una fuente HTTP o HTTPS válida.";
  if (draft.ticketUrl && !normalizeTicketUrl(draft.ticketUrl)) {
    fieldErrors.ticketUrl = "Indica una URL HTTP o HTTPS de entradas válida.";
  }
  if (draft.registrationUrl && !normalizeRegistrationUrl(draft.registrationUrl)) {
    fieldErrors.registrationUrl = "Indica una URL de inscripción o WhatsApp válida.";
  }
  if (draft.posterUrl && !isDirectImageUrl(draft.posterUrl)) {
    fieldErrors.posterUrl = "Usa una imagen directa o un asset válido; los perfiles sociales no son carteles.";
  }
  for (const [field, publicUrl] of [
    ["sourceUrl", draft.sourceUrl],
    ["ticketUrl", draft.ticketUrl],
    ["posterUrl", draft.posterUrl],
  ] as const) {
    if (publicUrl && hasPrivatePublicContent(publicUrl)) {
      fieldErrors[field] = "La URL no puede contener teléfonos, emails, UUID ni metadatos administrativos.";
    }
  }
  if (draft.registrationUrl && hasAdministrativeIdentity(draft.registrationUrl)) {
    fieldErrors.registrationUrl = "La URL de inscripción no puede contener emails, UUID ni metadatos administrativos.";
  }

  const publicTextFields: Array<[EditableDraftField, string]> = [
    ["title", draft.title],
    ["venue", draft.venue],
    ["city", draft.city],
    ["province", draft.province],
    ["organizer", draft.organizer],
    ["shortDescription", draft.shortDescription],
    ["longDescription", draft.longDescription],
    ["scheduleText", draft.scheduleText],
    ["tags", draft.tags.join(" ")],
  ];
  for (const [field, publicValue] of publicTextFields) {
    if (publicValue && hasPrivatePublicContent(publicValue)) {
      fieldErrors[field] = "Elimina emails, teléfonos, UUID y metadatos administrativos del contenido público.";
    }
  }

  errors.push(...Object.values(fieldErrors));
  if (!draft.venue) warnings.push("Falta el recinto o ubicación concreta.");
  if (!draft.shortDescription) warnings.push("Falta una descripción breve.");
  return { draft, errors: [...new Set(errors)], warnings, fieldErrors };
}
