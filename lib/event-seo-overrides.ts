export type EventFaqItem = {
  question: string;
  answer: string;
};

export type EventSeoOverride = {
  seoTitle?: string;
  seoDescription?: string;
  faqItems?: readonly EventFaqItem[];
};

export const LA_BANEZA_EVENT_SLUG = "lxv-gran-premio-la-baneza-2026-08-07";

const EVENT_SEO_OVERRIDES = {
  [LA_BANEZA_EVENT_SLUG]: {
    seoTitle: "Gran Premio de La Bañeza 2026: programa y horarios",
    seoDescription:
      "Consulta las fechas, el programa y todos los horarios del Gran Premio de La Bañeza 2026, del 7 al 9 de agosto, con entrenamientos y carreras.",
    faqItems: [
      {
        question: "¿Cuándo es el Gran Premio de La Bañeza 2026?",
        answer:
          "El LXV Gran Premio de Velocidad Ciudad de La Bañeza se celebra del viernes 7 al domingo 9 de agosto de 2026.",
      },
      {
        question: "¿Dónde se celebra el Gran Premio de La Bañeza?",
        answer:
          "La prueba se disputa en el circuito urbano trazado por las calles de La Bañeza, en la provincia de León.",
      },
      {
        question: "¿Cuándo son los entrenamientos y las carreras?",
        answer:
          "El viernes están previstas las verificaciones y actividades complementarias, el sábado se celebran los entrenamientos cronometrados y el domingo tienen lugar los warm-up y las carreras.",
      },
      {
        question: "¿Qué categorías participan en 2026?",
        answer:
          "El programa incluye Clásicas 2T, Clásicas 4T, EuroTwins y 125GP/Moto3.",
      },
      {
        question: "¿Los horarios pueden sufrir cambios?",
        answer:
          "Sí. Al tratarse de una prueba disputada en un circuito urbano, el organizador indica que los horarios pueden modificarse por necesidades organizativas, de seguridad o por cualquier incidencia. Conviene consultar la fuente oficial antes de desplazarse.",
      },
    ],
  },
} as const satisfies Record<string, EventSeoOverride>;

export function getEventSeoOverride(slug: string | null | undefined): EventSeoOverride | undefined {
  if (!slug) return undefined;
  return EVENT_SEO_OVERRIDES[slug as keyof typeof EVENT_SEO_OVERRIDES];
}

export function buildFaqPageJsonLd(faqItems: readonly EventFaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
