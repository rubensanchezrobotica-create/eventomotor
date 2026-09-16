import { PUBLIC_NAVIGATION } from "@/lib/public-navigation";

export const WEEKEND_SEO_LINKS = [
  { label: "Calendario completo", href: PUBLIC_NAVIGATION.calendar },
  { label: "Eventos en Madrid", href: "/eventos-motor-madrid" },
  { label: "Eventos en Cataluña", href: "/eventos-motor-cataluna" },
  { label: "Eventos en Comunidad Valenciana", href: "/eventos-motor-comunidad-valenciana" },
  { label: "Eventos en Andalucía", href: "/eventos-motor-andalucia" },
  { label: "Rallyes en España", href: "/rallyes-espana-2026" },
  { label: "Concentraciones moteras", href: "/concentraciones-moteras-2026" },
  { label: "Trackdays", href: "/trackdays-espana-2026" },
];

export const WEEKEND_GUIDE_PARAGRAPHS = [
  "Esta selección reúne eventos publicados para el viernes, sábado y domingo más próximo. Incluye competiciones, concentraciones, motoalmuerzos, rutas, tandas, ferias, clásicos y otros encuentros de motor.",
  "Los datos proceden de las fichas visibles en EventoMotor. Fechas, programas, inscripciones o ubicaciones pueden cambiar, por lo que recomendamos revisar la fuente oficial de cada evento antes de iniciar el desplazamiento.",
] as const;

export const WEEKEND_FAQS = [
  {
    question: "¿Qué eventos de motor hay este fin de semana?",
    answer: "La agenda reúne los eventos visibles que coinciden con el viernes, sábado o domingo más próximo, incluidos los que abarcan varios días.",
  },
  {
    question: "¿Cómo encontrar eventos por provincia?",
    answer: "Selecciona una provincia en los filtros o utiliza uno de los accesos territoriales con más actividad para actualizar el listado.",
  },
  {
    question: "¿Cuándo se actualiza la agenda?",
    answer: "La página utiliza los eventos actualmente publicados en EventoMotor. Antes de desplazarte, consulta siempre la ficha y la fuente oficial disponible.",
  },
  {
    question: "¿Cómo publicar un evento en EventoMotor?",
    answer: "Utiliza el flujo de Publicar evento. La información enviada se revisa antes de incorporarse al calendario público.",
  },
];
