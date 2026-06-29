import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventomotorLogo from "@/components/brand/EventomotorLogo";
import TrackAnchor from "@/components/analytics/TrackAnchor";
import TrackLink from "@/components/analytics/TrackLink";
import EventRetentionActions from "@/components/events/EventRetentionActions";
import ShareEventButton from "@/components/ShareEventButton";
import ConceptStaticHeader from "@/components/public/concept/ConceptStaticHeader";
import ConceptStyles from "@/components/public/concept/ConceptStyles";
import { dayLabel, eventHref } from "@/components/public/concept/concept-model";
import { eventAnalyticsParams, urlDomain } from "@/lib/analytics";
import { formatRange, getDisciplineColor } from "@/lib/date-utils";
import { getEventImage, getEventImageAlt } from "@/lib/event-images";
import { getDisciplineSlug } from "@/lib/event-listing-slugs";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import type { EventItem } from "@/types/event";

type EventPageProps = {
  params: Promise<{ slug: string }>;
};

type EventOfferData = EventItem & {
  price?: number | string | null;
  priceCurrency?: string | null;
  validFrom?: string | null;
  isFree?: boolean | null;
};

const VEHICLE_LABELS: Record<string, string> = {
  moto: "Moto",
  coche: "Coche",
  mixto: "Mixto",
  karting: "Karting",
  otros: "Otros",
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

function valueOrPending(value: string | null | undefined) {
  return value?.trim() || "Por confirmar";
}

function vehicleTypeOf(event: EventItem) {
  return event.vehicleType || event.vehicle_type || "otros";
}

function vehicleLabel(event: EventItem) {
  return VEHICLE_LABELS[vehicleTypeOf(event)] || "Otros";
}

function absoluteImageUrl(value: string, siteUrl: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${siteUrl}${value}`;
}

function isRemoteImage(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
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
  const location = [event.city, event.province].filter(Boolean).join(", ");
  return `Consulta fecha, ubicacion, disciplina, fuente oficial y enlaces disponibles del evento ${event.title} en ${location || "Espana"}.`;
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
  return (title.includes("rallye la ceramica") || title.includes("rally la ceramica") || title.includes("rallye ceramica") || title.includes("rally ceramica"));
}

function isRallyPicosDeEuropa(event: EventItem) {
  const title = normalizeText(event.title);
  return title.includes("rally picos de europa") || title.includes("rallye picos de europa") || title.includes("rally de los picos de europa");
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
  const title = normalizeText(event.title);
  return title.includes("gallinero moto fest");
}

function isClassicAlcoyEvent(event: EventItem) {
  const title = normalizeText(event.title);
  return (
    event.slug === "xiv-concentracion-automoviles-motocicletas-clasicas-alcoy-2026-06-21" ||
    title.includes("xiv concentracion anual de automoviles y motocicletas clasicas") ||
    title.includes("xiv concentracion de automoviles y motocicletas clasicas") ||
    title.includes("classic alcoy")
  );
}

function isJaramaTrackdayEvent(event: EventItem) {
  const text = eventSearchText(event);
  const hasJarama = text.includes("jarama");
  const hasTrackdaySignal = ["tandas privadas", "tandas", "rodadas", "rodada", "trackday", "trackdays", "circuito"].some((value) => text.includes(value));
  return text.includes("tandas privadas jarama") || (hasJarama && hasTrackdaySignal);
}

function hasCircuitSignal(event: EventItem) {
  const text = eventSearchText(event);
  return text.includes("circuito") || text.includes("jarama");
}

function isComunidadValencianaEvent(event: EventItem) {
  const text = normalizeText([event.city, event.province, event.region, event.venue].filter(Boolean).join(" "));
  return ["castellon", "valencia", "alicante", "comunidad valenciana", "comunitat valenciana", "levante"].some((value) => text.includes(value));
}

function isMadridEvent(event: EventItem) {
  const text = normalizeText([event.city, event.province, event.region, event.venue].filter(Boolean).join(" "));
  return ["madrid", "san sebastian de los reyes", "jarama"].some((value) => text.includes(value));
}

function isNorthernEvent(event: EventItem) {
  const text = normalizeText([event.city, event.province, event.region, event.venue].filter(Boolean).join(" "));
  return ["asturias", "cantabria", "galicia", "ourense", "pontevedra", "a coruna", "lugo", "pais vasco", "euskadi", "navarra", "leon", "burgos", "palencia"].some((value) => text.includes(value));
}

function isCataloniaEvent(event: EventItem) {
  const text = normalizeText([event.city, event.province, event.region, event.venue].filter(Boolean).join(" "));
  return ["cataluna", "catalunya", "barcelona", "girona", "tarragona", "lleida", "ribes de freser"].some((value) => text.includes(value));
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

  return `${event.title} | Fecha, ubicacion y fuente oficial | EventoMotor`;
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

function buildAboutText(event: EventItem) {
  const location = [event.city, event.province].filter((value) => value && value !== "Por confirmar").join(", ");
  const region = event.region && event.region !== "Por confirmar" ? `, ${event.region}` : "";
  const source = event.source && event.source !== "Supabase" ? ` La información procede de ${event.source}.` : "";

  return `${event.title} es un evento de ${event.discipline || "motor"} previsto en ${location || "ubicación por confirmar"}${region}, del ${formatEventDate(event)}. Forma parte del calendario de eventos de motor en España para ${vehicleLabel(event).toLowerCase()}. Antes de desplazarte, consulta siempre la fuente oficial por si hubiera cambios de horario, inscripción o programa.${source}`;
}

function buildHeroSummary(event: EventItem) {
  const location = [event.city, event.province].filter(Boolean).join(", ");
  return `Evento de ${event.discipline || "motor"} previsto en ${location || "Espana"} del ${formatEventDate(event)}. Consulta la fuente oficial antes de desplazarte.`;
}

function buildEventSeoNote(event: EventItem) {
  if (isRallyeLaCeramica(event)) {
    return "Consulta la información publicada del Rallye La Cerámica 2026 y confirma siempre horarios, recorrido e inscripciones en la fuente oficial.";
  }

  if (isRallyPicosDeEuropa(event)) {
    return "Consulta la información publicada del Rally Picos de Europa 2026 y confirma siempre horarios, recorrido, inscripciones y cambios en la fuente oficial.";
  }

  if (isRallysprintCarreno(event)) {
    return "Consulta la información publicada del Rallysprint Carreño 2026 y confirma siempre horarios, recorrido, inscripciones y cambios en la fuente oficial.";
  }

  if (isRallyeCiudadDeValencia(event)) {
    return "Consulta la información publicada del Rallye Ciudad de Valencia 2026 y confirma siempre horarios, recorrido, inscripciones y cambios en la fuente oficial.";
  }

  if (isGallineroMotoFest(event)) {
    return "Consulta la información publicada del Gallinero Moto Fest 2026 y confirma siempre horarios, programa, inscripciones y cambios en la fuente oficial.";
  }

  if (isClassicAlcoyEvent(event)) {
    return "Consulta la información publicada de la XIV Concentración Anual de Automóviles y Motocicletas Clásicas 2026 y confirma siempre programa, inscripción y cambios en la fuente oficial.";
  }

  if (isJaramaTrackdayEvent(event)) {
    return "Consulta la información publicada de las Tandas Privadas Jarama 2026 y confirma siempre horarios, inscripción, plazas y requisitos en la fuente oficial.";
  }

  return null;
}

function buildJsonLd(event: EventItem, url: string, imageUrl: string) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: buildDescription(event),
    startDate: event.start,
    endDate: event.end || event.start,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url,
    image: [imageUrl],
    location: {
      "@type": "Place",
      name: event.venue || event.city || "Por confirmar",
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city || undefined,
        addressRegion: event.province || undefined,
        addressCountry: "ES",
      },
    },
  };

  if (event.source) {
    jsonLd.organizer = {
      "@type": "Organization",
      name: event.source,
      url: event.sourceUrl || undefined,
    };
  }

  if (event.ticketUrl) {
    const offerData = event as EventOfferData;
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: event.ticketUrl,
      availability: "https://schema.org/InStock",
    };

    const hasNumericPrice = offerData.price !== null && offerData.price !== undefined && offerData.price !== "";
    const numericPrice = hasNumericPrice ? Number(offerData.price) : Number.NaN;
    const hasRealPrice = Number.isFinite(numericPrice) && (numericPrice > 0 || offerData.isFree === true);

    if (hasRealPrice) {
      offer.price = String(offerData.price);
      if (offerData.priceCurrency) {
        offer.priceCurrency = offerData.priceCurrency;
      }
    }

    if (offerData.validFrom) {
      offer.validFrom = offerData.validFrom;
    }

    jsonLd.offers = offer;
  }

  return jsonLd;
}

function relatedScore(current: EventItem, candidate: EventItem) {
  if (candidate.id === current.id || !candidate.start) return -1;

  const sameProvince = candidate.province === current.province;
  const sameDiscipline = candidate.discipline === current.discipline;
  const sameVehicleType = vehicleTypeOf(candidate) === vehicleTypeOf(current);

  if (sameProvince && sameDiscipline) return 40;
  if (sameProvince && sameVehicleType) return 30;
  if (sameDiscipline) return 20;
  if (sameVehicleType) return 10;

  return -1;
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

function relatedByProvince(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => event.id !== current.id && event.start >= today && event.province === current.province)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);
}

function relatedByDiscipline(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => event.id !== current.id && event.start >= today && event.discipline === current.discipline)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);
}

function relatedByWeekend(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);
  const { saturday, sunday } = eventWeekendRange(current);

  return events
    .filter((event) => event.id !== current.id && event.start >= today && eventOverlapsRange(event, saturday, sunday))
    .sort((a, b) => relatedScore(current, b) - relatedScore(current, a) || a.start.localeCompare(b.start))
    .slice(0, 4);
}

function relatedByCircuitTrackday(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => {
      if (event.id === current.id || event.start < today) return false;
      const text = eventSearchText(event);
      return ["circuito", "tandas", "rodadas", "rodada", "trackday", "trackdays", "jarama"].some((value) => text.includes(value));
    })
    .sort((a, b) => {
      const aMadrid = isMadridEvent(a) ? 1 : 0;
      const bMadrid = isMadridEvent(b) ? 1 : 0;
      return bMadrid - aMadrid || a.start.localeCompare(b.start);
    })
    .slice(0, 4);
}

function relatedByNorthernRally(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => {
      if (event.id === current.id || event.start < today) return false;
      const text = eventSearchText(event);
      const rallySignal = ["rally", "rallye", "rallysprint", "subida"].some((value) => text.includes(value));
      return rallySignal && (isNorthernEvent(event) || event.discipline === current.discipline);
    })
    .sort((a, b) => {
      const aNorth = isNorthernEvent(a) ? 1 : 0;
      const bNorth = isNorthernEvent(b) ? 1 : 0;
      return bNorth - aNorth || a.start.localeCompare(b.start);
    })
    .slice(0, 4);
}

function relatedByRallysprintNorth(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => {
      if (event.id === current.id || event.start < today) return false;
      const text = eventSearchText(event);
      const rallysprintSignal = ["rallysprint", "rally sprint"].some((value) => text.includes(value));
      const rallySignal = ["rally", "rallye", "subida"].some((value) => text.includes(value));
      return rallysprintSignal || (rallySignal && (isNorthernEvent(event) || event.discipline === current.discipline));
    })
    .sort((a, b) => {
      const aText = eventSearchText(a);
      const bText = eventSearchText(b);
      const aSprint = aText.includes("rallysprint") || aText.includes("rally sprint") ? 1 : 0;
      const bSprint = bText.includes("rallysprint") || bText.includes("rally sprint") ? 1 : 0;
      const aNorth = isNorthernEvent(a) ? 1 : 0;
      const bNorth = isNorthernEvent(b) ? 1 : 0;
      return bSprint - aSprint || bNorth - aNorth || a.start.localeCompare(b.start);
    })
    .slice(0, 4);
}

function relatedByCataloniaMoto(current: EventItem, events: EventItem[]) {
  const today = new Date().toISOString().slice(0, 10);

  return events
    .filter((event) => {
      if (event.id === current.id || event.start < today) return false;
      const text = eventSearchText(event);
      const motoSignal = ["moto", "motera", "moteras", "concentracion", "concentración", "mototurismo", "ruta", "biker"].some((value) => text.includes(normalizeText(value)));
      return motoSignal && (isCataloniaEvent(event) || event.province === current.province || event.discipline === current.discipline);
    })
    .sort((a, b) => {
      const aGirona = normalizeText(a.province).includes("girona") ? 1 : 0;
      const bGirona = normalizeText(b.province).includes("girona") ? 1 : 0;
      const aCatalonia = isCataloniaEvent(a) ? 1 : 0;
      const bCatalonia = isCataloniaEvent(b) ? 1 : 0;
      return bGirona - aGirona || bCatalonia - aCatalonia || a.start.localeCompare(b.start);
    })
    .slice(0, 4);
}

function dedupeRelatedGroups(groups: { title: string; eyebrow: string; events: EventItem[] }[]) {
  const seen = new Set<string>();

  return groups
    .map((group) => ({
      ...group,
      events: group.events.filter((event) => {
        const key = event.slug || event.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    }))
    .filter((group) => group.events.length);
}

function getRelatedEventGroups(current: EventItem, events: EventItem[]) {
  return dedupeRelatedGroups([
    ...(isJaramaTrackdayEvent(current)
      ? [
          {
            title: "Más tandas, rodadas y eventos de circuito",
            eyebrow: "Circuito y trackdays",
            events: relatedByCircuitTrackday(current, events),
          },
        ]
      : []),
    ...(isRallyPicosDeEuropa(current)
      ? [
          {
            title: "Rallyes y pruebas del norte",
            eyebrow: "Rallyes cercanos",
            events: relatedByNorthernRally(current, events),
          },
        ]
      : []),
    ...(isRallysprintCarreno(current)
      ? [
          {
            title: "Rallysprint y rallyes del norte",
            eyebrow: "Rallysprint cercano",
            events: relatedByRallysprintNorth(current, events),
          },
        ]
      : []),
    ...(isGallineroMotoFest(current)
      ? [
          {
            title: "Eventos moteros en Cataluña y Girona",
            eyebrow: "Moto y zona",
            events: relatedByCataloniaMoto(current, events),
          },
        ]
      : []),
    {
      title: `Más eventos en ${valueOrPending(current.province)}`,
      eyebrow: "Misma provincia",
      events: relatedByProvince(current, events),
    },
    {
      title: `Más eventos de ${valueOrPending(current.discipline)}`,
      eyebrow: "Misma disciplina",
      events: relatedByDiscipline(current, events),
    },
    {
      title: "Eventos del mismo fin de semana",
      eyebrow: "Fechas cercanas",
      events: relatedByWeekend(current, events),
    },
  ]);
}

function internalLinks(event: EventItem) {
  const type = vehicleTypeOf(event);
  const typeHref = "/calendario";
  const rallyeLaCeramica = isRallyeLaCeramica(event);
  const jaramaTrackday = isJaramaTrackdayEvent(event);
  const rallyPicosDeEuropa = isRallyPicosDeEuropa(event);
  const rallyeCiudadDeValencia = isRallyeCiudadDeValencia(event);
  const gallineroMotoFest = isGallineroMotoFest(event);
  const classicAlcoyEvent = isClassicAlcoyEvent(event);
  const rallysprintCarreno = isRallysprintCarreno(event);

  const links = [
    ...(classicAlcoyEvent
      ? [
          {
            label: "Concentraciones moteras 2026",
            meta: "Calendario relacionado",
            href: "/concentraciones-moteras-2026",
          },
          {
            label: "Eventos de clásicos",
            meta: "Disciplina relacionada",
            href: "/disciplinas/clasicos",
          },
          {
            label: "Eventos de motor en Comunidad Valenciana",
            meta: "Zona relacionada",
            href: "/eventos-motor-comunidad-valenciana",
          },
          {
            label: "Calendario completo",
            meta: "Todos los eventos",
            href: "/calendario",
          },
        ]
      : []),
    ...(rallysprintCarreno
      ? [
          {
            label: "Rallysprint en España 2026",
            meta: "Landing relacionada",
            href: "/rallysprint-espana-2026",
          },
          {
            label: "Rallyes en España 2026",
            meta: "Calendario de rallyes",
            href: "/rallyes-espana-2026",
          },
          {
            label: "Eventos de motor en el norte",
            meta: "Zona relacionada",
            href: "/zonas/norte",
          },
          {
            label: "Disciplina Rallyes",
            meta: "Más pruebas similares",
            href: "/disciplinas/rallyes",
          },
          {
            label: "Eventos de motor este fin de semana",
            meta: "Agenda general",
            href: "/eventos-motor-este-fin-de-semana",
          },
          {
            label: "Calendario completo",
            meta: "Todos los eventos",
            href: "/calendario",
          },
        ]
      : []),
    ...(gallineroMotoFest
      ? [
          {
            label: "Concentraciones moteras 2026",
            meta: "Calendario motero",
            href: "/concentraciones-moteras-2026",
          },
          {
            label: "Eventos de motor en Cataluña",
            meta: "Zona relacionada",
            href: "/eventos-motor-cataluna",
          },
          {
            label: "Eventos de motor este fin de semana",
            meta: "Agenda general",
            href: "/eventos-motor-este-fin-de-semana",
          },
          {
            label: "Disciplina Concentraciones",
            meta: "Más eventos moteros",
            href: "/disciplinas/concentraciones",
          },
          {
            label: "Calendario completo",
            meta: "Todos los eventos",
            href: "/calendario",
          },
        ]
      : []),
    ...(rallyeCiudadDeValencia
      ? [
          {
            label: "Rallyes Valencia 2026",
            meta: "Landing relacionada",
            href: "/rallyes-valencia-2026",
          },
          {
            label: "Rallyes en España 2026",
            meta: "Calendario de rallyes",
            href: "/rallyes-espana-2026",
          },
          {
            label: "Eventos de motor en Comunidad Valenciana",
            meta: "Zona relacionada",
            href: "/eventos-motor-comunidad-valenciana",
          },
          {
            label: "Disciplina Rallyes",
            meta: "Más pruebas similares",
            href: "/disciplinas/rallyes",
          },
          {
            label: "Calendario completo",
            meta: "Todos los eventos",
            href: "/calendario",
          },
        ]
      : []),
    ...(rallyPicosDeEuropa
      ? [
          {
            label: "Rallyes en España 2026",
            meta: "Calendario de rallyes",
            href: "/rallyes-espana-2026",
          },
          {
            label: "Disciplina Rallyes",
            meta: "Más pruebas similares",
            href: "/disciplinas/rallyes",
          },
          ...(isNorthernEvent(event)
            ? [
                {
                  label: "Eventos de motor en el norte",
                  meta: "Zona relacionada",
                  href: "/zonas/norte",
                },
              ]
            : []),
          {
            label: "Eventos de motor este fin de semana",
            meta: "Agenda general",
            href: "/eventos-motor-este-fin-de-semana",
          },
          {
            label: "Calendario completo",
            meta: "Todos los eventos",
            href: "/calendario",
          },
        ]
      : []),
    ...(jaramaTrackday
      ? [
          {
            label: "Trackdays en España 2026",
            meta: "Tandas y circuito",
            href: "/trackdays-espana-2026",
          },
          {
            label: "Rodadas moto 2026",
            meta: "Rodadas y tandas",
            href: "/rodadas-moto-2026",
          },
          ...(isMadridEvent(event)
            ? [
                {
                  label: "Eventos de motor en Madrid",
                  meta: "Zona relacionada",
                  href: "/eventos-motor-madrid",
                },
              ]
            : []),
          {
            label: "Eventos de circuito",
            meta: "Disciplina relacionada",
            href: "/disciplinas/circuito",
          },
          {
            label: "Eventos de motor este fin de semana",
            meta: "Agenda general",
            href: "/eventos-motor-este-fin-de-semana",
          },
        ]
      : []),
    ...(rallyeLaCeramica
      ? [
          {
            label: "Rallyes en España 2026",
            meta: "Calendario de rallyes",
            href: "/rallyes-espana-2026",
          },
          {
            label: "Disciplina Rallyes",
            meta: "Más pruebas similares",
            href: "/disciplinas/rallyes",
          },
          ...(isComunidadValencianaEvent(event)
            ? [
                {
                  label: "Rallyes en Valencia 2026",
                  meta: "Comunidad Valenciana",
                  href: "/rallyes-valencia-2026",
                },
                {
                  label: "Eventos de motor en Comunidad Valenciana",
                  meta: "Zona relacionada",
                  href: "/eventos-motor-comunidad-valenciana",
                },
              ]
            : []),
          {
            label: "Eventos de motor este fin de semana",
            meta: "Agenda general",
            href: "/eventos-motor-este-fin-de-semana",
          },
        ]
      : []),
    {
      label: `Ver eventos en ${valueOrPending(event.province)}`,
      meta: "Misma provincia",
      href: "/calendario",
    },
    {
      label: `Ver más eventos de ${valueOrPending(event.discipline)}`,
      meta: "Misma disciplina",
      href: `/disciplinas/${getDisciplineSlug(event.discipline)}`,
    },
    {
      label: `Ver eventos de ${vehicleLabel(event).toLowerCase()}`,
      meta: "Mismo tipo de vehículo",
      href: typeHref,
    },
  ];

  return links.filter((link, index, list) => list.findIndex((item) => item.href === link.href) === index);
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) return {};

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/evento/${event.slug || slug}`;
  const title = buildEventSeoTitle(event);
  const description = buildEventSeoDescription(event);
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const image = absoluteImageUrl(eventImage, siteUrl);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
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

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const events = await getVisibleEvents();
  const event = events.find((item) => item.slug === slug);

  if (!event) notFound();

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/evento/${event.slug || slug}`;
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const imageUrl = absoluteImageUrl(eventImage, siteUrl);
  const jsonLd = buildJsonLd(event, url, imageUrl);
  const relatedGroups = getRelatedEventGroups(event, events);
  const color = getDisciplineColor(event.discipline);
  const sourceAvailable = Boolean(event.sourceUrl);
  const links = internalLinks(event);
  const eventSeoNote = buildEventSeoNote(event);
  const trackingEventParams = {
    ...eventAnalyticsParams(event, { event_slug: event.slug || slug }),
    source: event.source,
  };
  const ticketTrackingEventParams = {
    ...trackingEventParams,
    ticket_url_domain: urlDomain(event.ticketUrl),
  };
  const savedEvent = {
    slug: event.slug || slug,
    title: event.title,
    start: event.start,
    end: event.end || event.start,
    city: event.city,
    province: event.province,
    venue: event.venue,
    discipline: event.discipline,
    category: (event as EventItem & { category?: string }).category,
    vehicle_type: vehicleTypeOf(event),
    source_url: event.sourceUrl,
    ticket_url: event.ticketUrl,
  };

  return (
    <div className="emc-page">
      <ConceptStyles />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ConceptStaticHeader />

      <article>
        <section className="emc-event-hero">
          <div className="emc-container emc-event-hero-grid">
            <div>
              <div className="emc-event-breadcrumb">
                <Link href="/">Inicio</Link>
                <span>/</span>
                <Link href="/calendario">Calendario</Link>
                <span>/</span>
                <Link href={`/disciplinas/${getDisciplineSlug(event.discipline)}`}>{event.discipline}</Link>
                <span>/</span>
                <strong>{event.title}</strong>
              </div>
              <div className="emc-event-chip-row">
                {event.featured ? <span className="emc-badge emc-featured-badge">Evento destacado</span> : null}
                <span className="emc-badge">{vehicleLabel(event)}</span>
                <span className="emc-badge" style={{ borderColor: `${color.accent}66`, backgroundColor: `${color.accent}18` }}>
                  {event.discipline}
                </span>
              </div>
              <p className="emc-event-date-line">{formatEventDate(event).toUpperCase()}</p>
              <h1>{event.title}</h1>
              <p className="emc-event-location">
                {valueOrPending(event.venue)} / {valueOrPending(event.city)} / {valueOrPending(event.province)}
              </p>
              {event.championship || event.source ? (
                <p className="emc-event-subline">{[event.championship, event.source].filter(Boolean).join(" / ")}</p>
              ) : null}
              <p className="emc-event-intro">{buildHeroSummary(event)}</p>
              {eventSeoNote ? (
                <p className="emc-event-seo-note">
                  {eventSeoNote}
                </p>
              ) : null}
            </div>

            <aside className="emc-event-side">
              <div className="emc-event-media-card">
                <Image
                  alt={eventImageAlt}
                  className="emc-event-image"
                  height={720}
                  priority
                  sizes="(max-width: 760px) 92vw, 460px"
                  src={eventImage}
                  unoptimized={isRemoteImage(eventImage)}
                  width={1152}
                />
              </div>

              <section className="emc-event-summary-card">
                <div className="emc-mini-head">
                  <h3>Ficha del evento</h3>
                  <span>{vehicleLabel(event)}</span>
                </div>
                <div className="emc-event-summary-list">
                  <SummaryRow label="Fecha" value={formatEventDate(event)} />
                  <SummaryRow label="Lugar" value={valueOrPending(event.venue)} />
                  <SummaryRow label="Ciudad/provincia" value={`${valueOrPending(event.city)} / ${valueOrPending(event.province)}`} />
                  <SummaryRow label="Tipo" value={vehicleLabel(event)} />
                  <SummaryRow label="Fuente" value={valueOrPending(event.source)} />
                </div>
                <div className="emc-event-actions">
                  {sourceAvailable ? (
                    <TrackAnchor
                      className="emc-btn emc-btn-primary"
                      eventName="click_official_source"
                      eventParams={trackingEventParams}
                      href={event.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ver fuente oficial
                    </TrackAnchor>
                  ) : null}
                  {event.ticketUrl ? (
                    <TrackAnchor
                      className="emc-btn emc-btn-ticket"
                      eventName="click_tickets"
                      eventParams={ticketTrackingEventParams}
                      href={event.ticketUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Entradas / inscripción
                    </TrackAnchor>
                  ) : null}
                  <EventRetentionActions event={savedEvent} />
                  <ShareEventButton title={event.title} url={url} />
                </div>
                <p className="emc-event-note">Confirma horarios, inscripciones y cambios en la fuente oficial antes de desplazarte.</p>
                {!sourceAvailable ? <p className="emc-event-note">Fuente oficial pendiente de revisión.</p> : null}
              </section>
            </aside>
          </div>
        </section>

        {/*
        <section className="emc-section emc-event-detail-section emc-event-detail-section-hidden">
          <div className="emc-container emc-event-detail-grid">
            <section className="emc-panel emc-event-copy-card">
              <div className="emc-kicker">Sobre el evento</div>
              <h2>{event.title}</h2>
              <p>{buildAboutText(event)}</p>
            </section>

            <section className="emc-panel emc-event-warning-card">
              <div className="emc-kicker">Antes de ir</div>
              <h3>Confirma la información oficial</h3>
              <p>Revisa la fuente oficial antes de desplazarte. Las fechas, horarios o inscripciones pueden cambiar.</p>
              {sourceAvailable ? (
                <TrackAnchor
                  className="emc-btn emc-btn-light"
                  eventName="click_official_source"
                  eventParams={trackingEventParams}
                  href={event.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir fuente
                </TrackAnchor>
              ) : null}
            </section>
          </div>
        </section>
        */}

        <section className="emc-section emc-event-key-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Información práctica</div>
                <h2>Datos practicos</h2>
              </div>
            </div>
            <div className="emc-event-info-grid">
              <Info label="Fecha" value={formatEventDate(event)} />
              <Info label="Ubicación" value={valueOrPending(event.venue)} />
              <Info label="Ciudad" value={valueOrPending(event.city)} />
              <Info label="Provincia" value={valueOrPending(event.province)} />
              <Info label="Comunidad" value={valueOrPending(event.region)} />
              <Info label="Disciplina" value={valueOrPending(event.discipline)} />
              <Info label="Tipo de vehículo" value={vehicleLabel(event)} />
              <Info label="Fuente" value={valueOrPending(event.source)} />
            </div>
            <div className="emc-practical-actions">
              {sourceAvailable ? (
                <TrackAnchor
                  className="emc-btn emc-btn-primary"
                  eventName="click_official_source"
                  eventParams={trackingEventParams}
                  href={event.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Ver fuente oficial
                </TrackAnchor>
              ) : null}
              {event.ticketUrl ? (
                <TrackAnchor
                  className="emc-btn emc-btn-ticket"
                  eventName="click_tickets"
                  eventParams={ticketTrackingEventParams}
                  href={event.ticketUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Entradas / inscripción
                </TrackAnchor>
              ) : null}
            </div>
          </div>
        </section>

        <section className="emc-section emc-internal-links-section emc-internal-links-section-early">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Explorar más</div>
                <h2>Eventos relacionados por contexto</h2>
              </div>
            </div>
            <div className="emc-internal-links">
              {links.map((link, index) => (
                <Link className="emc-internal-link-card" href={link.href} key={`${link.href}-${link.label}-${index}`}>
                  <span>{link.meta}</span>
                  <strong>{link.label}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {event.tags.length ? (
          <section className="emc-section emc-event-tags-section">
            <div className="emc-container">
              <section className="emc-panel emc-event-tags">
                <div className="emc-kicker">Etiquetas</div>
                <div>
                  {event.tags.map((tag) => (
                    <span className="emc-badge" key={`${event.id}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {relatedGroups.length ? (
          <section className="emc-section emc-event-related-section" id="relacionados">
            <div className="emc-container">
              <div className="emc-section-head">
                <div>
                  <div className="emc-kicker">Eventos relacionados</div>
                  <h2>Más eventos para seguir explorando</h2>
                </div>
                <Link className="emc-btn emc-btn-dark" href="/calendario">
                  Ver calendario
                </Link>
              </div>
              <div className="emc-related-group-stack">
                {relatedGroups.map((group) => (
                  <section className="emc-related-group" key={group.title}>
                    <div className="emc-kicker">{group.eyebrow}</div>
                    <h3>{group.title}</h3>
                    <div className="emc-results-grid">
                      {group.events.map((related) => {
                        const relatedColor = getDisciplineColor(related.discipline);
                        const label = dayLabel(related);

                        return (
                          <TrackLink
                            className="emc-result-card"
                            eventName="click_related_event"
                            eventParams={{
                              ...eventAnalyticsParams(related),
                              related_event_slug: related.slug,
                              related_event_title: related.title,
                              source_event_slug: event.slug || slug,
                              discipline: related.discipline,
                              zone: related.region || related.province,
                              vehicle_type: vehicleTypeOf(related),
                              source: group.eyebrow,
                            }}
                            href={eventHref(related)}
                            key={`${group.title}-${related.id}`}
                            style={{ "--emc-card-accent": relatedColor.accent } as CSSProperties}
                          >
                            <div className="emc-result-date">
                              {label.day}
                              <small>{label.month}</small>
                            </div>
                            <div>
                              <div className="emc-result-meta">
                                <span className="emc-badge">{related.discipline}</span>
                                <span className="emc-badge">{vehicleLabel(related)}</span>
                              </div>
                              <h3>{related.title}</h3>
                              <p>{formatRange(related)} / {related.city}, {related.province}</p>
                              <span className="emc-card-action">Ver evento</span>
                            </div>
                          </TrackLink>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="emc-section emc-internal-links-section">
          <div className="emc-container">
            <div className="emc-section-head">
              <div>
                <div className="emc-kicker">Explorar mas</div>
                <h2>Seguir buscando eventos</h2>
              </div>
            </div>
            <div className="emc-internal-links">
              {links.map((link, index) => (
                <Link className="emc-internal-link-card" href={link.href} key={`${link.href}-${link.label}-${index}`}>
                  <span>{link.meta}</span>
                  <strong>{link.label}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="emc-section emc-event-cta-section">
          <div className="emc-container">
            <div className="emc-panel emc-pro-panel emc-event-cta">
              <div>
                <div className="emc-kicker">Más eventos</div>
                <h2>¿Buscas más planes de motor?</h2>
                <p className="emc-pro-copy">Explora el calendario completo o filtra por eventos de moto y coche.</p>
                <div className="emc-pro-actions">
                  <Link className="emc-btn emc-btn-primary" href="/calendario">
                    Ver calendario
                  </Link>
                  <Link className="emc-btn emc-btn-dark" href="/calendario">
                    Ver más eventos {vehicleLabel(event).toLowerCase()}
                  </Link>
                </div>
              </div>
              <div className="emc-checks">
                <div className="emc-check">
                  <strong>{vehicleLabel(event)}</strong>
                  <span>Filtro principal</span>
                </div>
                <div className="emc-check">
                  <strong>{event.discipline}</strong>
                  <span>Disciplina</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </article>

      <footer className="emc-footer">
        <div className="emc-container emc-footer-grid">
          <div>
            <div className="emc-footer-brand">
              <EventomotorLogo />
            </div>
            <p>Calendario de eventos de motor por fecha, zona y disciplina.</p>
            <p className="emc-footer-contact">
              Contacto y publicación de eventos: <TrackAnchor eventName="click_contact_email" eventParams={{ location: "event_detail_footer" }} href="mailto:info@eventomotor.com">info@eventomotor.com</TrackAnchor>
            </p>
          </div>
          <div className="emc-footer-legal">© {new Date().getFullYear()} EventoMotor</div>
        </div>
      </footer>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="emc-event-info-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
