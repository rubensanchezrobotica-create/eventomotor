import type { Metadata } from "next";
import type { EventItem } from "@/types/event";
import { absoluteMetadataTitle, SITE_NAME, SITE_URL } from "@/lib/seo";
import { SEO_COMMUNITIES, matchesSeoCommunity } from "@/lib/seo-communities";
import { normalizeSeoText } from "@/lib/seo-taxonomy";
import { canonicalPublicHref, PUBLIC_NAVIGATION } from "@/lib/public-navigation";

type RegionalHighlight = {
  label: string;
  href: string;
  terms: string[];
  vehicleTypes?: string[];
};

type RegionalHub = {
  regionName: string;
  title: string;
  description: string;
  weekendTitle: string;
  emptyText: string;
  highlightsTitle: string;
  highlights: RegionalHighlight[];
};

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
  layoutType?: "regional";
  regionalHub?: RegionalHub;
  filter: (event: EventItem, now: Date) => boolean;
  fallbackFilter?: (event: EventItem, now: Date) => boolean;
  relatedFilter?: (event: EventItem, now: Date) => boolean;
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

function eventEnd(event: EventItem) {
  return new Date(`${event.end || event.start}T12:00:00`);
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
  const end = eventEnd(event);

  return start.getTime() <= sunday.getTime() && end.getTime() >= saturday.getTime();
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
  return isNextWeekend(event, now);
}

function isYear(event: EventItem, year: number) {
  return eventStart(event).getFullYear() === year;
}

const rallyTerms = ["rally", "rallye", "rallysprint", "subida", "regularidad", "baja", "montaña", "montana"];
const rallysprintTerms = ["rallysprint", "rally sprint", "sprint", "villa de grado", "grado", "carreno", "carreño"];
const concentrationTerms = ["concentración", "concentracion", "motoalmuerzo", "quedada", "moteras", "motera", "biker", "custom"];
const motoalmuerzoTerms = [
  "motoalmuerzo",
  "moto almuerzo",
  "almuerzo motero",
  "matinal motera",
  "matinal motero",
  "matinal",
  "quedada motera de mañana",
  "quedada motera de manana",
  "concentración motera con almuerzo",
  "concentracion motera con almuerzo",
];
const extendedConcentrationTerms = [
  ...concentrationTerms,
  "matinal",
  "encuentro motero",
  "fiesta motera",
  "solidaria",
  "solidario",
  "yuncler",
];
const circuitTerms = ["circuito", "trackday", "track day", "rodada", "rodadas", "tandas", "tandas libres", "curso de conduccion", "curso de conducción", "racing experience", "drift day"];
const kartingTerms = ["karting", "kart", "endurance karting", "karting alquiler", "campeonato de karting", "carrera de karting"];
const MOTORCYCLE_TRACKDAY_ACTIVITY_PHRASES = [
  "tandas libres",
  "tandas de motos",
  "tandas moto",
  "tandas para motos",
  "rodada",
  "rodadas",
  "rodada de motos",
  "rodadas de motos",
  "trackday",
  "trackdays",
  "track day",
  "track days",
  "trackday moto",
  "trackdays motos",
  "curso y tandas",
  "curso tandas",
  "curso de conduccion y tandas",
  "curso de conduccion tandas",
];
const AUTOMOTIVE_RALLY_VEHICLES = new Set(["coche", "coches", "automovil", "automovilismo"]);
const EXPLICIT_NON_AUTOMOTIVE_RALLY_VEHICLES = new Set([
  "moto",
  "motos",
  "motocicleta",
  "motocicletas",
  "mixto",
]);
const AUTOMOTIVE_RALLY_STRUCTURED_TERMS = [
  "automovil",
  "automovilismo",
  "automovilistico",
  "coche",
  "coches",
];
const COMPETITIVE_RALLY_DISCIPLINES = new Set([
  "rally",
  "rallye",
  "rallyes",
  "rallysprint",
  "rally sprint",
  "rally tierra",
  "rally historico",
  "rally tt",
  "rallymix",
  "rallycrono",
  "eco rally",
  "montana",
  "subida",
  "regularidad",
  "regularidad clasicos",
  "tramo cronometrado de subida",
]);
const GENERIC_RALLY_DISCIPLINES = new Set([
  "",
  "otro",
  "otros",
  "automovilismo",
  "clasico",
  "clasicos",
  "competicion",
  "motor",
]);
const COMPETITIVE_RALLY_FALLBACK_PHRASES = [
  "rally",
  "rallye",
  "rallysprint",
  "rally sprint",
  "rally historico",
  "rallye historico",
  "rally de tierra",
  "rallye de tierra",
  "rally tt",
  "baja",
  "subida",
  "montana",
  "regularidad",
];
const FAIR_DISCIPLINES = new Set(["feria", "ferias"]);
const FAIR_EXACT_TAGS = new Set(["feria", "ferias", "exposicion"]);
const FAIR_STRONG_PHRASES = [
  "feria del motor",
  "feria de motos",
  "feria de motocicletas",
  "feria de la moto",
  "feria del automovil",
  "feria de automoviles",
  "feria de coches",
  "feria del coche",
  "feria de vehiculos de ocasion",
  "feria del vehiculo de ocasion",
  "feria profesional",
  "salon del automovil",
  "salon de la moto",
  "salon de motos",
  "salon del motor",
  "motor show",
  "auto show",
  "expo motor",
  "exposicion de vehiculos",
];

function normalizedPhraseText(values: Array<string | undefined>) {
  const normalized = normalizeSeoText(values.filter(Boolean).join(" "))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return ` ${normalized} `;
}

function includesNormalizedPhrase(text: string, phrase: string) {
  return text.includes(normalizedPhraseText([phrase]));
}

function hasAutomotiveRallySignal(event: EventItem) {
  const vehicles = [event.vehicleType, event.vehicle_type]
    .filter((vehicle): vehicle is string => Boolean(vehicle))
    .map((vehicle) => normalizeSeoText(vehicle).trim());

  if (vehicles.some((vehicle) => EXPLICIT_NON_AUTOMOTIVE_RALLY_VEHICLES.has(vehicle))) {
    return false;
  }
  if (vehicles.some((vehicle) => AUTOMOTIVE_RALLY_VEHICLES.has(vehicle))) return true;
  if (vehicles.some((vehicle) => vehicle !== "otros" && vehicle !== "otro")) return false;

  const structuredText = normalizedPhraseText([
    event.discipline,
    event.championship,
    ...(event.tags || []),
  ]);

  return AUTOMOTIVE_RALLY_STRUCTURED_TERMS.some((term) =>
    includesNormalizedPhrase(structuredText, term),
  );
}

export function matchesCompetitiveAutomotiveRallyOpportunity(event: EventItem) {
  if (!hasAutomotiveRallySignal(event)) return false;

  const discipline = normalizeSeoText(event.discipline).trim();
  if (COMPETITIVE_RALLY_DISCIPLINES.has(discipline)) return true;
  if (!GENERIC_RALLY_DISCIPLINES.has(discipline)) return false;

  const fallbackText = normalizedPhraseText([
    event.title,
    event.championship,
    ...(event.tags || []),
  ]);

  return COMPETITIVE_RALLY_FALLBACK_PHRASES.some((phrase) =>
    includesNormalizedPhrase(fallbackText, phrase),
  );
}

export function matchesMotorcycleTrackdayOpportunity(event: EventItem) {
  const hasMotorcycleVehicle = [event.vehicleType, event.vehicle_type]
    .filter((vehicleType): vehicleType is string => Boolean(vehicleType))
    .some((vehicleType) => normalizeSeoText(vehicleType).trim() === "moto");

  if (!hasMotorcycleVehicle) return false;

  const discipline = normalizeSeoText(event.discipline).trim();
  if (discipline === "tandas") return true;

  const activityText = normalizedPhraseText([
    event.title,
    event.championship,
    ...(event.tags || []),
  ]);

  return MOTORCYCLE_TRACKDAY_ACTIVITY_PHRASES.some((phrase) =>
    activityText.includes(normalizedPhraseText([phrase])),
  );
}

export function matchesFairOpportunity(event: EventItem) {
  const discipline = normalizeSeoText(event.discipline).trim();
  if (FAIR_DISCIPLINES.has(discipline)) return true;

  const tags = (event.tags || []).map((tag) => normalizeSeoText(tag).trim());
  if (tags.some((tag) => FAIR_EXACT_TAGS.has(tag))) return true;

  const semanticText = normalizedPhraseText([event.title, event.championship, ...tags]);
  return FAIR_STRONG_PHRASES.some((phrase) =>
    semanticText.includes(normalizedPhraseText([phrase])),
  );
}

