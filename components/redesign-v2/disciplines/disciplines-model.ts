import { classifyEventDisciplinePage, type DisciplineSlug } from "@/components/disciplines/discipline-preview-model";
import { isCalendarDateKey, madridCalendarDateKey } from "@/components/redesign-v2/calendar/calendar-page-model";
import { SEO_DISCIPLINES } from "@/lib/seo-taxonomy";
import type { EventItem } from "@/types/event";

export type DisciplineHubCard = {
  description: string;
  href: `/disciplinas/${DisciplineSlug}`;
  icon: string;
  label: string;
  slug: DisciplineSlug;
  upcomingCount: number;
};

export type DisciplinesPageModel = {
  cards: DisciplineHubCard[];
  today: string;
  totalUpcomingEventCount: number;
  totalVisibleEventCount: number;
  unmappedUpcomingCount: number;
};

const DISCIPLINE_ICONS: Record<DisciplineSlug, string> = {
  rallyes: "/images/disciplines/icons/web/discipline-rallyes.png",
  circuito: "/images/disciplines/icons/web/discipline-circuito.png",
  concentraciones: "/images/disciplines/icons/web/discipline-concentraciones.png",
  offroad: "/images/disciplines/icons/web/discipline-offroad.png",
  clasicos: "/images/disciplines/icons/web/discipline-clasicos.png",
  karting: "/images/disciplines/icons/web/discipline-karting.png",
  rutas: "/images/disciplines/icons/web/discipline-rutas.png",
  ferias: "/images/disciplines/icons/web/discipline-ferias.png",
};

function eventIdentity(event: EventItem) {
  return String(event.slug || event.id).trim();
}

function deduplicateVisibleEvents(events: readonly EventItem[]) {
  const unique = new Map<string, EventItem>();

  for (const event of events) {
    if (event.visible === false) continue;
    const identity = eventIdentity(event);
    if (!identity || unique.has(identity)) continue;
    unique.set(identity, event);
  }

  return [...unique.values()];
}

function validDateKey(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return isCalendarDateKey(normalized) ? normalized : null;
}

export function isUpcomingDisciplineEvent(event: EventItem, today: string) {
  const start = validDateKey(event.start);
  if (!start) return false;
  const end = validDateKey(event.end);
  return (end && end >= start ? end : start) >= today;
}

export function disciplineUpcomingCountLabel(count: number) {
  if (count === 0) return "Sin próximos eventos";
  if (count === 1) return "1 evento próximo";
  return `${count} eventos próximos`;
}

export function buildDisciplinesPageModel(
  events: readonly EventItem[],
  now: string | Date = new Date(),
): DisciplinesPageModel {
  const today = madridCalendarDateKey(now);
  const visibleEvents = deduplicateVisibleEvents(events);
  const upcomingEvents = visibleEvents.filter((event) => isUpcomingDisciplineEvent(event, today));
  const counts = new Map<DisciplineSlug, number>();
  let unmappedUpcomingCount = 0;

  for (const event of upcomingEvents) {
    const discipline = classifyEventDisciplinePage(event);
    if (!discipline) {
      unmappedUpcomingCount += 1;
      continue;
    }
    counts.set(discipline, (counts.get(discipline) || 0) + 1);
  }

  return {
    cards: SEO_DISCIPLINES.map((discipline) => ({
      description: discipline.description,
      href: `/disciplinas/${discipline.slug}`,
      icon: DISCIPLINE_ICONS[discipline.slug],
      label: discipline.title,
      slug: discipline.slug,
      upcomingCount: counts.get(discipline.slug) || 0,
    })),
    today,
    totalUpcomingEventCount: upcomingEvents.length,
    totalVisibleEventCount: visibleEvents.length,
    unmappedUpcomingCount,
  };
}
