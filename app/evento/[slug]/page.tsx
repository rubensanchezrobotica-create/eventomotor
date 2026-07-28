import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import EventDetailView from "@/components/events/detail/EventDetailView";
import { getEventImage, getEventImageAlt } from "@/lib/event-images";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import type { EventItem } from "@/types/event";
import { eventSlugRedirectHref } from "@/lib/event-slug-redirects";

type EventPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type EventOfferData = EventItem & {
  price?: number | string | null;
  priceCurrency?: string | null;
  validFrom?: string | null;
  isFree?: boolean | null;
};

const EVENT_STATUS_SCHEMA: Record<string, string> = {
  confirmed: "https://schema.org/EventScheduled",
  tentative: "https://schema.org/EventScheduled",
  postponed: "https://schema.org/EventPostponed",
  cancelled: "https://schema.org/EventCancelled",
};

async function getVisibleEvents(): Promise<EventItem[]> {
  const supabase = createSupabaseServerClient();

  if (!supabase) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("visible", true)
    .order("start_date", { ascending: true });

  if (error || !data) return [];

  return (data as EventRow[]).map(mapEventRowToEventItem);
}

async function getEventBySlug(slug: string): Promise<EventItem | null> {
  const events = await getVisibleEvents();
  return events.find((event) => event.slug === slug) || null;
}

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function effectiveOfficialUrl(event: EventItem) {
  return cleanText(event.officialUrl) || cleanText(event.sourceUrl);
}

function effectiveRegistrationUrl(event: EventItem) {
  return cleanText(event.registrationUrl) || cleanText(event.ticketUrl);
}

function schemaEventStatus(event: EventItem) {
  return EVENT_STATUS_SCHEMA[cleanText(event.eventStatus)] || "https://schema.org/EventScheduled";
}

function hasCoordinates(event: EventItem) {
  return typeof event.latitude === "number"
    && typeof event.longitude === "number"
    && Number.isFinite(event.latitude)
    && Number.isFinite(event.longitude);
}

function absoluteImageUrl(value: string, siteUrl: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${siteUrl}${value}`;
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

function buildMetadataDescription(event: EventItem) {
  const description = buildEventSeoDescription(event);
  return description.length > 170 ? `${description.slice(0, 167).trim()}...` : description;
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function eventSearchText(event: EventItem) {
  const extra = event as EventItem & { category?: string | null; tags?: string[] | null };
  return normalizeText(
    [
      event.title,
      event.discipline,
      event.championship,
      event.venue,
      event.city,
      event.province,
      event.region,
      extra.category,
      ...(extra.tags || []),
    ]
      .filter(Boolean)
      .join(" "),
  );
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

function isJaramaTrackdayEvent(event: EventItem) {
  const text = eventSearchText(event);
  const hasJarama = text.includes("jarama");
  const hasTrackdaySignal = ["tandas privadas", "tandas", "rodadas", "rodada", "trackday", "trackdays", "circuito"]
    .some((value) => text.includes(value));
  return text.includes("tandas privadas jarama") || (hasJarama && hasTrackdaySignal);
}

function hasCircuitSignal(event: EventItem) {
  const text = eventSearchText(event);
  return text.includes("circuito") || text.includes("jarama");
}

function buildEventSeoTitle(event: EventItem) {
  if (isRallyeLaCeramica(event)) {
    return "Rallye La Cerámica 2026 | Fecha, ubicación y fuente oficial | EventoMotor";
  }
  if (isRallyPicosDeEuropa(event)) {
    return "Rally Picos de Europa 2026 | Fecha, ubicación y fuente oficial | EventoMotor";
  }
  if (isRallysprintCarreno(event)) {
    return "Rallysprint Carreño 2026 | Fecha, ubicación y fuente oficial | EventoMotor";
  }
  if (isRallyeCiudadDeValencia(event)) {
    return "Rallye Ciudad de Valencia 2026 | Fecha, ubicación y fuente oficial | EventoMotor";
  }
  if (isGallineroMotoFest(event)) {
    return "Gallinero Moto Fest 2026 | Fecha, ubicación y fuente oficial | EventoMotor";
  }
  if (isClassicAlcoyEvent(event)) {
    return "XIV Concentración Automóviles y Motocicletas Clásicas 2026 | Alcoy | EventoMotor";
  }
  if (isJaramaTrackdayEvent(event)) {
    return hasCircuitSignal(event)
      ? "Tandas Privadas Jarama 2026 | Fecha, circuito y fuente oficial | EventoMotor"
      : "Tandas Privadas Jarama 2026 | Fecha, ubicacion y fuente oficial | EventoMotor";
  }

  const location = [event.city, event.province]
    .filter((value) => value && value !== "Por confirmar")
    .join(", ");
  const locationPart = location ? ` | ${location}` : "";
  return `${event.title}${locationPart} | ${formatEventDate(event)} | EventoMotor`;
}

function buildEventSeoDescription(event: EventItem) {
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
    return `Consulta fecha, ubicación y fuente oficial de las Tandas Privadas Jarama 2026${location ? ` en ${location}` : ""}, del ${formatEventDate(event)}. Revisa la información publicada antes de desplazarte.`;
  }
  return buildDescription(event);
}

function buildEventJsonLd(event: EventItem, url: string, imageUrl: string) {
  const registrationUrl = effectiveRegistrationUrl(event);
  const officialUrl = effectiveOfficialUrl(event);
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
    description: buildMetadataDescription(event),
    startDate: event.start,
    endDate: event.end || event.start,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: schemaEventStatus(event),
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

  if (registrationUrl) {
    const offerData = event as EventOfferData;
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: registrationUrl,
      availability: "https://schema.org/InStock",
    };
    const hasNumericPrice = offerData.price !== null && offerData.price !== undefined && offerData.price !== "";
    const numericPrice = hasNumericPrice ? Number(offerData.price) : Number.NaN;
    const hasRealPrice = Number.isFinite(numericPrice) && (numericPrice > 0 || offerData.isFree === true);

    if (hasRealPrice) {
      offer.price = String(offerData.price);
      if (offerData.priceCurrency) offer.priceCurrency = offerData.priceCurrency;
    }
    if (offerData.validFrom) offer.validFrom = offerData.validFrom;
    jsonLd.offers = offer;
  }

  return jsonLd;
}

function buildEventMetadata(event: EventItem, siteUrl: string, requestedSlug: string): Metadata {
  const url = `${siteUrl}/evento/${event.slug || requestedSlug}`;
  const title = buildEventSeoTitle(event);
  const description = buildMetadataDescription(event);
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const image = absoluteImageUrl(eventImage, siteUrl);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "EventoMotor",
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

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) return {};

  return buildEventMetadata(event, getSiteUrl(), slug);
}

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const events = await getVisibleEvents();
  const event = events.find((item) => item.slug === slug);

  if (!event) {
    const redirectHref = eventSlugRedirectHref(slug, await searchParams);
    if (redirectHref) permanentRedirect(redirectHref);
  }
  if (!event) notFound();

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/evento/${event.slug || slug}`;
  const imageUrl = absoluteImageUrl(getEventImage(event), siteUrl);
  const jsonLd = buildEventJsonLd(event, url, imageUrl);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <EventDetailView
        analyticsSource={event.source}
        event={event}
        events={events}
        footerContactTrackingLocation="event_detail_footer"
        retentionSource="event_detail"
        siteUrl={siteUrl}
      />
    </>
  );
}
