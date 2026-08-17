import type { Metadata } from "next";
import { getEventImage, getEventImageAlt } from "@/lib/event-images";
import { getEventSeoOverride } from "@/lib/event-seo-overrides";
import { absoluteMetadataTitle, brandedPageTitle, SITE_NAME } from "@/lib/seo";
import type { EventItem } from "@/types/event";

const EVENT_STATUS_SCHEMA: Record<string, string> = {
  confirmed: "https://schema.org/EventScheduled",
  tentative: "https://schema.org/EventScheduled",
  postponed: "https://schema.org/EventPostponed",
  cancelled: "https://schema.org/EventCancelled",
};

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function absoluteImageUrl(value: string, siteUrl: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${siteUrl}${value}`;
}

function hasCoordinates(event: EventItem) {
  return typeof event.latitude === "number"
    && typeof event.longitude === "number"
    && Number.isFinite(event.latitude)
    && Number.isFinite(event.longitude);
}

export type EventPageSeoFallback = {
  title: string;
  description: string;
};

const JARAMA_TRACKDAY_TERMS = [
  "tandas privadas",
  "tandas libres",
  "tandas",
  "rodadas",
  "rodada",
  "track day",
  "trackdays",
  "trackday",
] as const;

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function formatEventDate(event: EventItem) {
  if (!event.start) return "Por confirmar";
  if (!event.end || event.end === event.start) return formatDatePart(event.start);

  const start = new Date(`${event.start}T12:00:00`);
  const end = new Date(`${event.end}T12:00:00`);

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    const monthYear = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(end);
    return `${start.getDate()}-${end.getDate()} ${monthYear}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${formatDateWithoutYear(event.start)} - ${formatDatePart(event.end)}`;
  }

  return `${formatDatePart(event.start)} - ${formatDatePart(event.end)}`;
}

function buildDescription(event: EventItem) {
  const location = [event.city, event.province]
    .filter((value) => value && value !== "Por confirmar")
    .join(", ");
  const discipline = cleanText(event.discipline) || "motor";

  return `${event.title}: evento de ${discipline} en ${location || "Espana"} previsto para ${formatEventDate(event)}. Consulta fuente oficial, ubicacion y enlaces disponibles antes de desplazarte.`;
}

function isRallyeLaCeramica(event: EventItem) {
  const title = normalizeText(event.title);
  return title.includes("rallye la ceramica")
    || title.includes("rally la ceramica")
    || title.includes("rallye ceramica")
    || title.includes("rally ceramica");
}

function isRallyPicosDeEuropa(event: EventItem) {
  const title = normalizeText(event.title);
  return title.includes("rally picos de europa")
    || title.includes("rallye picos de europa")
    || title.includes("rally de los picos de europa");
}

function isRallysprintCarreno(event: EventItem) {
  const title = normalizeText(event.title);
  return title.includes("rallysprint carreno") || title.includes("rally sprint carreno");
}

function isRallyeCiudadDeValencia(event: EventItem) {
  const title = normalizeText(event.title);
  return title.includes("rallye ciudad de valencia") || title.includes("rally ciudad de valencia");
}

function isGallineroMotoFest(event: EventItem) {
  return normalizeText(event.title).includes("gallinero moto fest");
}

function isClassicAlcoyEvent(event: EventItem) {
  const title = normalizeText(event.title);
  return event.slug === "xiv-concentracion-automoviles-motocicletas-clasicas-alcoy-2026-06-21"
    || title.includes("xiv concentracion anual de automoviles y motocicletas clasicas")
    || title.includes("xiv concentracion de automoviles y motocicletas clasicas")
    || title.includes("classic alcoy");
}

export function isJaramaTrackdayEvent(event: EventItem) {
  const locationText = normalizeText(
    [event.venue, event.city, event.province, event.region].filter(Boolean).join(" "),
  );
  const identityText = normalizeText(
    [event.title, event.discipline, event.championship, ...event.tags].filter(Boolean).join(" "),
  );

  return locationText.includes("jarama")
    && JARAMA_TRACKDAY_TERMS.some((term) => identityText.includes(term));
}

export function buildEventSeoTitle(event: EventItem) {
  if (isRallyeLaCeramica(event)) {
    return "Rallye La Cerámica 2026 | Fecha, ubicación y fuente oficial";
  }
  if (isRallyPicosDeEuropa(event)) {
    return "Rally Picos de Europa 2026 | Fecha, ubicación y fuente oficial";
  }
  if (isRallysprintCarreno(event)) {
    return "Rallysprint Carreño 2026 | Fecha, ubicación y fuente oficial";
  }
  if (isRallyeCiudadDeValencia(event)) {
    return "Rallye Ciudad de Valencia 2026 | Fecha, ubicación y fuente oficial";
  }
  if (isGallineroMotoFest(event)) {
    return "Gallinero Moto Fest 2026 | Fecha, ubicación y fuente oficial";
  }
  if (isClassicAlcoyEvent(event)) {
    return "XIV Concentración Automóviles y Motocicletas Clásicas 2026 | Alcoy";
  }
  if (isJaramaTrackdayEvent(event)) {
    return `${event.title} | Fecha, circuito y fuente oficial`;
  }

  const location = [event.city, event.province]
    .filter((value) => value && value !== "Por confirmar")
    .join(", ");
  const locationPart = location ? ` | ${location}` : "";
  return `${event.title}${locationPart} | ${formatEventDate(event)}`;
}

export function buildEventSeoDescription(event: EventItem) {
  if (isRallyeLaCeramica(event)) {
    const location = [event.city, event.province].filter(Boolean).join(", ");
    return `Consulta fecha, ubicación y fuente oficial del Rallye La Cerámica 2026${location ? ` en ${location}` : ""}. Revisa la información publicada antes de desplazarte.`;
  }
  if (isRallyPicosDeEuropa(event)) {
    const location = [event.city, event.province, event.region].filter(Boolean).join(", ");
    return `Consulta fecha, ubicación y fuente oficial del Rally Picos de Europa 2026${location ? ` en ${location}` : ""}, del ${formatEventDate(event)}. Rally del norte de España con información publicada para planificar la asistencia.`;
  }
  if (isRallysprintCarreno(event)) {
    const location = [event.city, event.province, event.region].filter(Boolean).join(", ");
    return `Consulta fecha, ubicación y fuente oficial del Rallysprint Carreño 2026${location ? ` en ${location}` : ""}, del ${formatEventDate(event)}. Prueba de rallysprint publicada en EventoMotor para confirmar la información antes de asistir.`;
  }
  if (isRallyeCiudadDeValencia(event)) {
    const location = [event.city, event.province, event.region].filter(Boolean).join(", ");
    return `Consulta fecha, ubicación y fuente oficial del Rallye Ciudad de Valencia 2026${location ? ` en ${location}` : ""}, del ${formatEventDate(event)}. Revisa la información publicada antes de planificar asistencia o desplazamiento.`;
  }
  if (isGallineroMotoFest(event)) {
    const location = [event.city, event.province, event.region].filter(Boolean).join(", ");
    return `Consulta fecha, ubicación y fuente oficial del Gallinero Moto Fest 2026${location ? ` en ${location}` : ""}, del ${formatEventDate(event)}. Evento motero publicado en EventoMotor para confirmar detalles antes de asistir.`;
  }
  if (isClassicAlcoyEvent(event)) {
    return "Consulta la XIV Concentración Anual de Automóviles y Motocicletas Clásicas 2026 en Alcoy: fecha, ubicación, programa, inscripción y fuente oficial.";
  }
  if (isJaramaTrackdayEvent(event)) {
    const location = [event.venue, event.city, event.province].filter(Boolean).join(", ");
    return `Consulta fecha, ubicación y fuente oficial de ${event.title}${location ? ` en ${location}` : ""}, del ${formatEventDate(event)}. Revisa la información publicada antes de desplazarte.`;
  }
  return buildDescription(event);
}

export function buildMetadataDescription(event: EventItem) {
  const description = getEventSeoOverride(event.slug)?.seoDescription || buildEventSeoDescription(event);
  return description.length > 170 ? `${description.slice(0, 167).trim()}...` : description;
}

export function buildEventMetadata(
  event: EventItem,
  siteUrl: string,
  requestedSlug: string,
  fallback: EventPageSeoFallback,
): Metadata {
  const url = `${siteUrl}/evento/${event.slug || requestedSlug}`;
  const override = getEventSeoOverride(event.slug);
  const title = brandedPageTitle(override?.seoTitle || fallback.title);
  const description = override?.seoDescription || fallback.description;
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const image = absoluteImageUrl(eventImage, siteUrl);

  return {
    title: absoluteMetadataTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      images: [{ url: image, alt: eventImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function buildEventJsonLd(
  event: EventItem,
  url: string,
  imageUrl: string,
  description: string,
) {
  const officialUrl = cleanText(event.officialUrl) || cleanText(event.sourceUrl);
  const organizerName = cleanText(event.organizerName) || cleanText(event.source);
  const organizerUrl = cleanText(event.organizerUrl) || cleanText(event.sourceUrl);
  const location: Record<string, unknown> = {
    "@type": "Place",
    name: event.venue || event.city || "Por confirmar",
    address: {
      "@type": "PostalAddress",
      streetAddress: cleanText(event.address) || undefined,
      addressLocality: event.city || undefined,
      addressRegion: event.province || undefined,
      addressCountry: cleanText(event.country) || "ES",
    },
  };

  if (hasCoordinates(event)) {
    location.geo = {
      "@type": "GeoCoordinates",
      latitude: event.latitude,
      longitude: event.longitude,
    };
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description,
    startDate: event.start,
    endDate: event.end || event.start,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: EVENT_STATUS_SCHEMA[cleanText(event.eventStatus)] || "https://schema.org/EventScheduled",
    url,
    mainEntityOfPage: url,
    image: [imageUrl],
    location,
  };

  if (officialUrl && officialUrl !== url) {
    jsonLd.sameAs = officialUrl;
  }

  if (organizerName) {
    jsonLd.organizer = {
      "@type": "Organization",
      name: organizerName,
      url: organizerUrl || undefined,
    };
  }

  return jsonLd;
}

export function buildEventBreadcrumbJsonLd(event: EventItem, url: string, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Calendario",
        item: `${siteUrl}/#calendario`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: event.title,
        item: url,
      },
    ],
  };
}