const RAW_OPPORTUNITY_PAGES: OpportunityPage[] = [
  {
    slug: "eventos-motor-este-fin-de-semana",
    h1: "Eventos de motor este fin de semana",
    title: "Eventos de motor este fin de semana | Agenda en España | EventoMotor",
    description:
      "Consulta eventos de motor este fin de semana en España: concentraciones moteras, rallyes, motoalmuerzos, tandas, ferias y actividades por provincia y fuente oficial.",
    eyebrow: "Búsqueda popular",
    lead:
      "Encuentra concentraciones moteras, rallyes, motoalmuerzos, rodadas, ferias y otros eventos de motor previstos para este fin de semana en España.",
    resultsTitle: "Eventos de motor para este fin de semana",
    intro:
      "Si buscas eventos del motor este fin de semana, esta página reúne planes próximos en España con una intención muy concreta: encontrar algo real a lo que ir sin perder tiempo entre fuentes dispersas. Puedes consultar concentraciones moteras, motoalmuerzos, rallyes, rodadas, ferias, clásicos y eventos de circuito que encajan en el sábado y domingo más cercano. Cada evento enlaza a una ficha individual donde se prioriza la fecha, la ubicación, la disciplina y la fuente oficial. Antes de desplazarte, revisa siempre la información del organizador, ya que horarios, inscripciones, entradas o recorridos pueden cambiar.",
    editorialBlocks: [
      { title: "Agenda de fin de semana", text: "La seleccion prioriza sabado y domingo, con apoyo de los siguientes dias cuando hay pocos eventos visibles." },
      { title: "Planes de motor", text: "Agrupa competiciones, concentraciones, rutas, circuito, clasicos, ferias y eventos mixtos para motos y coches." },
      { title: "Fuente revisable", text: "Cada ficha intenta llevarte a la informacion oficial para confirmar horarios, ubicacion, inscripcion o entradas." },
    ],
    usageSteps: [
      { title: "Elige una fecha", text: "Revisa primero los eventos mas cercanos y abre la ficha que encaje con tu plan." },
      { title: "Comprueba la zona", text: "Usa ciudad y provincia para valorar desplazamiento, ruta y horarios." },
      { title: "Valida la fuente", text: "Antes de salir, confirma siempre cambios de ultima hora en el enlace oficial." },
    ],
    faqs: [
      { question: "¿Dónde ver eventos de motor este fin de semana?", answer: "En esta página se agrupan eventos publicados para el sábado y domingo más cercano, con enlace a la ficha individual de cada evento." },
      { question: "¿Qué tipos de eventos aparecen en EventoMotor?", answer: "La agenda puede incluir concentraciones moteras, motoalmuerzos, rallyes, rallysprints, rodadas, tandas, ferias, clásicos, rutas y otros eventos de motor." },
      { question: "¿Cómo confirmar horarios e inscripción?", answer: "Abre la ficha del evento y revisa la fuente oficial o el enlace de inscripción, porque horarios, precios, plazas o ubicaciones pueden cambiar." },
      { question: "¿Puedo publicar un evento para este fin de semana?", answer: "Sí. Si organizas una concentración, rallye, rodada, feria o motoalmuerzo, puedes enviarlo desde publicar evento para que se revise antes de aparecer en el calendario." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Motoalmuerzos 2026", href: "/motoalmuerzos-2026" },
      { label: "Rallyes en España 2026", href: "/rallyes-espana-2026" },
      { label: "Rallysprint en España 2026", href: "/rallysprint-espana-2026" },
      { label: "Rodadas moto 2026", href: "/rodadas-moto-2026" },
      { label: "Trackdays en España 2026", href: "/trackdays-espana-2026" },
      { label: "Karting en España 2026", href: "/karting-espana-2026" },
      { label: "Ferias del motor 2026", href: "/ferias-motor-espana-2026" },
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
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Concentraciones moteras", href: "/disciplinas/concentraciones" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event, now) => weekendOpportunity(event, now) && includesAny(event, concentrationTerms),
  },
  {
    slug: "concentraciones-moteras-2026",
    h1: "Concentraciones moteras 2026",
    title: "Concentraciones moteras 2026 | Calendario, motoalmuerzos y matinales | EventoMotor",
    description:
      "Consulta el calendario de concentraciones moteras 2026 en España: motoalmuerzos, matinales, quedadas y eventos de motos por fecha, provincia y fuente oficial.",
    eyebrow: "Calendario motero 2026",
    lead:
      "Calendario de concentraciones moteras 2026 en España con motoalmuerzos, matinales, quedadas y eventos de motos ordenados por fecha, ubicación y fuente oficial.",
    resultsTitle: "Próximas concentraciones moteras 2026",
    intro:
      "Las concentraciones moteras 2026 reúnen planes de fin de semana, motoalmuerzos, quedadas, matinales, encuentros biker, eventos custom y citas solidarias para motoristas. Esta página agrupa eventos publicados en EventoMotor que encajan con la intención de búsqueda de concentración motera, incluyendo consultas concretas como concentración motera Yuncler 2026 cuando existe información visible en el calendario. No inventamos eventos ni programas: solo listamos citas con datos suficientes para enlazar a su ficha individual. Desde cada evento puedes revisar fecha, ciudad, provincia, disciplina, tipo de vehículo, fuente oficial y enlaces disponibles antes de organizar ruta o desplazamiento.",
    editorialBlocks: [
      { title: "Planes moteros", text: "Se priorizan concentraciones, motoalmuerzos, quedadas, matinales, encuentros biker, custom y eventos solidarios relacionados con motos." },
      { title: "Calendario 2026", text: "La selección se centra en eventos visibles de 2026 para quienes buscan fechas concretas durante la temporada." },
      { title: "Información verificable", text: "Cada ficha intenta aportar fuente oficial, ubicación y enlaces disponibles para confirmar detalles antes de asistir." },
    ],
    usageSteps: [
      { title: "Busca por fecha", text: "Consulta las próximas concentraciones y localiza planes que encajen con tu ruta." },
      { title: "Revisa la ficha", text: "Comprueba ciudad, provincia, fuente oficial y enlaces disponibles antes de desplazarte." },
      { title: "Envía tu evento", text: "Si organizas una concentración motera, puedes enviarla para revisión desde publicar evento." },
    ],
    faqs: [
      { question: "¿Dónde ver concentraciones moteras 2026?", answer: "EventoMotor agrupa concentraciones de motos, motoalmuerzos, matinales, quedadas y eventos biker publicados con fecha, provincia y fuente cuando existe." },
      { question: "¿Incluye motoalmuerzos y matinales moteras?", answer: "Sí. Cuando están publicados con datos verificables, el calendario puede incluir motoalmuerzos, matinales, quedadas, encuentros biker y eventos custom." },
      { question: "¿Cómo saber si una concentración sigue activa?", answer: "Abre la ficha del evento y revisa siempre la fuente oficial enlazada, porque horarios, inscripciones, puntos de encuentro o programa pueden cambiar." },
      { question: "¿Se incluyen concentraciones custom y biker?", answer: "Sí. Si están publicadas con datos verificables, la página puede incluir eventos custom, biker, solidarios, quedadas y encuentros moteros." },
      { question: "¿Cómo publicar una concentración motera en EventoMotor?", answer: "Puedes enviar nombre, fecha, ubicación, fuente oficial, cartel y datos de contacto desde publicar evento para que la revisemos antes de incorporarla al calendario." },
    ],
    relatedLinks: [
      { label: "Motoalmuerzos y matinales moteras 2026", href: "/motoalmuerzos-2026" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Disciplina Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Eventos de motor en Cataluña", href: "/eventos-motor-cataluna" },
      { label: "Eventos de motor en Comunidad Valenciana", href: "/eventos-motor-comunidad-valenciana" },
      { label: "Eventos de motor en Andalucía", href: "/eventos-motor-andalucia" },
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) =>
      isYear(event, 2026) &&
      includesAny(event, extendedConcentrationTerms) &&
      includesAny(event, ["moto", "motera", "moteras", "biker", "custom", "concentracion", "concentración", "motoalmuerzo"]),
  },
  {
    slug: "motoalmuerzos-2026",
    h1: "Motoalmuerzos 2026",
    title: "Motoalmuerzos 2026 | Calendario de motoalmuerzos y matinales | EventoMotor",
    description:
      "Consulta motoalmuerzos 2026 en España: matinales moteras, quedadas, concentraciones con almuerzo, fechas, provincias y fuentes oficiales.",
    eyebrow: "Agenda motera 2026",
    lead:
      "Encuentra motoalmuerzos, matinales moteras y quedadas con almuerzo en España. Consulta fechas, provincias, inscripción y fuente oficial de cada evento.",
    resultsTitle: "Próximos motoalmuerzos y matinales moteras",
    intro:
      "Esta página recopila motoalmuerzos 2026, matinales moteras, quedadas de mañana y concentraciones con almuerzo publicadas en EventoMotor. La selección se basa en eventos reales del calendario que incluyen señales claras en su nombre, disciplina, etiquetas o información disponible, sin inventar horarios, rutas ni inscripciones. Cada card enlaza a una ficha individual donde puedes revisar fecha, ciudad, provincia, fuente oficial y enlace de inscripción cuando exista. Los motoalmuerzos suelen depender mucho del cartel o canal del club organizador, así que conviene confirmar siempre punto de encuentro, horario, precio y posibles cambios antes de desplazarte.",
    editorialBlocks: [
      { title: "Eventos de mañana", text: "Se priorizan motoalmuerzos, matinales, quedadas y encuentros moteros pensados para salir temprano o compartir almuerzo." },
      { title: "Datos verificables", text: "La página muestra solo eventos publicados en EventoMotor y enlaza a la fuente oficial cuando existe en la ficha." },
      { title: "Contexto motero", text: "Si hay pocos motoalmuerzos puros, se muestran concentraciones relacionadas en un bloque secundario diferenciado." },
    ],
    usageSteps: [
      { title: "Ordena por fecha", text: "Empieza por los próximos eventos y revisa provincia o ciudad para encontrar planes cercanos." },
      { title: "Abre la ficha", text: "Comprueba inscripción, fuente oficial, ubicación y cualquier enlace disponible antes de organizar la salida." },
      { title: "Publica tu cita", text: "Si tu club organiza un motoalmuerzo o matinal, puedes enviarlo para revisión desde EventoMotor." },
    ],
    faqs: [
      { question: "¿Dónde ver motoalmuerzos 2026?", answer: "En EventoMotor puedes consultar motoalmuerzos, matinales moteras y quedadas con almuerzo publicadas con fecha, provincia y fuente oficial cuando está disponible." },
      { question: "¿Qué diferencia hay entre motoalmuerzo, matinal motera y concentración motera?", answer: "Un motoalmuerzo suele girar alrededor de una reunión de mañana con almuerzo; una matinal motera es un encuentro de mañana, y una concentración puede incluir más actividades, rutas o varios días." },
      { question: "¿Cómo confirmar horarios e inscripción?", answer: "Abre la ficha del evento y revisa siempre la fuente oficial o el enlace de inscripción, porque horarios, precio, plazas o ubicación pueden cambiar." },
      { question: "¿Puedo publicar un motoalmuerzo en EventoMotor?", answer: "Sí. Puedes enviar la información desde publicar evento con nombre, fecha, ubicación, fuente oficial y datos de contacto para que se revise antes de publicarlo." },
    ],
    relatedLinks: [
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Publicar un motoalmuerzo", href: "/publicar-evento" },
      { label: "Disciplina Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Eventos de motor en Comunidad Valenciana", href: "/eventos-motor-comunidad-valenciana" },
      { label: "Eventos de motor en Cataluña", href: "/eventos-motor-cataluna" },
      { label: "Eventos de motor en Andalucía", href: "/eventos-motor-andalucia" },
    ],
    filter: (event) => isYear(event, 2026) && includesAny(event, motoalmuerzoTerms),
    relatedFilter: (event) =>
      isYear(event, 2026) &&
      includesAny(event, extendedConcentrationTerms) &&
      includesAny(event, ["moto", "motera", "moteras", "biker", "custom", "concentracion", "concentración"]),
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
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Eventos en el norte", href: "/zonas/norte" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) =>
      isYear(event, 2026) && matchesCompetitiveAutomotiveRallyOpportunity(event),
  },
  {
    slug: "rallysprint-espana-2026",
    h1: "Rallysprint en España 2026",
    title: "Rallysprint en España 2026 | Calendario rallysprint | EventoMotor",
    description:
      "Consulta rallysprint en España 2026: Rallysprint Carreño, Villa de Grado, fechas, ubicaciones y fuentes oficiales.",
    eyebrow: "Rallysprint 2026",
    lead:
      "Calendario de rallysprint en España 2026 con pruebas publicadas en EventoMotor, priorizando rallysprints y citas relacionadas cuando el calendario es limitado.",
    resultsTitle: "Calendario rallysprint 2026",
    intro:
      "Las búsquedas de rallysprint España 2026, Rallysprint Carreño 2026, rallysprint Villa de Grado 2026 o rallysprint Grado 2026 necesitan una página centrada en pruebas cortas, fechas y fuentes fiables. Esta landing reúne eventos publicados en EventoMotor que encajan con rallysprint, rally sprint, Carreño, Villa de Grado o Grado. Si el calendario específico queda corto, puede apoyarse en pruebas de rally relacionadas de 2026 para que el usuario no llegue a una página vacía, pero siempre sin inventar citas ni resultados. Cada card enlaza a una ficha individual donde se puede revisar fecha, ubicación, disciplina, fuente oficial y enlaces disponibles antes de planificar asistencia o inscripción.",
    editorialBlocks: [
      { title: "Prioridad rallysprint", text: "La selección da preferencia a eventos que mencionan rallysprint, rally sprint, Carreño, Villa de Grado o Grado." },
      { title: "Temporada 2026", text: "Los resultados se centran en eventos de 2026 y se ordenan por fecha para facilitar consulta rápida." },
      { title: "Ficha verificable", text: "Cada evento enlaza a una ficha con ubicación, disciplina, fuente oficial y enlaces disponibles cuando existen." },
    ],
    usageSteps: [
      { title: "Localiza la prueba", text: "Empieza por fecha y provincia para encontrar rallysprints publicados en el calendario." },
      { title: "Abre el detalle", text: "Revisa la ficha individual para confirmar fuente, ubicación y posibles enlaces de inscripción." },
      { title: "Explora rallyes", text: "Si buscas más pruebas, salta al calendario general de rallyes en España 2026." },
    ],
    faqs: [
      { question: "Dónde ver rallysprint en España 2026?", answer: "Esta página agrupa rallysprints publicados en EventoMotor con fecha, ubicación y fuente oficial cuando está disponible." },
      { question: "Aparece Rallysprint Carreño 2026?", answer: "Si el evento está publicado y visible, aparece listado con enlace a su ficha para revisar fecha, ubicación y fuente oficial." },
      { question: "Aparece Rallysprint Villa de Grado 2026?", answer: "Si el evento está publicado en los datos visibles y encaja con la búsqueda, aparecerá listado con enlace a su ficha." },
      { question: "La página incluye rallyes si no hay suficientes rallysprint?", answer: "Sí, puede incluir eventos de rally relacionados de 2026 solo como apoyo cuando el listado específico de rallysprint es limitado." },
      { question: "Cómo confirmar horarios o inscripción?", answer: "Abre la ficha del evento y revisa la fuente oficial o enlaces disponibles antes de desplazarte." },
    ],
    relatedLinks: [
      { label: "Rallysprint Carreño 2026", href: "/evento/rallysprint-carreno-2026-07-04" },
      { label: "Rallyes en España 2026", href: "/rallyes-espana-2026" },
      { label: "Disciplina Rallyes", href: "/disciplinas/rallyes" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && includesAny(event, rallysprintTerms),
    fallbackFilter: (event) =>
      isYear(event, 2026) &&
      includesAny(event, rallyTerms) &&
      !includesAny(event, rallysprintTerms),
  },
  {
    slug: "rallyes-valencia-2026",
    h1: "Rallyes en Valencia 2026",
    title: "Rally Valencia 2026 | Rallye Ciudad de Valencia | EventoMotor",
    description:
      "Consulta rallyes Valencia 2026 y pruebas de la Comunitat Valenciana: Rallye Ciudad de Valencia, Rally de la Ceramica, rallysprints y subidas con fuente oficial.",
    eyebrow: "Rallyes Comunidad Valenciana",
    lead:
      "Calendario de rallyes en Valencia 2026 y pruebas relacionadas en la Comunitat Valenciana, ordenadas por fecha, ubicacion y fuente oficial.",
    resultsTitle: "Rallyes encontrados en Valencia y Comunitat Valenciana",
    intro:
      "Las busquedas de rally Valencia 2026, Rally Ciudad de Valencia, Rally de la Ceramica o rallyes en la Comunitat Valenciana necesitan una referencia clara y verificable. Esta pagina reune eventos publicados en EventoMotor que combinan intencion de rally, rallysprint, subidas, regularidad, bajas o rally TT con Valencia, Castellon, Alicante y el entorno valenciano. No inventamos pruebas: solo aparecen eventos visibles en el calendario con datos suficientes para enlazar a su ficha individual. Desde cada ficha puedes revisar fecha, ciudad, provincia, disciplina, fuente oficial y enlaces disponibles antes de planificar desplazamiento o inscripcion.",
    editorialBlocks: [
      { title: "Rallyes valencianos", text: "La seleccion busca pruebas relacionadas con Valencia y la Comunitat Valenciana, incluyendo rallyes, rallysprints, subidas y bajas cuando existen en los datos." },
      { title: "Busquedas concretas", text: "La pagina ayuda a usuarios que buscan Rally Ciudad de Valencia, Rally de la Ceramica o rallysprints valencianos de 2026." },
      { title: "Fuente oficial", text: "Cada evento enlaza a una ficha donde se prioriza fuente, fecha y ubicacion para confirmar informacion antes de asistir." },
    ],
    usageSteps: [
      { title: "Revisa la fecha", text: "Empieza por los eventos proximos y comprueba si la prueba encaja con tu calendario." },
      { title: "Confirma ubicacion", text: "Mira ciudad, provincia y recinto o zona de referencia antes de organizar el desplazamiento." },
      { title: "Abre la ficha", text: "La ficha individual recoge fuente oficial y enlaces disponibles cuando existen." },
    ],
    faqs: [
      { question: "Donde ver rallyes en Valencia en 2026?", answer: "Esta pagina reune rallyes, rallysprints, subidas y pruebas relacionadas con Valencia o Comunitat Valenciana que esten publicadas en EventoMotor." },
      { question: "Aparece el Rally Ciudad de Valencia 2026?", answer: "Si el evento esta publicado en los datos visibles y encaja con la busqueda, aparecera listado con enlace a su ficha individual." },
      { question: "Aparece el Rally de la Ceramica 2026?", answer: "Si hay una ficha visible relacionada con el Rally de la Ceramica o su zona, se mostrara en esta pagina sin inventar informacion." },
      { question: "La pagina incluye rallysprint y subidas?", answer: "Si, puede incluir rallysprint, subidas, regularidad, bajas o rally TT cuando estan relacionados con Valencia o la Comunitat Valenciana." },
    ],
    relatedLinks: [
      { label: "Rallye Ciudad de Valencia 2026", href: "/evento/rallye-ciudad-de-valencia-2026-10-23" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Rallysprint en España 2026", href: "/rallysprint-espana-2026" },
      { label: "Eventos de motor en Valencia", href: "/eventos-motor-valencia" },
      { label: "Disciplina Rallyes", href: "/disciplinas/rallyes" },
      { label: "Zona Levante", href: "/zonas/levante" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) =>
      isYear(event, 2026) &&
      includesAny(event, rallyTerms) &&
      includesAny(event, ["valencia", "comunitat valenciana", "comunidad valenciana", "castellon", "alicante", "ceramica", "levante"]),
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
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
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
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Levante", href: "/zonas/levante" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => includesAny(event, ["valencia", "comunitat valenciana", "comunidad valenciana", "cheste", "ricardo tormo"]),
  },
  {
    slug: "eventos-motor-madrid",
    h1: "Eventos de motor en Madrid",
    title: "Eventos de motor en Madrid | EventoMotor",
    description:
      "Consulta eventos de motor en Madrid: concentraciones moteras, karting, ferias del motor, coches, motos, circuito y planes con fuente oficial.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda local para descubrir eventos de motor en Madrid y Comunidad de Madrid, con citas de motos, coches, karting, ferias y concentraciones.",
    resultsTitle: "Eventos de motor en Madrid",
    layoutType: "regional",
    regionalHub: {
      regionName: "Madrid",
      title: "Eventos de motor este fin de semana en Madrid",
      description: "Seleccion regional con eventos publicados para Madrid y su entorno: Jarama, clubes locales, concentraciones, clasicos, ferias y rutas.",
      weekendTitle: "Agenda regional del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Madrid. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por intencion",
      highlights: [
        { label: "Concentraciones moteras", href: "/disciplinas/concentraciones", terms: ["concentracion", "motoalmuerzo", "motera", "moteras", "biker"] },
        { label: "Jarama y circuito", href: "/disciplinas/circuito", terms: ["jarama", "circuito", "trackday", "tandas", "rodada", "rodadas"] },
        { label: "Clasicos y coches", href: "/disciplinas/clasicos", terms: ["clasico", "clasicos", "historico", "coche", "coches"], vehicleTypes: ["coche"] },
        { label: "Ferias y rutas", href: PUBLIC_NAVIGATION.calendar, terms: ["feria", "salon", "ruta", "mototurismo"] },
      ],
    },
    intro:
      "Madrid concentra una parte importante de la actividad de motor en España: concentraciones moteras, eventos de coches, karting, ferias, rutas y citas vinculadas a clubes, recintos o municipios de la Comunidad de Madrid. Esta pagina agrupa eventos publicados en EventoMotor que tienen relacion con Madrid como ciudad, provincia o comunidad autonoma. No inventamos eventos ni completamos programas: solo mostramos citas visibles en el calendario con datos suficientes para enlazar a una ficha individual. Desde cada evento puedes revisar fecha, ciudad, provincia, disciplina, tipo de vehiculo, fuente oficial y enlaces disponibles antes de planificar tu asistencia.",
    editorialBlocks: [
      { title: "Agenda local", text: "La seleccion se centra en Madrid y Comunidad de Madrid para usuarios que buscan planes cercanos de motor." },
      { title: "Motos y coches", text: "Puede incluir concentraciones moteras, eventos de coches, karting, ferias, circuito y actividades mixtas." },
      { title: "Fuente revisable", text: "Las fichas priorizan fecha, ubicacion y fuente oficial para confirmar detalles antes de desplazarte." },
    ],
    usageSteps: [
      { title: "Empieza por fecha", text: "Localiza primero los proximos eventos publicados en Madrid." },
      { title: "Compara disciplinas", text: "Salta a rallyes, concentraciones, karting o ferias si buscas un tipo concreto." },
      { title: "Confirma la fuente", text: "Antes de asistir, revisa la ficha y la fuente oficial disponible." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Madrid?", answer: "EventoMotor puede mostrar concentraciones moteras, karting, ferias, eventos de coches, rutas, circuito y planes mixtos relacionados con Madrid." },
      { question: "Hay concentraciones moteras en Madrid?", answer: "Si hay eventos visibles con disciplina o categoria de concentracion motera en Madrid, apareceran en esta pagina con enlace a su ficha." },
      { question: "Se incluyen eventos de karting en Madrid?", answer: "Si los datos publicados tienen relacion con Madrid y karting, se listan junto al resto de eventos locales." },
      { question: "Como publicar un evento de motor en Madrid?", answer: "Puedes enviarlo desde publicar evento con fecha, ubicacion y fuente verificable para que se revise." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rallyes en España 2026", href: "/rallyes-espana-2026" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.madrid),
  },
  {
    slug: "eventos-motor-andalucia",
    h1: "Eventos de motor en Andalucía",
    title: "Eventos de motor en Andalucía | EventoMotor",
    description:
      "Consulta eventos de motor en Andalucía: rallyes, concentraciones moteras, karting, ferias, coches y motos por fecha y fuente oficial.",
    eyebrow: "Eventos por region",
    lead:
      "Calendario de eventos de motor en Andalucia con rallyes, concentraciones moteras, karting, ferias y planes de coches o motos.",
    resultsTitle: "Eventos de motor en Andalucía",
    layoutType: "regional",
    regionalHub: {
      regionName: "Andalucia",
      title: "Eventos de motor este fin de semana en Andalucia",
      description: "Seleccion regional para Sevilla, Malaga, Cadiz, Granada, Cordoba, Jaen, Huelva y Almeria, con foco en eventos publicados y verificables.",
      weekendTitle: "Agenda regional del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Andalucia. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por disciplina",
      highlights: [
        { label: "Rallyes y subidas", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "rallysprint", "subida"] },
        { label: "Concentraciones moteras", href: "/disciplinas/concentraciones", terms: ["concentracion", "motoalmuerzo", "motera", "moteras", "biker"] },
        { label: "Motocross y enduro", href: "/disciplinas/offroad", terms: ["motocross", "enduro", "offroad", "trial", "mx"] },
        { label: "Ferias y clasicos", href: "/disciplinas/ferias", terms: ["feria", "salon", "clasico", "clasicos", "historico"] },
      ],
    },
    intro:
      "Andalucia tiene una escena de motor amplia, con rallyes, subidas, concentraciones moteras, karting, ferias, clasicos y eventos locales repartidos por Sevilla, Malaga, Cadiz, Cordoba, Granada, Huelva, Jaen y Almeria. Esta pagina filtra eventos publicados en EventoMotor que encajan con la region andaluza o sus provincias principales. El objetivo es facilitar una busqueda local clara para aficionados que quieren localizar planes reales sin recorrer todo el calendario nacional. Cada resultado enlaza a una ficha donde se priorizan fecha, ubicacion, disciplina, fuente oficial y enlaces disponibles. Antes de desplazarte, confirma siempre horarios o inscripciones en la comunicacion oficial.",
    editorialBlocks: [
      { title: "Cobertura regional", text: "Agrupa eventos vinculados a Andalucia y provincias como Sevilla, Malaga, Cadiz, Cordoba, Granada, Huelva, Jaen y Almeria." },
      { title: "Variedad de disciplinas", text: "Puede reunir rallyes, concentraciones, karting, ferias, clasicos, circuito y eventos mixtos de motos o coches." },
      { title: "Consulta verificable", text: "Cada ficha intenta llevarte a la fuente oficial para revisar cambios, horarios o inscripciones." },
    ],
    usageSteps: [
      { title: "Busca por provincia", text: "Identifica rapidamente si el evento cae cerca de tu zona." },
      { title: "Abre la ficha", text: "Consulta fecha, ubicacion, disciplina y fuente antes de planificar." },
      { title: "Explora disciplinas", text: "Usa los enlaces internos para ver rallyes, concentraciones, karting o ferias." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Andalucia?", answer: "Puede haber rallyes, concentraciones moteras, karting, ferias, clasicos, rutas y otros eventos de coches o motos publicados en EventoMotor." },
      { question: "Incluye rallyes en Andalucia?", answer: "Si existen rallyes, rallysprints, subidas o pruebas relacionadas con Andalucia en los datos visibles, apareceran listados." },
      { question: "Aparecen concentraciones moteras andaluzas?", answer: "Si estan publicadas con ubicacion andaluza y fuente suficiente, se muestran con enlace a su ficha." },
      { question: "Como enviar un evento andaluz?", answer: "Puedes proponerlo desde publicar evento aportando fecha, ubicacion, disciplina y fuente oficial." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.andalucia),
  },
  {
    slug: "eventos-motor-cataluna",
    h1: "Eventos de motor en Cataluña",
    title: "Eventos de motor en Cataluña 2026 | Este fin de semana y calendario | EventoMotor",
    description:
      "Consulta eventos de motor en Cataluña: concentraciones moteras, rallyes, coches, motos, rutas, ferias y citas del fin de semana en Barcelona, Girona, Tarragona y Lleida, con fecha, ubicación y fuente oficial.",
    eyebrow: "Eventos por region",
    lead:
      "Una vista regional para descubrir eventos de motor en Cataluña, incluyendo citas de este fin de semana en Barcelona, Girona, Tarragona y Lleida cuando hay eventos publicados.",
    resultsTitle: "Próximos eventos de motor en Cataluña",
    layoutType: "regional",
    regionalHub: {
      regionName: "Cataluna",
      title: "Eventos de motor este fin de semana en Cataluna",
      description: "Seleccion regional para Barcelona, Girona, Tarragona y Lleida, con circuito, rallyes, concentraciones, clasicos y eventos publicados en EventoMotor.",
      weekendTitle: "Agenda regional del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Cataluna. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por intencion",
      highlights: [
        { label: "Barcelona, Girona y Tarragona", href: "/eventos-motor-barcelona", terms: ["barcelona", "girona", "tarragona", "lleida"] },
        { label: "Circuit de Barcelona-Catalunya", href: "/disciplinas/circuito", terms: ["montmelo", "montmeló", "circuit de barcelona", "circuito", "trackday"] },
        { label: "Rallyes y concentraciones", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "rallysprint", "subida", "concentracion", "motoalmuerzo"] },
        { label: "Motos, clasicos y coches", href: PUBLIC_NAVIGATION.calendar, terms: ["moto", "motera", "clasico", "clasicos", "coche", "coches"], vehicleTypes: ["moto", "coche"] },
      ],
    },
    intro:
      "Cataluña es una de las zonas con mas actividad del calendario de motor, con eventos en Barcelona, Girona, Tarragona y Lleida, ademas de competiciones, karting, concentraciones moteras, rallyes, circuito, ferias y clasicos. Esta pagina agrupa eventos publicados en EventoMotor que tienen relacion con Cataluña, Catalunya o sus provincias principales. La intencion es ofrecer una entrada regional clara para usuarios que buscan eventos motor Cataluña, eventos motor Barcelona o rallyes en Cataluña sin mezclar resultados de otras zonas. Cada card enlaza a una ficha individual con fecha, ubicacion, disciplina, fuente oficial y enlaces disponibles si existen.",
    editorialBlocks: [
      { title: "Cataluña y provincias", text: "Filtra eventos relacionados con Cataluña, Catalunya, Barcelona, Girona, Tarragona y Lleida." },
      { title: "Calendario variado", text: "Puede incluir circuito, rallyes, karting, concentraciones, ferias, clasicos y eventos mixtos." },
      { title: "Fichas individuales", text: "Cada resultado enlaza a una pagina del evento con datos practicos y fuente oficial cuando esta disponible." },
    ],
    usageSteps: [
      { title: "Revisa la zona", text: "Comprueba ciudad y provincia para valorar desplazamiento." },
      { title: "Filtra por tipo", text: "Salta a rallyes, karting, ferias o concentraciones desde los enlaces internos." },
      { title: "Confirma detalles", text: "Abre la ficha y revisa la fuente oficial antes de asistir." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Cataluña?", answer: "EventoMotor puede listar competiciones, karting, concentraciones, rallyes, ferias, clasicos y eventos de motos o coches relacionados con Cataluña." },
      { question: "Incluye eventos de motor en Barcelona?", answer: "Si. La pagina recoge eventos vinculados a Cataluña y puede incluir Barcelona como ciudad, provincia o referencia regional." },
      { question: "Aparecen rallyes en Cataluña?", answer: "Si los rallyes o rallysprints estan publicados y relacionados con Cataluña, apareceran en el listado." },
      { question: "Puedo publicar un evento catalan?", answer: "Si organizas un evento con fuente verificable, puedes enviarlo desde publicar evento." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Eventos de motor en Barcelona", href: "/eventos-motor-barcelona" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.cataluna),
  },
  {
    slug: "eventos-motor-comunidad-valenciana",
    h1: "Eventos de motor en Comunidad Valenciana",
    title: "Eventos de motor en Comunidad Valenciana | EventoMotor",
    description:
      "Consulta eventos de motor en Comunidad Valenciana: Valencia, Alicante, Castellón, rallyes, concentraciones moteras, circuito, karting y ferias.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Comunidad Valenciana, con Valencia, Alicante, Castellon, rallyes, concentraciones, circuito, karting y ferias.",
    resultsTitle: "Eventos de motor en Comunidad Valenciana",
    layoutType: "regional",
    regionalHub: {
      regionName: "Comunidad Valenciana",
      title: "Eventos de motor este fin de semana en Comunidad Valenciana",
      description: "Seleccion regional para Valencia, Alicante y Castellon, con Cheste, Ricardo Tormo, rallyes, concentraciones, clasicos y eventos mixtos.",
      weekendTitle: "Agenda regional del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Comunidad Valenciana. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por zona y tipo",
      highlights: [
        { label: "Valencia, Alicante y Castellon", href: "/eventos-motor-valencia", terms: ["valencia", "alicante", "castellon", "castellón"] },
        { label: "Cheste y Ricardo Tormo", href: "/disciplinas/circuito", terms: ["cheste", "ricardo tormo", "circuito", "trackday", "tandas"] },
        { label: "Rallyes valencianos", href: "/rallyes-valencia-2026", terms: ["rally", "rallye", "rallysprint", "subida", "ceramica"] },
        { label: "Motos, coches y clasicos", href: PUBLIC_NAVIGATION.calendar, terms: ["moto", "motera", "coche", "coches", "clasico", "clasicos"], vehicleTypes: ["moto", "coche"] },
      ],
    },
    intro:
      "La Comunidad Valenciana combina eventos de motor en Valencia, Alicante y Castellon con rallyes, concentraciones moteras, karting, ferias, circuito, clasicos y planes de coches o motos. Esta landing esta pensada para busquedas como eventos motor Comunidad Valenciana, eventos de motor en Valencia, rallyes Valencia 2026 o concentraciones moteras Valencia. Los resultados proceden de eventos visibles en EventoMotor y no se inventan citas ni programas. Desde cada ficha puedes revisar fecha, ciudad, provincia, disciplina, fuente oficial y enlaces disponibles antes de desplazarte o compartir el evento.",
    editorialBlocks: [
      { title: "Valencia, Alicante y Castellon", text: "La pagina filtra eventos relacionados con la Comunitat Valenciana y sus tres provincias principales." },
      { title: "Rallyes y concentraciones", text: "Puede reunir rallyes, concentraciones moteras, circuito, karting, ferias y eventos mixtos." },
      { title: "Informacion util", text: "Las fichas muestran fecha, ubicacion y fuente oficial cuando existe informacion suficiente." },
    ],
    usageSteps: [
      { title: "Busca por fecha", text: "Ordena los resultados por proximidad temporal y localiza los eventos mas cercanos." },
      { title: "Abre la ficha", text: "Comprueba provincia, ciudad, disciplina y fuente oficial." },
      { title: "Explora Valencia", text: "Usa los enlaces internos para saltar a rallyes Valencia o eventos de motor en Valencia." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Comunidad Valenciana?", answer: "Pueden aparecer eventos en Valencia, Alicante y Castellon relacionados con rallyes, concentraciones, circuito, karting, ferias, clasicos y motos o coches." },
      { question: "Incluye rallyes Valencia 2026?", answer: "Si hay rallyes valencianos publicados en los datos visibles, aparecen enlazados desde esta pagina o desde la landing especifica de rallyes en Valencia." },
      { question: "Aparecen eventos de motor en Alicante y Castellon?", answer: "Si los eventos tienen ubicacion o referencias a Alicante o Castellon, se incluyen dentro de esta pagina regional." },
      { question: "Como publicar un evento en Comunidad Valenciana?", answer: "Puedes enviar la informacion oficial desde publicar evento para que se revise su inclusion." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes Valencia 2026", href: "/rallyes-valencia-2026" },
      { label: "Eventos de motor en Valencia", href: "/eventos-motor-valencia" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.comunidadValenciana),
  },
  {
    slug: "eventos-motor-galicia",
    h1: "Eventos de motor en Galicia",
    title: "Eventos de motor en Galicia | Rallyes, motos y clasicos | EventoMotor",
    description:
      "Consulta eventos de motor en Galicia: rallyes, subidas, concentraciones moteras, clasicos y eventos en A Coruna, Lugo, Ourense y Pontevedra.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Galicia con rallyes, subidas, concentraciones moteras, clasicos y planes en A Coruna, Lugo, Ourense y Pontevedra.",
    resultsTitle: "Eventos de motor en Galicia",
    layoutType: "regional",
    regionalHub: {
      regionName: "Galicia",
      title: "Eventos de motor este fin de semana en Galicia",
      description: "Seleccion regional para A Coruna, Lugo, Ourense y Pontevedra, con rallyes, subidas, concentraciones, clasicos y eventos publicados.",
      weekendTitle: "Agenda gallega del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Galicia. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por tipo",
      highlights: [
        { label: "Rallyes y subidas", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "subida", "montana", "montaña"] },
        { label: "Concentraciones moteras", href: "/disciplinas/concentraciones", terms: ["concentracion", "motoalmuerzo", "motera", "moteras", "biker"] },
        { label: "Clasicos y ferias", href: "/disciplinas/clasicos", terms: ["clasico", "clasicos", "historico", "feria", "salon"] },
        { label: "A Coruna, Lugo y Pontevedra", href: PUBLIC_NAVIGATION.calendar, terms: ["coruna", "lugo", "ourense", "orense", "pontevedra", "vigo"] },
      ],
    },
    intro:
      "Galicia cuenta con una agenda de motor muy repartida entre A Coruna, Lugo, Ourense y Pontevedra, con especial presencia de rallyes, subidas, concentraciones moteras, clasicos, rutas y eventos locales. Esta landing agrupa eventos publicados en EventoMotor vinculados a Galicia o sus provincias principales, priorizando datos estructurados de region, provincia y ciudad. Cada resultado enlaza a una ficha individual con fecha, ubicacion, disciplina, fuente oficial y enlaces disponibles cuando existen. Antes de asistir, confirma siempre horarios, inscripciones o recorrido en la comunicacion oficial del organizador.",
    editorialBlocks: [
      { title: "Rallyes y subidas", text: "Galicia tiene una escena fuerte de rallyes, montana y pruebas regionales con actividad durante la temporada." },
      { title: "Provincias gallegas", text: "La seleccion cubre A Coruna, Lugo, Ourense y Pontevedra cuando los eventos tienen ubicacion clara." },
      { title: "Eventos verificables", text: "Se muestran eventos visibles en EventoMotor con ficha individual y fuente revisable cuando esta disponible." },
    ],
    usageSteps: [
      { title: "Busca por fecha", text: "Empieza por los proximos eventos publicados y revisa provincia o ciudad." },
      { title: "Comprueba disciplina", text: "Diferencia rallyes, concentraciones, clasicos, ferias o rutas antes de planificar." },
      { title: "Confirma fuente", text: "Abre la ficha del evento y valida la informacion oficial antes de desplazarte." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Galicia?", answer: "Pueden aparecer rallyes, subidas, concentraciones moteras, clasicos, ferias, rutas y eventos de coches o motos publicados en EventoMotor." },
      { question: "Incluye rallyes gallegos?", answer: "Si los rallyes o subidas tienen ubicacion en Galicia y estan publicados en los datos visibles, aparecen en esta landing." },
      { question: "Aparecen eventos en A Coruna, Lugo, Ourense y Pontevedra?", answer: "Si el evento tiene provincia o ciudad gallega estructurada, se incluye en el listado regional." },
      { question: "Como publicar un evento gallego?", answer: "Puedes enviarlo desde publicar evento con fecha, ubicacion, disciplina y fuente oficial." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.galicia),
  },
  {
    slug: "eventos-motor-aragon",
    h1: "Eventos de motor en Aragon",
    title: "Eventos de motor en Aragon | MotorLand, rallyes y karting | EventoMotor",
    description:
      "Consulta eventos de motor en Aragon: MotorLand, Zaragoza, Huesca, Teruel, circuito, motos, karting, rallyes y clasicos.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Aragon con MotorLand, Zaragoza, Huesca, Teruel, circuito, motos, karting, rallyes y clasicos.",
    resultsTitle: "Eventos de motor en Aragon",
    layoutType: "regional",
    regionalHub: {
      regionName: "Aragon",
      title: "Eventos de motor este fin de semana en Aragon",
      description: "Seleccion regional para Zaragoza, Huesca y Teruel, con MotorLand, circuito, karting, rallyes, motos y clasicos.",
      weekendTitle: "Agenda aragonesa del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Aragon. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por zona y tipo",
      highlights: [
        { label: "MotorLand y circuito", href: "/disciplinas/circuito", terms: ["motorland", "circuito", "trackday", "tandas"] },
        { label: "Karting", href: "/disciplinas/karting", terms: ["kart", "karting", "zuera"] },
        { label: "Rallyes y rutas", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "ruta", "mototurismo"] },
        { label: "Zaragoza, Huesca y Teruel", href: PUBLIC_NAVIGATION.calendar, terms: ["zaragoza", "huesca", "teruel", "alcaniz"] },
      ],
    },
    intro:
      "Aragon combina actividad de circuito, karting, rallyes, rutas moteras, clasicos y eventos vinculados a MotorLand, Zaragoza, Huesca y Teruel. Esta pagina agrupa eventos publicados en EventoMotor que encajan con la region aragonesa o sus provincias principales. La seleccion se apoya en campos estructurados de region, provincia y ciudad para reducir falsos positivos y facilitar una busqueda territorial clara. Cada resultado enlaza a una ficha individual con fecha, ubicacion, disciplina y fuente oficial cuando existe.",
    editorialBlocks: [
      { title: "MotorLand y circuito", text: "Alcaniz y MotorLand concentran parte de la actividad de circuito, velocidad y karting vinculada a Aragon." },
      { title: "Tres provincias", text: "La landing cubre Zaragoza, Huesca y Teruel cuando la ubicacion del evento esta publicada." },
      { title: "Planes variados", text: "Puede incluir motos, coches, clasicos, rutas, rallyes, karting y eventos mixtos." },
    ],
    usageSteps: [
      { title: "Revisa ubicacion", text: "Comprueba ciudad y provincia para organizar desplazamiento." },
      { title: "Identifica el tipo", text: "Distingue circuito, karting, rallyes, rutas o concentraciones desde la ficha." },
      { title: "Valida fuente", text: "Confirma horarios, entradas o inscripciones en la fuente oficial enlazada." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Aragon?", answer: "Pueden aparecer eventos de circuito, karting, rallyes, rutas, clasicos y concentraciones en Zaragoza, Huesca o Teruel." },
      { question: "Aparecen eventos de MotorLand?", answer: "Si estan publicados con ubicacion o recinto vinculado a MotorLand, se incluyen en esta landing regional." },
      { question: "Incluye karting en Aragon?", answer: "Si hay eventos de karting publicados en Aragon, aparecen junto al resto de resultados." },
      { question: "Como publicar un evento en Aragon?", answer: "Puedes enviarlo desde publicar evento con fecha, ubicacion y fuente verificable." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Trackdays en Espana 2026", href: "/trackdays-espana-2026" },
      { label: "Karting en Espana 2026", href: "/karting-espana-2026" },
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.aragon),
  },
  {
    slug: "eventos-motor-castilla-la-mancha",
    h1: "Eventos de motor en Castilla-La Mancha",
    title: "Eventos de motor en Castilla-La Mancha | EventoMotor",
    description:
      "Consulta eventos de motor en Castilla-La Mancha: concentraciones, clasicos, rutas, rallyes, Albacete, Toledo, Ciudad Real, Cuenca y Guadalajara.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Castilla-La Mancha con concentraciones, clasicos, rutas, rallyes y citas en Albacete, Toledo, Ciudad Real, Cuenca y Guadalajara.",
    resultsTitle: "Eventos de motor en Castilla-La Mancha",
    layoutType: "regional",
    regionalHub: {
      regionName: "Castilla-La Mancha",
      title: "Eventos de motor este fin de semana en Castilla-La Mancha",
      description: "Seleccion regional para Albacete, Toledo, Ciudad Real, Cuenca y Guadalajara, con concentraciones, clasicos, rutas y rallyes.",
      weekendTitle: "Agenda regional del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Castilla-La Mancha. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por intencion",
      highlights: [
        { label: "Concentraciones", href: "/disciplinas/concentraciones", terms: ["concentracion", "motoalmuerzo", "motera", "biker"] },
        { label: "Clasicos", href: "/disciplinas/clasicos", terms: ["clasico", "clasicos", "historico", "retro"] },
        { label: "Rallyes y rutas", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "ruta", "mototurismo"] },
        { label: "Albacete y Toledo", href: PUBLIC_NAVIGATION.calendar, terms: ["albacete", "toledo", "ciudad real", "cuenca", "guadalajara"] },
      ],
    },
    intro:
      "Castilla-La Mancha reune eventos de motor repartidos entre Albacete, Toledo, Ciudad Real, Cuenca y Guadalajara, con concentraciones moteras, clasicos, rutas, rallyes, circuito y planes locales. Esta landing esta pensada para usuarios que buscan actividad regional sin recorrer todo el calendario nacional. Los resultados proceden de eventos visibles en EventoMotor y se filtran por campos estructurados de territorio. Cada card enlaza a una ficha con fecha, ciudad, provincia, disciplina, fuente oficial y enlaces disponibles.",
    editorialBlocks: [
      { title: "Agenda regional", text: "Agrupa eventos con ubicacion en Albacete, Toledo, Ciudad Real, Cuenca o Guadalajara." },
      { title: "Concentraciones y clasicos", text: "La region tiene actividad en reuniones moteras, eventos de clasicos y rutas de fin de semana." },
      { title: "Fuente verificable", text: "Cada ficha intenta enlazar a informacion oficial para confirmar detalles antes de asistir." },
    ],
    usageSteps: [
      { title: "Empieza por fecha", text: "Localiza los proximos eventos y revisa provincia o ciudad." },
      { title: "Compara planes", text: "Distingue concentraciones, clasicos, rutas, rallyes o circuito." },
      { title: "Confirma la fuente", text: "Consulta siempre la informacion oficial antes de desplazarte." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Castilla-La Mancha?", answer: "Pueden aparecer concentraciones moteras, clasicos, rutas, rallyes, circuito y otros eventos publicados en EventoMotor." },
      { question: "Incluye eventos en Albacete y Toledo?", answer: "Si los eventos tienen ubicacion estructurada en Albacete, Toledo u otra provincia de la comunidad, aparecen en esta pagina." },
      { question: "Aparecen concentraciones moteras?", answer: "Si estan publicadas con fecha y ubicacion verificable, se listan junto al resto de eventos regionales." },
      { question: "Como publicar un evento manchego?", answer: "Puedes enviarlo desde publicar evento con fuente oficial y datos de ubicacion." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.castillaLaMancha),
  },
  {
    slug: "eventos-motor-canarias",
    h1: "Eventos de motor en Canarias",
    title: "Eventos de motor en Canarias | Rallyes, motos y clasicos | EventoMotor",
    description:
      "Consulta eventos de motor en Canarias: rallyes, montana, clasicos, motos y eventos en Las Palmas y Santa Cruz de Tenerife.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Canarias con rallyes, montana, clasicos, motos y citas en Las Palmas y Santa Cruz de Tenerife.",
    resultsTitle: "Eventos de motor en Canarias",
    layoutType: "regional",
    regionalHub: {
      regionName: "Canarias",
      title: "Eventos de motor este fin de semana en Canarias",
      description: "Seleccion regional para las islas, Las Palmas y Santa Cruz de Tenerife, con rallyes, montana, clasicos, motos y eventos publicados.",
      weekendTitle: "Agenda canaria del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Canarias. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por isla y tipo",
      highlights: [
        { label: "Rallyes y montana", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "subida", "montana", "montaña"] },
        { label: "Clasicos", href: "/disciplinas/clasicos", terms: ["clasico", "clasicos", "historico", "retro"] },
        { label: "Motos y concentraciones", href: "/disciplinas/concentraciones", terms: ["moto", "motera", "concentracion", "biker"] },
        { label: "Las Palmas y Tenerife", href: PUBLIC_NAVIGATION.calendar, terms: ["las palmas", "tenerife", "gran canaria", "lanzarote"] },
      ],
    },
    intro:
      "Canarias cuenta con una escena propia de motor, con rallyes, subidas de montana, eventos de clasicos, concentraciones moteras y citas repartidas entre islas. Esta pagina agrupa eventos publicados en EventoMotor relacionados con Las Palmas, Santa Cruz de Tenerife y referencias insulares presentes en los datos. La distancia entre territorios hace especialmente util consultar fecha, isla, provincia y fuente antes de planificar asistencia. Cada resultado enlaza a una ficha individual con la informacion disponible.",
    editorialBlocks: [
      { title: "Eventos por islas", text: "La seleccion cubre eventos asociados a Las Palmas, Santa Cruz de Tenerife y otras referencias insulares." },
      { title: "Rallyes y montana", text: "Canarias tiene actividad relevante en rallyes, subidas, clasicos y eventos locales." },
      { title: "Planificacion previa", text: "Conviene confirmar ubicacion, horarios y posibles cambios en la fuente oficial antes de desplazarse." },
    ],
    usageSteps: [
      { title: "Revisa isla y provincia", text: "Comprueba si el evento esta en Las Palmas, Tenerife u otra referencia insular." },
      { title: "Abre la ficha", text: "Consulta fecha, disciplina, ciudad y fuente oficial." },
      { title: "Confirma detalles", text: "Valida horarios, inscripciones o recorridos en la comunicacion del organizador." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Canarias?", answer: "Pueden aparecer rallyes, subidas, clasicos, concentraciones moteras y eventos de coches o motos publicados en EventoMotor." },
      { question: "Incluye eventos en Las Palmas y Tenerife?", answer: "Si los datos indican Las Palmas, Santa Cruz de Tenerife u otra referencia insular, el evento puede aparecer en esta landing." },
      { question: "Aparecen rallyes canarios?", answer: "Si estan publicados con ubicacion en Canarias, se listan junto al resto de eventos regionales." },
      { question: "Como enviar un evento en Canarias?", answer: "Puedes proponerlo desde publicar evento aportando fecha, ubicacion y fuente oficial." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Clasicos", href: "/disciplinas/clasicos" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.canarias),
  },
  {
    slug: "eventos-motor-murcia",
    h1: "Eventos de motor en Murcia",
    title: "Eventos de motor en Murcia | Concentraciones, rutas y karting | EventoMotor",
    description:
      "Consulta eventos de motor en la Region de Murcia: concentraciones moteras, rutas, clasicos, karting y eventos en Murcia, Cartagena y alrededores.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Murcia con concentraciones moteras, rutas, clasicos, karting y citas en Murcia, Cartagena y alrededores.",
    resultsTitle: "Eventos de motor en Murcia",
    layoutType: "regional",
    regionalHub: {
      regionName: "Region de Murcia",
      title: "Eventos de motor este fin de semana en Murcia",
      description: "Seleccion regional para Murcia, Cartagena y alrededores, con concentraciones moteras, rutas, clasicos, karting y eventos publicados.",
      weekendTitle: "Agenda murciana del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Murcia. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por tipo",
      highlights: [
        { label: "Concentraciones moteras", href: "/disciplinas/concentraciones", terms: ["concentracion", "motoalmuerzo", "motera", "biker"] },
        { label: "Rutas", href: "/disciplinas/rutas", terms: ["ruta", "mototurismo", "touring"] },
        { label: "Karting y circuito", href: "/disciplinas/karting", terms: ["kart", "karting", "circuito", "cartagena"] },
        { label: "Clasicos", href: "/disciplinas/clasicos", terms: ["clasico", "clasicos", "historico"] },
      ],
    },
    intro:
      "La Region de Murcia concentra eventos de motor vinculados a Murcia, Cartagena y municipios cercanos, con concentraciones moteras, rutas, clasicos, karting, circuito y planes locales. Esta landing filtra eventos visibles en EventoMotor por campos estructurados de region, provincia y ciudad, manteniendo compatibilidad con aliases territoriales. Cada evento enlaza a una ficha individual con fecha, ubicacion, disciplina, fuente oficial y enlaces disponibles antes de organizar la asistencia.",
    editorialBlocks: [
      { title: "Murcia y Cartagena", text: "La pagina agrupa citas con ubicacion en Murcia, Cartagena y otras referencias regionales." },
      { title: "Motos, rutas y clasicos", text: "Puede incluir concentraciones, rutas moteras, clasicos, karting y eventos de circuito." },
      { title: "Datos revisables", text: "Cada ficha intenta llevar a la fuente oficial para confirmar horarios, inscripcion o cambios." },
    ],
    usageSteps: [
      { title: "Busca por fecha", text: "Consulta los proximos eventos publicados en la region." },
      { title: "Revisa ubicacion", text: "Comprueba ciudad, provincia y recinto antes de desplazarte." },
      { title: "Valida informacion", text: "Abre la fuente oficial enlazada cuando este disponible." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Murcia?", answer: "Pueden aparecer concentraciones moteras, rutas, clasicos, karting, circuito y otros eventos publicados en EventoMotor." },
      { question: "Incluye eventos en Cartagena?", answer: "Si los datos indican Cartagena o la Region de Murcia, el evento puede aparecer en esta landing." },
      { question: "Aparecen concentraciones moteras en Murcia?", answer: "Si estan publicadas con ubicacion y fuente suficiente, se muestran con enlace a su ficha." },
      { question: "Como publicar un evento murciano?", answer: "Puedes enviarlo desde publicar evento aportando fecha, ubicacion, disciplina y fuente oficial." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.murcia),
  },
  {
    slug: "eventos-motor-castilla-y-leon",
    h1: "Eventos de motor en Castilla y Leon",
    title: "Eventos de motor en Castilla y Leon | Rallyes, motos y clasicos | EventoMotor",
    description:
      "Consulta eventos de motor en Castilla y Leon: Leon, Valladolid, Burgos, Salamanca, Zamora, Avila, Segovia, Palencia y Soria.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Castilla y Leon con concentraciones, rallyes, clasicos y eventos moteros en sus nueve provincias.",
    resultsTitle: "Eventos de motor en Castilla y Leon",
    layoutType: "regional",
    regionalHub: {
      regionName: "Castilla y Leon",
      title: "Eventos de motor este fin de semana en Castilla y Leon",
      description: "Seleccion regional para Leon, Valladolid, Burgos, Salamanca, Zamora, Avila, Segovia, Palencia y Soria, con concentraciones, rallyes y clasicos.",
      weekendTitle: "Agenda regional del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Castilla y Leon. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por zona y tipo",
      highlights: [
        { label: "Concentraciones moteras", href: "/disciplinas/concentraciones", terms: ["concentracion", "motoalmuerzo", "motera", "biker"] },
        { label: "Rallyes y rutas", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "ruta", "mototurismo"] },
        { label: "Clasicos", href: "/disciplinas/clasicos", terms: ["clasico", "clasicos", "historico"] },
        { label: "Leon, Burgos y Valladolid", href: PUBLIC_NAVIGATION.calendar, terms: ["leon", "burgos", "valladolid", "salamanca", "zamora"] },
      ],
    },
    intro:
      "Castilla y Leon ofrece una agenda amplia de eventos de motor repartida entre Leon, Valladolid, Burgos, Salamanca, Zamora, Avila, Segovia, Palencia y Soria. Esta landing agrupa concentraciones moteras, rallyes, clasicos, rutas y eventos locales publicados en EventoMotor. La seleccion se basa en datos territoriales estructurados para facilitar una busqueda regional clara y evitar mezclar resultados de otras zonas. Cada resultado enlaza a su ficha con fecha, ciudad, provincia, disciplina y fuente oficial cuando existe.",
    editorialBlocks: [
      { title: "Nueve provincias", text: "Cubre eventos ubicados en Leon, Valladolid, Burgos, Salamanca, Zamora, Avila, Segovia, Palencia y Soria." },
      { title: "Motos y clasicos", text: "Puede reunir concentraciones, rutas moteras, clasicos, rallyes y planes mixtos." },
      { title: "Consulta verificable", text: "Las fichas enlazan a la informacion disponible para confirmar detalles antes de asistir." },
    ],
    usageSteps: [
      { title: "Revisa provincia", text: "Identifica rapidamente si el evento cae cerca de tu zona." },
      { title: "Abre el detalle", text: "Consulta fecha, ubicacion, disciplina y fuente oficial." },
      { title: "Explora relacionados", text: "Usa enlaces internos hacia concentraciones, rallyes o calendario general." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Castilla y Leon?", answer: "Pueden aparecer concentraciones moteras, rallyes, rutas, clasicos y eventos de coches o motos publicados en EventoMotor." },
      { question: "Incluye eventos en Leon, Valladolid y Burgos?", answer: "Si los datos tienen ubicacion en cualquiera de las provincias de Castilla y Leon, se incluyen en esta landing." },
      { question: "Aparecen concentraciones moteras?", answer: "Si estan publicadas con fecha, provincia y fuente suficiente, se listan junto al resto de eventos regionales." },
      { question: "Como publicar un evento en Castilla y Leon?", answer: "Puedes enviarlo desde publicar evento con fecha, ubicacion y fuente verificable." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.castillaYLeon),
  },
  {
    slug: "eventos-motor-asturias",
    h1: "Eventos de motor en Asturias",
    title: "Eventos de motor en Asturias | Rallyes, rutas y clasicos | EventoMotor",
    description:
      "Consulta eventos de motor en Asturias: rallyes, rutas moteras, concentraciones, clasicos y pruebas publicadas con ubicacion y fuente.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Asturias, con rallyes, rutas, concentraciones, clasicos y planes locales de coche y moto.",
    resultsTitle: "Eventos de motor en Asturias",
    layoutType: "regional",
    regionalHub: {
      regionName: "Asturias",
      title: "Eventos de motor este fin de semana en Asturias",
      description: "Seleccion regional para Oviedo, Gijon, Luarca, Langreo, Cangas del Narcea y otros municipios asturianos.",
      weekendTitle: "Agenda asturiana del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Asturias. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por zona y tipo",
      highlights: [
        { label: "Rallyes y rallysprint", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "rallysprint", "subida"] },
        { label: "Rutas moteras", href: "/disciplinas/rutas", terms: ["ruta", "mototurismo", "moto"] },
        { label: "Clasicos", href: "/disciplinas/clasicos", terms: ["clasico", "historico", "regularidad"] },
        { label: "Oviedo, Gijon y occidente", href: PUBLIC_NAVIGATION.calendar, terms: ["oviedo", "gijon", "luarca", "langreo", "cangas"] },
      ],
    },
    intro:
      "Asturias combina rallyes, subidas, rutas moteras, concentraciones y eventos de clasicos en un territorio muy activo para coches y motos. Esta landing agrupa eventos visibles de EventoMotor cuando los datos estructurados indican Asturias, sus ciudades o sedes reconocibles. Cada resultado enlaza a una ficha individual con fecha, ubicacion, disciplina, fuente oficial y enlaces disponibles para confirmar la asistencia.",
    editorialBlocks: [
      { title: "Rallyes y carretera", text: "La seleccion puede incluir rallyes, rallysprint, subidas y pruebas de regularidad ubicadas en Asturias." },
      { title: "Motos y rutas", text: "Tambien reune concentraciones, rutas moteras y planes locales cuando estan publicados con datos suficientes." },
      { title: "Consulta verificable", text: "Antes de desplazarte, revisa la ficha y la fuente enlazada para confirmar horarios o cambios." },
    ],
    usageSteps: [
      { title: "Filtra por fecha", text: "Localiza los proximos eventos publicados en Asturias." },
      { title: "Comprueba ciudad", text: "Revisa municipio, provincia y recinto o zona de salida." },
      { title: "Abre la ficha", text: "Consulta la fuente oficial cuando este disponible." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Asturias?", answer: "Pueden aparecer rallyes, subidas, concentraciones moteras, rutas, clasicos y otros eventos publicados con ubicacion asturiana." },
      { question: "Incluye eventos en Oviedo o Gijon?", answer: "Si el evento tiene datos de Asturias, Oviedo, Gijon u otros municipios asturianos, puede aparecer en esta pagina." },
      { question: "Aparecen rallyes asturianos?", answer: "Si estan visibles y cuentan con fecha, ubicacion y fuente suficiente, se listan junto al resto de eventos regionales." },
      { question: "Como publicar un evento en Asturias?", answer: "Puedes enviarlo desde publicar evento aportando fecha, ubicacion, disciplina y fuente oficial." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Rallysprint en Espana 2026", href: "/rallysprint-espana-2026" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.asturias),
  },
  {
    slug: "eventos-motor-cantabria",
    h1: "Eventos de motor en Cantabria",
    title: "Eventos de motor en Cantabria | Rallyes, subidas y clasicos | EventoMotor",
    description:
      "Consulta eventos de motor en Cantabria: rallyes, subidas, rutas, concentraciones, clasicos y pruebas publicadas con fuente.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Cantabria, con rallyes, subidas, clasicos, rutas y concentraciones para coches y motos.",
    resultsTitle: "Eventos de motor en Cantabria",
    layoutType: "regional",
    regionalHub: {
      regionName: "Cantabria",
      title: "Eventos de motor este fin de semana en Cantabria",
      description: "Seleccion regional para Santander, Torrelavega, Comillas, Heras, Potes y otros municipios cantabros.",
      weekendTitle: "Agenda cantabra del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Cantabria. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por zona y tipo",
      highlights: [
        { label: "Rallyes y subidas", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "subida", "montana", "montaña"] },
        { label: "Clasicos y regularidad", href: "/disciplinas/clasicos", terms: ["clasico", "historico", "regularidad"] },
        { label: "Rutas moteras", href: "/disciplinas/rutas", terms: ["ruta", "mototurismo", "moto"] },
        { label: "Santander y Torrelavega", href: PUBLIC_NAVIGATION.calendar, terms: ["santander", "torrelavega", "comillas", "potes", "heras"] },
      ],
    },
    intro:
      "Cantabria tiene una agenda de motor muy ligada a carretera, clasicos, subidas, rutas y concentraciones. Esta landing muestra eventos visibles cuando los datos territoriales apuntan a Cantabria, sus municipios o sedes reconocibles. La ficha de cada evento permite revisar fecha, ciudad, disciplina, fuente oficial y enlaces antes de organizar el desplazamiento.",
    editorialBlocks: [
      { title: "Carretera y montana", text: "Puede reunir rallyes, subidas, rallysprint y pruebas de regularidad en municipios cantabros." },
      { title: "Clasicos y motos", text: "Tambien incorpora clasicos, rutas y concentraciones cuando los datos publicados son suficientes." },
      { title: "Informacion revisable", text: "Las fichas priorizan fuente, ubicacion y fecha para confirmar cambios de ultima hora." },
    ],
    usageSteps: [
      { title: "Consulta proximas fechas", text: "Revisa los eventos publicados en Cantabria por orden temporal." },
      { title: "Mira el municipio", text: "Comprueba ciudad, provincia y zona antes de desplazarte." },
      { title: "Valida en origen", text: "Usa el enlace oficial de la ficha cuando este disponible." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Cantabria?", answer: "Pueden aparecer rallyes, subidas, clasicos, rutas moteras, concentraciones y otros eventos publicados en EventoMotor." },
      { question: "Incluye eventos cerca de Santander?", answer: "Si los datos indican Santander, Cantabria u otros municipios de la region, el evento puede mostrarse aqui." },
      { question: "Aparecen subidas de montana?", answer: "Si estan publicadas con fuente y ubicacion suficiente, se incluyen dentro de la agenda regional." },
      { question: "Como publicar un evento en Cantabria?", answer: "Puedes enviarlo desde publicar evento con fecha, ubicacion, disciplina y fuente verificable." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Clasicos", href: "/disciplinas/clasicos" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.cantabria),
  },
  {
    slug: "eventos-motor-navarra",
    h1: "Eventos de motor en Navarra",
    title: "Eventos de motor en Navarra | Circuito, rallyes y karting | EventoMotor",
    description:
      "Consulta eventos de motor en Navarra: circuito, rallyes, karting, motos, coches y pruebas publicadas con ubicacion y fuente.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Navarra, con Circuito de Navarra, rallyes, karting, motos y coches.",
    resultsTitle: "Eventos de motor en Navarra",
    layoutType: "regional",
    regionalHub: {
      regionName: "Navarra",
      title: "Eventos de motor este fin de semana en Navarra",
      description: "Seleccion regional para Pamplona, Los Arcos, Corella, Tudela, Ultzama y el Circuito de Navarra.",
      weekendTitle: "Agenda navarra del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Navarra. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por zona y tipo",
      highlights: [
        { label: "Circuito de Navarra", href: "/disciplinas/circuito", terms: ["circuito de navarra", "los arcos", "trackday", "velocidad"] },
        { label: "Rallyes", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "rallysprint", "tierra"] },
        { label: "Karting", href: "/disciplinas/karting", terms: ["kart", "karting"] },
        { label: "Pamplona y Ribera", href: PUBLIC_NAVIGATION.calendar, terms: ["pamplona", "tudela", "corella", "ultzama", "los arcos"] },
      ],
    },
    intro:
      "Navarra combina actividad de circuito, rallyes, karting y eventos moteros o de coche en sedes como Los Arcos, Pamplona, Corella o Tudela. Esta landing filtra eventos visibles de EventoMotor por region, provincia, ciudad y aliases de sede para ofrecer una agenda regional clara. Cada resultado enlaza a una ficha con los datos disponibles y la fuente para comprobar detalles antes de asistir.",
    editorialBlocks: [
      { title: "Circuito y velocidad", text: "Incluye eventos asociados al Circuito de Navarra y a disciplinas de velocidad cuando estan publicados." },
      { title: "Rallyes y karting", text: "Tambien puede reunir rallyes, pruebas de tierra, karting y actividades locales." },
      { title: "Datos estructurados", text: "La seleccion usa region, provincia, ciudad y recinto para evitar resultados de otras zonas." },
    ],
    usageSteps: [
      { title: "Revisa disciplina", text: "Distingue circuito, rally, karting, moto o coche." },
      { title: "Comprueba sede", text: "Mira si el evento se ubica en Los Arcos, Pamplona u otro municipio navarro." },
      { title: "Confirma fuente", text: "Abre el enlace oficial disponible en la ficha." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Navarra?", answer: "Pueden aparecer eventos de circuito, rallyes, karting, motos, coches y otras pruebas publicadas con ubicacion en Navarra." },
      { question: "Incluye el Circuito de Navarra?", answer: "Si los datos mencionan Circuito de Navarra, Los Arcos o Navarra, el evento puede aparecer en esta landing." },
      { question: "Aparecen rallyes en Navarra?", answer: "Si estan visibles con fecha, ubicacion y fuente suficiente, se listan junto a otros eventos regionales." },
      { question: "Como publicar un evento navarro?", answer: "Puedes enviarlo desde publicar evento aportando fecha, ciudad, disciplina y fuente oficial." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.navarra),
  },
  {
    slug: "eventos-motor-extremadura",
    h1: "Eventos de motor en Extremadura",
    title: "Eventos de motor en Extremadura | Rallyes, slalom y karting | EventoMotor",
    description:
      "Consulta eventos de motor en Extremadura: rallyes, slalom, karting, clasicos, rutas y pruebas publicadas en Badajoz y Caceres.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Extremadura, con rallyes, slalom, karting, clasicos y actividades de coche y moto.",
    resultsTitle: "Eventos de motor en Extremadura",
    layoutType: "regional",
    regionalHub: {
      regionName: "Extremadura",
      title: "Eventos de motor este fin de semana en Extremadura",
      description: "Seleccion regional para Badajoz, Caceres, Merida, Plasencia, Almendralejo y otros municipios extremenos.",
      weekendTitle: "Agenda extremena del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Extremadura. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por zona y tipo",
      highlights: [
        { label: "Rallyes y slalom", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "slalom", "rallysprint"] },
        { label: "Karting", href: "/disciplinas/karting", terms: ["kart", "karting"] },
        { label: "Clasicos", href: "/disciplinas/clasicos", terms: ["clasico", "historico", "regularidad"] },
        { label: "Badajoz y Caceres", href: PUBLIC_NAVIGATION.calendar, terms: ["badajoz", "caceres", "merida", "plasencia", "almendralejo"] },
      ],
    },
    intro:
      "Extremadura concentra pruebas de rally, slalom, karting, clasicos, rutas y eventos locales entre Badajoz, Caceres y otros municipios. Esta landing agrupa eventos visibles cuando los datos indican Extremadura o alguna de sus provincias y ciudades. Cada ficha aporta fecha, ubicacion, disciplina y fuente disponible para que puedas confirmar la informacion antes de desplazarte.",
    editorialBlocks: [
      { title: "Dos provincias", text: "Cubre eventos ubicados en Badajoz, Caceres y municipios extremenos relevantes." },
      { title: "Rallyes, slalom y karting", text: "La agenda puede reunir pruebas de carretera, habilidad, karting, clasicos y eventos mixtos." },
      { title: "Fuente y revision", text: "Las fichas intentan enlazar a una fuente oficial o verificable cuando existe." },
    ],
    usageSteps: [
      { title: "Busca por fecha", text: "Consulta los proximos eventos visibles en Extremadura." },
      { title: "Revisa provincia", text: "Distingue Badajoz, Caceres y el municipio concreto." },
      { title: "Confirma detalles", text: "Valida horarios, recorrido o inscripcion en la fuente enlazada." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Extremadura?", answer: "Pueden aparecer rallyes, slalom, karting, clasicos, rutas y otros eventos publicados con ubicacion extremeña." },
      { question: "Incluye Badajoz y Caceres?", answer: "Si los datos indican cualquiera de las dos provincias, el evento puede aparecer en esta pagina." },
      { question: "Aparecen slalom y rallyes?", answer: "Si estan publicados con fecha, ubicacion y fuente suficiente, se muestran en la agenda regional." },
      { question: "Como publicar un evento extremeno?", answer: "Puedes enviarlo desde publicar evento con fecha, municipio, disciplina y fuente verificable." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Clasicos", href: "/disciplinas/clasicos" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.extremadura),
  },
  {
    slug: "eventos-motor-baleares",
    h1: "Eventos de motor en Baleares",
    title: "Eventos de motor en Baleares | Rallyes, subidas y karting | EventoMotor",
    description:
      "Consulta eventos de motor en Baleares: rallyes, subidas, karting, concentraciones, clasicos y pruebas publicadas en las islas.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en Baleares, con rallyes, subidas, karting, concentraciones y clasicos en Mallorca, Ibiza y Menorca.",
    resultsTitle: "Eventos de motor en Baleares",
    layoutType: "regional",
    regionalHub: {
      regionName: "Baleares",
      title: "Eventos de motor este fin de semana en Baleares",
      description: "Seleccion regional para Mallorca, Palma, Ibiza, Menorca, Llucmajor, Felanitx, Inca y otros municipios.",
      weekendTitle: "Agenda balear del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en Baleares. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por isla y tipo",
      highlights: [
        { label: "Rallyes y subidas", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "subida", "pujada", "rallysprint"] },
        { label: "Karting", href: "/disciplinas/karting", terms: ["kart", "karting"] },
        { label: "Concentraciones", href: "/disciplinas/concentraciones", terms: ["concentracion", "motoalmuerzo", "motera"] },
        { label: "Mallorca, Ibiza y Menorca", href: PUBLIC_NAVIGATION.calendar, terms: ["mallorca", "palma", "ibiza", "eivissa", "menorca", "llucmajor"] },
      ],
    },
    intro:
      "Baleares tiene una agenda de motor repartida entre rallyes, subidas, karting, concentraciones, clasicos y eventos locales en Mallorca, Ibiza, Menorca y otras zonas. Esta landing normaliza referencias como Illes Balears, Baleares o Islas Baleares para agrupar eventos visibles con ubicacion insular. Desde cada ficha puedes revisar fecha, municipio, disciplina y fuente antes de organizar la asistencia.",
    editorialBlocks: [
      { title: "Islas y municipios", text: "Agrupa eventos ubicados en Mallorca, Ibiza, Menorca y municipios baleares cuando la ubicacion esta disponible." },
      { title: "Rallyes, karting y motos", text: "Puede incluir pujadas, rallysprint, karting, concentraciones y pruebas de coche o moto." },
      { title: "Datos prudentes", text: "Las fichas muestran la fuente enlazada cuando existe para confirmar detalles y cambios." },
    ],
    usageSteps: [
      { title: "Comprueba isla", text: "Revisa si el evento cae en Mallorca, Ibiza, Menorca u otra ubicacion balear." },
      { title: "Consulta fecha", text: "Ordena mentalmente la agenda por proximidad y tipo de prueba." },
      { title: "Valida fuente", text: "Abre el enlace oficial antes de desplazarte." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en Baleares?", answer: "Pueden aparecer rallyes, subidas, karting, concentraciones, clasicos y otros eventos publicados con ubicacion balear." },
      { question: "Incluye Illes Balears?", answer: "Si, la pagina normaliza Baleares, Illes Balears e Islas Baleares para agrupar los eventos." },
      { question: "Aparecen rallyes de Mallorca?", answer: "Si estan publicados con fecha, ubicacion y fuente suficiente, se muestran en esta landing." },
      { question: "Como publicar un evento en Baleares?", answer: "Puedes enviarlo desde publicar evento aportando fecha, municipio, disciplina y fuente oficial." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.baleares),
  },
  {
    slug: "eventos-motor-pais-vasco",
    h1: "Eventos de motor en País Vasco",
    title: "Eventos de motor en País Vasco | Rallysprint, rutas y clasicos | EventoMotor",
    description:
      "Consulta eventos de motor en País Vasco: rallysprint, rutas moteras, concentraciones, clasicos y pruebas en Bizkaia, Gipuzkoa y Alava.",
    eyebrow: "Eventos por region",
    lead:
      "Agenda regional de eventos de motor en País Vasco, con rallysprint, rutas, concentraciones, clasicos y eventos locales de coche y moto.",
    resultsTitle: "Eventos de motor en País Vasco",
    layoutType: "regional",
    regionalHub: {
      regionName: "País Vasco",
      title: "Eventos de motor este fin de semana en País Vasco",
      description: "Seleccion regional para Bizkaia, Gipuzkoa, Alava, Bilbao, Vitoria-Gasteiz, Donostia y otros municipios.",
      weekendTitle: "Agenda vasca del fin de semana",
      emptyText: "No hay eventos publicados para este fin de semana en País Vasco. Revisa la agenda nacional o vuelve a consultar mas adelante.",
      highlightsTitle: "Accesos rapidos por territorio y tipo",
      highlights: [
        { label: "Rallyes y rallysprint", href: "/disciplinas/rallyes", terms: ["rally", "rallye", "rallysprint", "subida"] },
        { label: "Rutas moteras", href: "/disciplinas/rutas", terms: ["ruta", "mototurismo", "moto"] },
        { label: "Clasicos", href: "/disciplinas/clasicos", terms: ["clasico", "historico", "regularidad"] },
        { label: "Bizkaia, Gipuzkoa y Alava", href: PUBLIC_NAVIGATION.calendar, terms: ["bizkaia", "vizcaya", "gipuzkoa", "guipuzcoa", "alava", "araba"] },
      ],
    },
    intro:
      "El País Vasco cuenta con una agenda de motor vinculada a rallysprint, rutas, concentraciones, clasicos y eventos locales en Bizkaia, Gipuzkoa y Alava. Esta landing agrupa eventos visibles cuando la region, provincia, ciudad o aliases como Euskadi apuntan al territorio. Cada resultado enlaza a una ficha con fecha, ubicacion, disciplina y fuente para confirmar los detalles antes de asistir.",
    editorialBlocks: [
      { title: "Tres territorios", text: "Cubre eventos ubicados en Bizkaia, Gipuzkoa, Alava o referencias territoriales equivalentes." },
      { title: "Rallysprint y rutas", text: "Puede reunir rallyes, rutas moteras, concentraciones, clasicos y actividades mixtas." },
      { title: "Fuente revisable", text: "Cada ficha intenta enlazar a informacion oficial o verificable cuando esta disponible." },
    ],
    usageSteps: [
      { title: "Busca por territorio", text: "Identifica si el evento cae en Bizkaia, Gipuzkoa o Alava." },
      { title: "Revisa disciplina", text: "Distingue rally, ruta, concentracion, clasico u otro tipo de evento." },
      { title: "Confirma informacion", text: "Comprueba la fuente enlazada antes de desplazarte." },
    ],
    faqs: [
      { question: "Que eventos de motor hay en País Vasco?", answer: "Pueden aparecer rallyes, rallysprint, rutas moteras, concentraciones, clasicos y otros eventos publicados con ubicacion vasca." },
      { question: "Incluye Euskadi?", answer: "Si, la normalizacion territorial contempla País Vasco y Euskadi." },
      { question: "Aparecen eventos en Bizkaia y Gipuzkoa?", answer: "Si los datos indican esos territorios o sus municipios, el evento puede aparecer en esta landing." },
      { question: "Como publicar un evento vasco?", answer: "Puedes enviarlo desde publicar evento con fecha, ubicacion, disciplina y fuente verificable." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes en Espana 2026", href: "/rallyes-espana-2026" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rutas moteras", href: "/disciplinas/rutas" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => matchesSeoCommunity(event, SEO_COMMUNITIES.paisVasco),
  },
  {
    slug: "rodadas-moto-2026",
    h1: "Rodadas moto 2026",
    title: "Rodadas moto 2026 | Tandas y circuito | EventoMotor",
    description:
      "Consulta rodadas moto 2026 en Espana: tandas libres, trackdays moto, cursos de conduccion en circuito y eventos con fuente oficial.",
    eyebrow: "Circuito moto",
    lead:
      "Calendario de rodadas moto 2026 con tandas libres, trackdays y cursos de conduccion en circuito publicados en EventoMotor.",
    resultsTitle: "Rodadas moto 2026 encontradas",
    intro:
      "Las rodadas moto 2026 reunen tandas libres, trackdays de moto y cursos de conduccion en circuito para motoristas que quieren rodar con seguridad y planificar fechas con antelacion. Esta pagina filtra eventos publicados en EventoMotor que combinan intencion de circuito con senales de moto, rodadas, tandas o formacion. No inventamos organizadores, precios ni horarios: solo mostramos eventos visibles en el calendario con datos suficientes para enlazar a una ficha individual. Desde cada evento puedes revisar fecha, circuito o recinto, ciudad, provincia, disciplina, fuente oficial y enlaces disponibles antes de reservar plaza o desplazarte.",
    editorialBlocks: [
      { title: "Rodadas y tandas", text: "Prioriza eventos con senales de rodadas, tandas libres, trackdays moto o cursos de conduccion." },
      { title: "En circuito", text: "La seleccion busca actividad vinculada a circuito y vehiculo moto cuando existe esa informacion." },
      { title: "Fuente oficial", text: "Las fichas enlazan a la fuente disponible para confirmar horarios, requisitos o inscripcion." },
    ],
    usageSteps: [
      { title: "Revisa la fecha", text: "Consulta proximas rodadas y compara disponibilidad por calendario." },
      { title: "Comprueba el circuito", text: "Mira recinto, ciudad y provincia antes de organizar el desplazamiento." },
      { title: "Valida inscripcion", text: "Abre la fuente oficial para confirmar plazas, requisitos y horarios." },
    ],
    faqs: [
      { question: "Donde ver rodadas moto 2026?", answer: "EventoMotor agrupa rodadas, tandas libres, trackdays y cursos de conduccion de moto publicados con fecha, ubicacion y fuente cuando existe." },
      { question: "Incluye cursos de conduccion moto en circuito?", answer: "Si, si el evento visible menciona curso de conduccion, circuito y moto, puede aparecer en esta pagina." },
      { question: "Aparecen trackdays moto?", answer: "Si, los trackdays de moto relacionados con circuito y publicados en los datos visibles se incluyen en el listado." },
      { question: "Como publicar una rodada de moto?", answer: "Puedes enviar la informacion oficial desde publicar evento para que se revise antes de publicarla." },
    ],
    relatedLinks: [
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Trackdays en Espana 2026", href: "/trackdays-espana-2026" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && matchesMotorcycleTrackdayOpportunity(event),
  },
  {
    slug: "trackdays-espana-2026",
    h1: "Trackdays en Espana 2026",
    title: "Trackdays en Espana 2026 | Tandas libres y circuito | EventoMotor",
    description:
      "Consulta trackdays en Espana 2026: tandas libres de coche y moto, circuito, cursos de conduccion, racing experience y drift day.",
    eyebrow: "Circuito 2026",
    lead:
      "Calendario de trackdays en Espana 2026 con tandas libres, circuito, cursos de conduccion, experiencias racing y drift day cuando existen.",
    resultsTitle: "Trackdays y tandas libres 2026",
    intro:
      "Los trackdays en Espana 2026 reunen tandas libres, eventos de circuito, cursos de conduccion, racing experiences y jornadas para coches o motos orientadas a rodar en pista. Esta landing filtra eventos publicados en EventoMotor relacionados con trackday, circuito, tandas libres, formacion o drift day cuando aparecen en los datos. El objetivo es ofrecer una pagina practica para usuarios que buscan calendario de circuito sin mezclarlo con todo el calendario nacional. Cada evento enlaza a una ficha individual con fecha, ubicacion, disciplina, tipo de vehiculo, fuente oficial y enlaces disponibles. Antes de reservar, revisa siempre la fuente del organizador.",
    editorialBlocks: [
      { title: "Tandas y circuito", text: "Agrupa eventos con senales de trackday, tandas libres, circuito, cursos o racing experience." },
      { title: "Coche y moto", text: "Puede incluir trackdays de coche, moto o mixtos si estan publicados en EventoMotor." },
      { title: "Datos verificables", text: "La ficha individual ayuda a confirmar fecha, recinto, fuente oficial y posibles enlaces de inscripcion." },
    ],
    usageSteps: [
      { title: "Filtra por fecha", text: "Ordena mentalmente los proximos trackdays y tandas libres disponibles." },
      { title: "Revisa vehiculo", text: "Comprueba si el evento esta orientado a coche, moto o formato mixto." },
      { title: "Confirma condiciones", text: "Consulta la fuente oficial para requisitos, horarios, plazas o inscripcion." },
    ],
    faqs: [
      { question: "Donde ver trackdays en Espana 2026?", answer: "Esta pagina reune trackdays, tandas libres y eventos de circuito publicados en EventoMotor con fecha y ubicacion." },
      { question: "Incluye trackdays de coche y moto?", answer: "Si, puede incluir eventos de coche, moto o mixtos segun el tipo de vehiculo publicado en los datos." },
      { question: "Aparecen cursos de conduccion?", answer: "Si el evento menciona curso de conduccion o formacion en circuito y esta visible, puede aparecer listado." },
      { question: "Como publicar un trackday?", answer: "Los organizadores pueden enviarlo desde publicar evento con fuente oficial y datos verificables." },
    ],
    relatedLinks: [
      { label: "Circuito", href: "/disciplinas/circuito" },
      { label: "Rodadas moto 2026", href: "/rodadas-moto-2026" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && includesAny(event, circuitTerms),
  },
  {
    slug: "karting-espana-2026",
    h1: "Karting en Espana 2026",
    title: "Karting en Espana 2026 | Campeonatos y carreras | EventoMotor",
    description:
      "Consulta karting en Espana 2026: campeonatos, carreras, endurance karting, karting de alquiler y eventos con fuente oficial.",
    eyebrow: "Karting 2026",
    lead:
      "Calendario de karting en Espana 2026 con campeonatos, carreras, endurance, karting de alquiler y eventos publicados por fecha.",
    resultsTitle: "Eventos de karting 2026",
    intro:
      "El karting en Espana 2026 incluye campeonatos, carreras sociales, pruebas endurance, karting de alquiler y eventos vinculados a circuitos o escuelas. Esta pagina filtra eventos visibles en EventoMotor con disciplina, categoria, tags o texto relacionado con karting. No anadimos pruebas manualmente ni inventamos calendarios: aparecen solo eventos existentes con informacion suficiente para enlazar a su ficha. Desde cada card puedes revisar fecha, ciudad, provincia, recinto, disciplina, fuente oficial y enlaces disponibles para ampliar informacion o confirmar inscripcion.",
    editorialBlocks: [
      { title: "Campeonatos y carreras", text: "Incluye eventos de karting competitivo, carreras sociales y citas de campeonato cuando existen en los datos." },
      { title: "Endurance y alquiler", text: "Tambien puede recoger endurance karting o karting de alquiler si estan publicados." },
      { title: "Ficha del evento", text: "Cada resultado enlaza a una ficha con fecha, ubicacion, fuente oficial y enlaces disponibles." },
    ],
    usageSteps: [
      { title: "Busca por fecha", text: "Localiza los proximos eventos de karting publicados en el calendario." },
      { title: "Revisa ubicacion", text: "Comprueba circuito, ciudad y provincia antes de organizar la asistencia." },
      { title: "Confirma fuente", text: "Abre la ficha y revisa la informacion oficial disponible." },
    ],
    faqs: [
      { question: "Donde ver karting en Espana 2026?", answer: "EventoMotor lista eventos de karting publicados con fecha, ubicacion y fuente oficial cuando existe." },
      { question: "Incluye campeonatos de karting?", answer: "Si, si el evento visible menciona campeonato, carrera o disciplina Karting, puede aparecer en esta pagina." },
      { question: "Aparece endurance karting?", answer: "Si hay eventos de endurance karting publicados en los datos, se incluyen en el listado." },
      { question: "Como publicar un evento de karting?", answer: "Puedes enviarlo desde publicar evento aportando fecha, ubicacion y fuente verificable." },
    ],
    relatedLinks: [
      { label: "Disciplina Karting", href: "/disciplinas/karting" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && includesAny(event, kartingTerms),
  },
  {
    slug: "ferias-motor-espana-2026",
    h1: "Ferias del motor en Espana 2026",
    title: "Ferias del motor en Espana 2026 | Salones y exposiciones | EventoMotor",
    description:
      "Consulta ferias del motor en Espana 2026: salones del automovil, ferias de motos, clasicos, recambios, exposiciones y motor show.",
    eyebrow: "Ferias 2026",
    lead:
      "Calendario de ferias del motor en Espana 2026 con salones, exposiciones, clasicos, recambios, motos y coches.",
    resultsTitle: "Ferias del motor 2026",
    intro:
      "Las ferias del motor en Espana 2026 reunen salones del automovil, ferias de motos, eventos de clasicos, exposiciones, ferias de recambios, muestras y motor shows orientados a aficionados, profesionales y compradores. Esta pagina filtra eventos visibles en EventoMotor relacionados con feria, salon, exposicion, recambios, clasicos o motor show. El objetivo es ofrecer una entrada clara para busquedas de ferias motor Espana 2026 sin inventar eventos ni ampliar informacion no verificada. Cada ficha permite revisar fecha, ubicacion, disciplina, fuente oficial y enlaces disponibles antes de planificar la visita.",
    editorialBlocks: [
      { title: "Salones y exposiciones", text: "Agrupa eventos relacionados con ferias, salones, exposiciones, muestras y motor shows." },
      { title: "Coches, motos y clasicos", text: "Puede incluir ferias de automovil, moto, clasicos, recambios o formatos mixtos." },
      { title: "Fuente oficial", text: "Las fichas enlazan a la fuente disponible para confirmar horarios, entradas o ubicacion." },
    ],
    usageSteps: [
      { title: "Revisa fechas", text: "Consulta las proximas ferias y salones publicados por orden temporal." },
      { title: "Comprueba ubicacion", text: "Mira ciudad, provincia y recinto antes de organizar la visita." },
      { title: "Valida entradas", text: "Abre la fuente oficial o enlace de entradas si existe en la ficha." },
    ],
    faqs: [
      { question: "Donde ver ferias del motor en Espana 2026?", answer: "Esta pagina reune ferias, salones y exposiciones del motor publicadas en EventoMotor con fecha y ubicacion." },
      { question: "Incluye salones del automovil?", answer: "Si, si el evento visible esta relacionado con salon del automovil, exposicion o feria del motor, puede aparecer listado." },
      { question: "Aparecen ferias de clasicos y recambios?", answer: "Si los datos publicados mencionan clasicos, recambios o exposicion, se incluyen cuando encajan con la busqueda." },
      { question: "Como publicar una feria del motor?", answer: "Puedes enviar la informacion oficial desde publicar evento para que se revise su publicacion." },
    ],
    relatedLinks: [
      { label: "Disciplina Ferias", href: "/disciplinas/ferias" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Calendario general", href: PUBLIC_NAVIGATION.calendar },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && matchesFairOpportunity(event),
  },

];

export const OPPORTUNITY_PAGES: OpportunityPage[] = RAW_OPPORTUNITY_PAGES.map((page) => ({
  ...page,
  relatedLinks: page.relatedLinks.map((link) => ({
    ...link,
    href: canonicalPublicHref(link.href),
  })),
  regionalHub: page.regionalHub
    ? {
        ...page.regionalHub,
        highlights: page.regionalHub.highlights.map((highlight) => ({
          ...highlight,
          href: canonicalPublicHref(highlight.href),
        })),
      }
    : undefined,
}));

export function getOpportunityPage(slug: string) {
  return OPPORTUNITY_PAGES.find((page) => page.slug === slug);
}

export function buildOpportunityMetadata(page: OpportunityPage | undefined): Metadata {
  const title = page?.title || SITE_NAME;
  const description = page?.description;
  const url = page ? `${SITE_URL}/${page.slug}` : SITE_URL;

  return {
    title: absoluteMetadataTitle(title),
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
    },
  };
}
