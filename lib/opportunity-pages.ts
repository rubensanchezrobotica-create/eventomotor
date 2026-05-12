import type { EventItem } from "@/types/event";
import { normalizeSeoText } from "@/lib/seo-taxonomy";

export type OpportunityPage = {
  slug: string;
  h1: string;
  title: string;
  description: string;
  eyebrow: string;
  lead: string;
  resultsTitle: string;
  intro: string;
  editorialBlocks: Array<{ title: string; text: string }>;
  usageSteps: Array<{ title: string; text: string }>;
  faqs: Array<{ question: string; answer: string }>;
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
    eyebrow: "Búsqueda popular",
    lead:
      "Una selección actualizada de eventos de motor para este fin de semana: motos, coches, competición, rutas y ferias ordenadas por fecha, ubicación y fuente.",
    resultsTitle: "Eventos de motor para este fin de semana",
    intro:
      "Si buscas planes de motor para este fin de semana, esta página reúne eventos próximos en España con una intención muy concreta: encontrar algo real a lo que ir sin perder tiempo entre fuentes dispersas. Aquí puedes consultar rallyes, concentraciones moteras, eventos de circuito, rutas, ferias, clásicos, karting y competiciones que encajan en el sábado y domingo más cercano o en los próximos días si el calendario está más justo. Cada evento enlaza a una ficha individual donde se prioriza la fecha, la ubicación, la disciplina y la fuente oficial. Antes de desplazarte, revisa siempre la información del organizador, ya que horarios, inscripciones, entradas o recorridos pueden cambiar.",
    editorialBlocks: [
      { title: "Fechas cercanas", text: "La selección prioriza el sábado y domingo más próximos, con apoyo de los siguientes días si hay poca actividad visible." },
      { title: "Planes variados", text: "Agrupa competiciones, concentraciones, rutas, circuito, clásicos, ferias y eventos mixtos para motos y coches." },
      { title: "Fuente revisable", text: "Cada ficha intenta llevarte a la información oficial para confirmar horarios, ubicación, inscripción o entradas." },
    ],
    usageSteps: [
      { title: "Elige una fecha", text: "Revisa primero los eventos más cercanos y abre la ficha que encaje con tu plan." },
      { title: "Comprueba la zona", text: "Usa ciudad y provincia para valorar desplazamiento, ruta y horarios." },
      { title: "Valida la fuente", text: "Antes de salir, confirma siempre cambios de última hora en el enlace oficial." },
    ],
    faqs: [
      { question: "¿Qué eventos de motor hay este fin de semana?", answer: "Depende del calendario publicado, pero EventoMotor puede incluir rallyes, concentraciones, circuitos, rutas, ferias, karting, clásicos y competiciones de motos o coches." },
      { question: "¿La página muestra solo sábado y domingo?", answer: "Se prioriza el fin de semana más cercano y se amplía a los próximos días cuando no hay suficientes eventos visibles." },
      { question: "¿Los eventos tienen fuente oficial?", answer: "Las fichas de EventoMotor muestran la fuente disponible cuando existe para que puedas revisar horarios, inscripción o entradas." },
      { question: "¿Puedo publicar un evento de este fin de semana?", answer: "Sí. Si organizas un evento con fecha, ubicación y fuente verificable, puedes enviarlo desde la página de publicar evento." },
    ],
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
    eyebrow: "Moto fin de semana",
    lead:
      "Encuentra concentraciones moteras para este fin de semana con fecha, ubicación y fuente oficial cuando esté disponible.",
    resultsTitle: "Concentraciones moteras encontradas",
    intro:
      "Las concentraciones moteras de fin de semana son una de las búsquedas más habituales para quienes quieren salir a rodar, quedar con otros motoristas o descubrir un plan cercano con ambiente biker. En EventoMotor filtramos las citas que encajan con concentraciones, motoalmuerzos, quedadas, rutas moteras y eventos relacionados con motos para ayudarte a encontrar opciones útiles en España. La selección se centra en el sábado y domingo más cercano y se apoya en los próximos días cuando no hay suficientes eventos visibles. Cada card enlaza con una ficha del evento donde puedes comprobar ubicación, fecha, disciplina y fuente oficial. Confirma siempre horarios, inscripción y punto de encuentro antes de desplazarte.",
    editorialBlocks: [
      { title: "Ambiente motero", text: "Se priorizan concentraciones, motoalmuerzos, rutas, quedadas y planes con intención clara para motoristas." },
      { title: "Datos para decidir", text: "Las fichas destacan fecha, localidad, provincia, disciplina y fuente para evitar perder tiempo entre publicaciones dispersas." },
      { title: "Antes de rodar", text: "Revisa el punto de encuentro y posibles cambios de horario o inscripción en la fuente oficial." },
    ],
    usageSteps: [
      { title: "Filtra por cercanía", text: "Consulta provincia y localidad para encontrar planes asumibles en ruta." },
      { title: "Abre la ficha", text: "Cada evento enlazado resume lo esencial y apunta a la fuente cuando existe." },
      { title: "Publica tu cita", text: "Los organizadores pueden enviar eventos moteros con fuente verificable." },
    ],
    faqs: [
      { question: "¿Dónde ver concentraciones moteras este fin de semana?", answer: "Esta página agrupa concentraciones, motoalmuerzos, rutas y quedadas moteras publicadas en EventoMotor para el fin de semana más cercano o los próximos días." },
      { question: "¿Incluye rutas moteras además de concentraciones?", answer: "Sí. Cuando los datos lo permiten, también aparecen rutas, motoalmuerzos, quedadas y eventos relacionados con motos." },
      { question: "¿Puedo ver la fuente oficial?", answer: "Si el evento tiene fuente oficial en los datos, la ficha incluye el enlace para que puedas confirmar detalles." },
      { question: "¿Cómo publicar una concentración motera?", answer: "Puedes enviar nombre, fecha, ubicación, disciplina, fuente oficial y cartel desde la página de publicar evento." },
    ],
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
    eyebrow: "Calendario 2026",
    lead:
      "Calendario de rallyes en España 2026 con pruebas de asfalto, tierra, rallysprint, regularidad, subidas y bajas organizadas por fecha y ubicación.",
    resultsTitle: "Calendario de rallyes encontrados",
    intro:
      "El calendario de rallyes en España 2026 reúne pruebas de distintos formatos: rallyes de asfalto, rallyes de tierra, rallysprints, subidas de montaña, regularidad, bajas y citas regionales que mueven a equipos y aficionados por todo el país. Esta página está pensada para quienes buscan una visión práctica de rallyes publicados en EventoMotor, con enlaces a fichas individuales cuando existe información suficiente. En cada ficha puedes revisar fecha, ciudad, provincia, disciplina, fuente oficial y posibles enlaces de entradas o inscripción. El objetivo es ayudarte a localizar pruebas sin depender de listados fragmentados, manteniendo una referencia clara y verificable. Antes de planificar viaje o asistencia, confirma siempre los detalles en la fuente oficial.",
    editorialBlocks: [
      { title: "Temporada ordenada", text: "Reúne pruebas de rally, rallysprint, subidas, regularidad y bajas para consultar el calendario 2026 de forma práctica." },
      { title: "Ubicaciones clave", text: "Cada card prioriza ciudad y provincia para identificar rápido dónde se celebra la prueba." },
      { title: "Ficha verificable", text: "Cuando hay datos suficientes, la ficha individual recoge fuente oficial, fecha, disciplina y enlaces relevantes." },
    ],
    usageSteps: [
      { title: "Localiza la prueba", text: "Empieza por fecha y provincia para situar rallyes cercanos o citas de referencia." },
      { title: "Revisa la ficha", text: "Consulta detalles básicos y enlaces antes de organizar desplazamiento." },
      { title: "Vuelve al calendario", text: "Usa el calendario general para cruzar rallyes con otras disciplinas de motor." },
    ],
    faqs: [
      { question: "¿Dónde ver rallyes en España en 2026?", answer: "EventoMotor agrupa rallyes, rallysprints, subidas, regularidad y bajas publicados con fecha, ubicación y fuente cuando está disponible." },
      { question: "¿Qué tipos de rallyes aparecen en EventoMotor?", answer: "Pueden aparecer rallyes de asfalto, tierra, subidas de montaña, rallysprints, regularidad, bajas y pruebas regionales." },
      { question: "¿Los eventos incluyen fuente oficial?", answer: "Si el dato existe, la ficha enlaza a la fuente oficial para revisar itinerarios, cambios, inscripciones o entradas." },
      { question: "¿Cómo saber si un rally tiene inscripción o entradas?", answer: "La ficha puede mostrar enlace de entradas o inscripción si está disponible; si no, conviene revisar la fuente oficial." },
    ],
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
    eyebrow: "Eventos por zona",
    lead:
      "Una vista local para descubrir eventos de motor en Barcelona y alrededores: competiciones, circuito, concentraciones, rutas y ferias con información organizada por fecha.",
    resultsTitle: "Eventos de motor en Barcelona y alrededores",
    intro:
      "Barcelona es una de las provincias con mayor actividad del calendario de motor en España, con eventos de circuito, competiciones, concentraciones moteras, rutas, ferias, clásicos y pruebas cercanas durante buena parte del año. En esta página reunimos eventos publicados en EventoMotor que tienen relación con Barcelona como ciudad, provincia o zona de referencia. La idea es facilitar una búsqueda directa para usuarios que quieren planes de motor cerca, sin mezclar resultados de otras áreas. Cada evento enlaza con su ficha individual, donde puedes revisar fecha, ubicación, disciplina, fuente oficial y entradas si existen. Antes de asistir, comprueba siempre horarios, inscripción y posibles cambios en la comunicación oficial.",
    editorialBlocks: [
      { title: "Agenda local", text: "La selección se centra en eventos relacionados con Barcelona, su provincia y referencias cercanas del calendario." },
      { title: "Motos y coches", text: "Puede incluir circuito, competiciones, concentraciones, rutas, clásicos, ferias y planes mixtos." },
      { title: "Enlaces útiles", text: "Las fichas enlazan a la fuente o a entradas cuando existe información suficiente en los datos." },
    ],
    usageSteps: [
      { title: "Busca por fecha", text: "Ordena mentalmente la agenda con las próximas citas disponibles." },
      { title: "Compara disciplinas", text: "Usa los enlaces internos para saltar a circuito, rallyes, rutas o concentraciones." },
      { title: "Confirma detalles", text: "Antes de asistir, revisa la fuente oficial del evento." },
    ],
    faqs: [
      { question: "¿Qué eventos de motor hay en Barcelona?", answer: "Pueden aparecer eventos de circuito, competiciones, concentraciones, rutas, ferias, clásicos y citas de motos o coches relacionadas con Barcelona." },
      { question: "¿Se incluyen eventos de motos y coches?", answer: "Sí. La página puede mostrar eventos de motos, coches, mixtos, karting u otros tipos si están publicados en el calendario." },
      { question: "¿Puedo ver eventos por fecha?", answer: "Los resultados se ordenan por fecha y cada ficha muestra la información básica para decidir rápido." },
      { question: "¿Cómo publicar un evento en Barcelona?", answer: "Los organizadores pueden enviar la información oficial desde publicar evento para que se revise su inclusión." },
    ],
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
    eyebrow: "Eventos por zona",
    lead:
      "Una selección de eventos de motor en Valencia y su entorno: motos, coches, concentraciones, circuito, rutas y ferias ordenadas por fecha y fuente.",
    resultsTitle: "Eventos de motor en Valencia",
    intro:
      "Valencia y su entorno reúnen eventos de motor muy variados: actividades en circuito, concentraciones moteras, rutas, ferias, clásicos, competiciones y planes vinculados a coches y motos. Esta página agrupa las citas de EventoMotor relacionadas con Valencia para que puedas consultarlas por fecha, disciplina y ubicación sin navegar por todo el calendario nacional. Las fichas individuales permiten revisar información práctica como ciudad, provincia, recinto, fuente oficial y enlaces de entradas o inscripción cuando están disponibles. Es una página pensada para búsquedas locales de alta intención, útil tanto para aficionados como para organizadores que quieren entender qué actividad hay en la zona. Confirma siempre la información oficial antes de desplazarte.",
    editorialBlocks: [
      { title: "Zona Levante", text: "Agrupa citas relacionadas con Valencia, Comunitat Valenciana y referencias cercanas del calendario de motor." },
      { title: "Experiencias variadas", text: "Puede reunir concentraciones, circuito, rutas, ferias, clásicos, competiciones y planes de coches o motos." },
      { title: "Consulta fiable", text: "Las fichas muestran la fuente disponible para verificar horarios, venta de entradas o inscripciones." },
    ],
    usageSteps: [
      { title: "Empieza por fecha", text: "Localiza los próximos eventos publicados en Valencia y alrededores." },
      { title: "Abre el detalle", text: "Consulta ciudad, provincia, disciplina y fuente en la ficha individual." },
      { title: "Explora Levante", text: "Salta a la zona Levante para ver más eventos cercanos." },
    ],
    faqs: [
      { question: "¿Qué eventos de motor hay en Valencia?", answer: "EventoMotor puede mostrar eventos de circuito, concentraciones, rutas, ferias, clásicos y competiciones relacionadas con Valencia." },
      { question: "¿Aparecen eventos del Circuit Ricardo Tormo?", answer: "Si están publicados en los datos visibles y encajan con Valencia o Cheste, pueden aparecer en esta página." },
      { question: "¿Puedo filtrar por disciplina?", answer: "Desde los enlaces internos puedes saltar a disciplinas como rutas, circuito, rallyes o concentraciones." },
      { question: "¿Cómo enviar un evento de Valencia?", answer: "Puedes enviarlo a EventoMotor desde la página de publicar evento con fecha, ubicación y fuente verificable." },
    ],
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
