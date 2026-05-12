import type { EventItem } from "@/types/event";
import { normalizeSeoText } from "@/lib/seo-taxonomy";

export type OpportunityPage = {
  slug: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  relatedLinks: Array<{ label: string; href: string }>;
  filter: (event: EventItem, now: Date) => boolean;
};

function eventSearchText(event: EventItem) {
  return normalizeSeoText(
    [
      event.title,
      event.championship,
      event.discipline,
      event.venue,
      event.city,
      event.province,
      event.region,
      ...(event.tags || []),
      event.vehicleType,
      event.vehicle_type,
    ].join(" "),
  );
}

function includesAny(event: EventItem, terms: string[]) {
  const text = eventSearchText(event);
  return terms.some((term) => text.includes(normalizeSeoText(term)));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function eventStart(event: EventItem) {
  return new Date(`${event.start}T12:00:00`);
}

function isFutureOrToday(event: EventItem, now: Date) {
  return eventStart(event).getTime() >= startOfDay(now).getTime();
}

function nextWeekendRange(now: Date) {
  const today = startOfDay(now);
  const day = today.getDay();
  const daysUntilSaturday = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  sunday.setHours(23, 59, 59, 999);
  return { saturday, sunday };
}

function isNextWeekend(event: EventItem, now: Date) {
  const { saturday, sunday } = nextWeekendRange(now);
  const start = eventStart(event);
  return start.getTime() >= saturday.getTime() && start.getTime() <= sunday.getTime();
}

function isNextSevenDays(event: EventItem, now: Date) {
  const start = eventStart(event);
  const today = startOfDay(now);
  const end = new Date(today);
  end.setDate(today.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return start.getTime() >= today.getTime() && start.getTime() <= end.getTime();
}

function weekendOpportunity(event: EventItem, now: Date) {
  return isNextWeekend(event, now) || isNextSevenDays(event, now);
}

function isYear(event: EventItem, year: number) {
  return eventStart(event).getFullYear() === year;
}

const rallyTerms = ["rally", "rallye", "rallysprint", "subida", "regularidad", "baja", "montaña", "montana"];
const concentrationTerms = ["concentración", "concentracion", "motoalmuerzo", "quedada", "moteras", "motera", "biker", "custom"];

export const OPPORTUNITY_PAGES: OpportunityPage[] = [
  {
    slug: "eventos-motor-este-fin-de-semana",
    h1: "Eventos de motor este fin de semana",
    title: "Eventos de motor este fin de semana | EventoMotor",
    description:
      "Consulta eventos de motor este fin de semana en España: rallyes, concentraciones, circuitos, rutas, ferias, motos y coches.",
    intro:
      "Si buscas planes de motor para este fin de semana, esta página reúne eventos próximos en España con una intención muy concreta: encontrar algo real a lo que ir sin perder tiempo entre fuentes dispersas. Aquí puedes consultar rallyes, concentraciones moteras, eventos de circuito, rutas, ferias, clásicos, karting y competiciones que encajan en el sábado y domingo más cercano o en los próximos días si el calendario está más justo. Cada evento enlaza a una ficha individual donde se prioriza la fecha, la ubicación, la disciplina y la fuente oficial. Antes de desplazarte, revisa siempre la información del organizador, ya que horarios, inscripciones, entradas o recorridos pueden cambiar.",
    relatedLinks: [
      { label: "Calendario general", href: "/#calendario" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event, now) => weekendOpportunity(event, now),
  },
  {
    slug: "concentraciones-moteras-este-fin-de-semana",
    h1: "Concentraciones moteras este fin de semana",
    title: "Concentraciones moteras este fin de semana | EventoMotor",
    description:
      "Encuentra concentraciones moteras este fin de semana en España con fecha, ubicación y fuente oficial.",
    intro:
      "Las concentraciones moteras de fin de semana son una de las búsquedas más habituales para quienes quieren salir a rodar, quedar con otros motoristas o descubrir un plan cercano con ambiente biker. En EventoMotor filtramos las citas que encajan con concentraciones, motoalmuerzos, quedadas, rutas moteras y eventos relacionados con motos para ayudarte a encontrar opciones útiles en España. La selección se centra en el sábado y domingo más cercano y se apoya en los próximos días cuando no hay suficientes eventos visibles. Cada card enlaza con una ficha del evento donde puedes comprobar ubicación, fecha, disciplina y fuente oficial. Confirma siempre horarios, inscripción y punto de encuentro antes de desplazarte.",
    relatedLinks: [
      { label: "Calendario general", href: "/#calendario" },
      { label: "Concentraciones moteras", href: "/disciplinas/concentraciones" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event, now) => weekendOpportunity(event, now) && includesAny(event, concentrationTerms),
  },
  {
    slug: "rallyes-espana-2026",
    h1: "Rallyes en España 2026",
    title: "Rallyes en España 2026 | Calendario de rallyes | EventoMotor",
    description:
      "Consulta el calendario de rallyes en España 2026: pruebas, subidas, regularidad, fechas, ubicaciones y fuentes oficiales.",
    intro:
      "El calendario de rallyes en España 2026 reúne pruebas de distintos formatos: rallyes de asfalto, rallyes de tierra, rallysprints, subidas de montaña, regularidad, bajas y citas regionales que mueven a equipos y aficionados por todo el país. Esta página está pensada para quienes buscan una visión práctica de rallyes publicados en EventoMotor, con enlaces a fichas individuales cuando existe información suficiente. En cada ficha puedes revisar fecha, ciudad, provincia, disciplina, fuente oficial y posibles enlaces de entradas o inscripción. El objetivo es ayudarte a localizar pruebas sin depender de listados fragmentados, manteniendo una referencia clara y verificable. Antes de planificar viaje o asistencia, confirma siempre los detalles en la fuente oficial.",
    relatedLinks: [
      { label: "Calendario general", href: "/#calendario" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Eventos en el norte", href: "/zonas/norte" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && includesAny(event, rallyTerms),
  },
  {
    slug: "eventos-motor-barcelona",
    h1: "Eventos de motor en Barcelona",
    title: "Eventos de motor en Barcelona | EventoMotor",
    description:
      "Encuentra eventos de motor en Barcelona: motos, coches, circuitos, concentraciones, rallyes, rutas y ferias.",
    intro:
      "Barcelona es una de las provincias con mayor actividad del calendario de motor en España, con eventos de circuito, competiciones, concentraciones moteras, rutas, ferias, clásicos y pruebas cercanas durante buena parte del año. En esta página reunimos eventos publicados en EventoMotor que tienen relación con Barcelona como ciudad, provincia o zona de referencia. La idea es facilitar una búsqueda directa para usuarios que quieren planes de motor cerca, sin mezclar resultados de otras áreas. Cada evento enlaza con su ficha individual, donde puedes revisar fecha, ubicación, disciplina, fuente oficial y entradas si existen. Antes de asistir, comprueba siempre horarios, inscripción y posibles cambios en la comunicación oficial.",
    relatedLinks: [
      { label: "Calendario general", href: "/#calendario" },
      { label: "Cataluña / Aragón", href: "/zonas/cataluna-aragon" },
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => includesAny(event, ["barcelona", "montmeló", "montmelo", "catalunya", "cataluña", "cataluna"]),
  },
  {
    slug: "eventos-motor-valencia",
    h1: "Eventos de motor en Valencia",
    title: "Eventos de motor en Valencia | EventoMotor",
    description:
      "Consulta eventos de motor en Valencia por fecha, disciplina y fuente oficial: motos, coches, concentraciones, circuitos y rutas.",
    intro:
      "Valencia y su entorno reúnen eventos de motor muy variados: actividades en circuito, concentraciones moteras, rutas, ferias, clásicos, competiciones y planes vinculados a coches y motos. Esta página agrupa las citas de EventoMotor relacionadas con Valencia para que puedas consultarlas por fecha, disciplina y ubicación sin navegar por todo el calendario nacional. Las fichas individuales permiten revisar información práctica como ciudad, provincia, recinto, fuente oficial y enlaces de entradas o inscripción cuando están disponibles. Es una página pensada para búsquedas locales de alta intención, útil tanto para aficionados como para organizadores que quieren entender qué actividad hay en la zona. Confirma siempre la información oficial antes de desplazarte.",
    relatedLinks: [
      { label: "Calendario general", href: "/#calendario" },
      { label: "Levante", href: "/zonas/levante" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => includesAny(event, ["valencia", "comunitat valenciana", "comunidad valenciana", "cheste", "ricardo tormo"]),
  },
];

export function getOpportunityPage(slug: string) {
  return OPPORTUNITY_PAGES.find((page) => page.slug === slug);
}
