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
  fallbackFilter?: (event: EventItem, now: Date) => boolean;
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
  return isNextWeekend(event, now);
}

function isYear(event: EventItem, year: number) {
  return eventStart(event).getFullYear() === year;
}

const rallyTerms = ["rally", "rallye", "rallysprint", "subida", "regularidad", "baja", "montaña", "montana"];
const rallysprintTerms = ["rallysprint", "rally sprint", "sprint", "villa de grado", "grado", "carreno", "carreño"];
const concentrationTerms = ["concentración", "concentracion", "motoalmuerzo", "quedada", "moteras", "motera", "biker", "custom"];
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
const motoCircuitTerms = ["moto", "motos", "motociclismo", "rodada moto", "rodadas moto", "tandas moto"];
const kartingTerms = ["karting", "kart", "endurance karting", "karting alquiler", "campeonato de karting", "carrera de karting"];
const feriaTerms = ["feria", "ferias", "salon", "salón", "automovil", "automóvil", "moto", "clasicos", "clásicos", "recambios", "exposicion", "exposición", "motor show", "expo"];

export const OPPORTUNITY_PAGES: OpportunityPage[] = [
  {
    slug: "eventos-motor-este-fin-de-semana",
    h1: "Eventos de motor este fin de semana",
    title: "Eventos de motor este fin de semana en España | EventoMotor",
    description:
      "Consulta eventos de motor este fin de semana en España: rallyes, concentraciones moteras, karting, rodadas, ferias, clásicos y circuito, con fecha, ubicación y fuente oficial.",
    eyebrow: "Busqueda popular",
    lead:
      "Consulta rallyes, concentraciones moteras, karting, rodadas, ferias, clásicos y eventos de circuito programados para este fin de semana en España.",
    resultsTitle: "Eventos de motor para este fin de semana",
    intro:
      "Si buscas eventos del motor este fin de semana, esta pagina reune planes proximos en Espana con una intencion muy concreta: encontrar algo real a lo que ir sin perder tiempo entre fuentes dispersas. Puedes consultar rallyes, concentraciones moteras, eventos de circuito, rutas, ferias, clasicos, karting y competiciones que encajan en el sabado y domingo mas cercano o en los proximos dias si el calendario esta mas justo. Cada evento enlaza a una ficha individual donde se prioriza la fecha, la ubicacion, la disciplina y la fuente oficial. Antes de desplazarte, revisa siempre la informacion del organizador, ya que horarios, inscripciones, entradas o recorridos pueden cambiar.",
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
      { question: "¿Qué eventos de motor hay este fin de semana?", answer: "Depende de los eventos publicados, pero la agenda puede incluir rallyes, concentraciones moteras, karting, rodadas, ferias, clásicos, offroad, rutas y eventos de circuito." },
      { question: "¿Dónde ver concentraciones moteras este fin de semana?", answer: "En esta página aparecen concentraciones, motoalmuerzos o quedadas moteras si están publicadas para el fin de semana. También puedes revisar la landing de concentraciones moteras 2026." },
      { question: "¿Hay rallyes este fin de semana?", answer: "Si hay rallyes, rallysprints, subidas o pruebas relacionadas publicadas para el fin de semana, se muestran en el listado y en los grupos por disciplina." },
      { question: "¿Se incluyen eventos de coches y motos?", answer: "Sí. EventoMotor puede mostrar eventos de motos, coches, mixtos, karting u otros formatos cuando están publicados con fecha y fuente verificable." },
      { question: "¿Cómo publicar un evento en EventoMotor?", answer: "Si organizas un evento de motor, puedes enviarlo desde publicar evento con fecha, ubicación, disciplina y fuente oficial para que se revise." },
    ],
    relatedLinks: [
      { label: "Calendario general", href: "/calendario" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
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
      { label: "Calendario general", href: "/calendario" },
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
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Disciplina Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Eventos de motor en Cataluña", href: "/eventos-motor-cataluna" },
      { label: "Eventos de motor en Comunidad Valenciana", href: "/eventos-motor-comunidad-valenciana" },
      { label: "Eventos de motor en Andalucía", href: "/eventos-motor-andalucia" },
      { label: "Calendario general", href: "/calendario" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) =>
      isYear(event, 2026) &&
      includesAny(event, extendedConcentrationTerms) &&
      includesAny(event, ["moto", "motera", "moteras", "biker", "custom", "concentracion", "concentración", "motoalmuerzo"]),
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
      { label: "Calendario general", href: "/calendario" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Eventos en el norte", href: "/zonas/norte" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && includesAny(event, rallyTerms),
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
      { label: "Calendario general", href: "/calendario" },
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
      { label: "Calendario general", href: "/calendario" },
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
      { label: "Calendario general", href: "/calendario" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Concentraciones moteras 2026", href: "/concentraciones-moteras-2026" },
      { label: "Rallyes en España 2026", href: "/rallyes-espana-2026" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => includesAny(event, ["madrid", "comunidad de madrid"]),
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
      { label: "Calendario general", href: "/calendario" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) =>
      includesAny(event, ["andalucia", "andalucía", "sevilla", "malaga", "málaga", "cadiz", "cádiz", "cordoba", "córdoba", "granada", "huelva", "jaen", "jaén", "almeria", "almería"]),
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
      { label: "Calendario general", href: "/calendario" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Eventos de motor en Barcelona", href: "/eventos-motor-barcelona" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => includesAny(event, ["cataluna", "cataluña", "catalunya", "barcelona", "girona", "tarragona", "lleida", "lerida", "lérida"]),
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
      { label: "Calendario general", href: "/calendario" },
      { label: "Eventos de motor este fin de semana", href: "/eventos-motor-este-fin-de-semana" },
      { label: "Rallyes Valencia 2026", href: "/rallyes-valencia-2026" },
      { label: "Eventos de motor en Valencia", href: "/eventos-motor-valencia" },
      { label: "Rallyes", href: "/disciplinas/rallyes" },
      { label: "Concentraciones", href: "/disciplinas/concentraciones" },
      { label: "Karting", href: "/disciplinas/karting" },
      { label: "Ferias del motor", href: "/disciplinas/ferias" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) =>
      includesAny(event, ["comunitat valenciana", "comunidad valenciana", "valencia", "alicante", "castellon", "castellón", "cheste", "ricardo tormo"]),
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
      { label: "Calendario general", href: "/calendario" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) =>
      isYear(event, 2026) &&
      includesAny(event, circuitTerms) &&
      includesAny(event, motoCircuitTerms),
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
      { label: "Calendario general", href: "/calendario" },
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
      { label: "Calendario general", href: "/calendario" },
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
      { label: "Calendario general", href: "/calendario" },
      { label: "Publicar evento", href: "/publicar-evento" },
    ],
    filter: (event) => isYear(event, 2026) && includesAny(event, feriaTerms),
  },

];

export function getOpportunityPage(slug: string) {
  return OPPORTUNITY_PAGES.find((page) => page.slug === slug);
}
