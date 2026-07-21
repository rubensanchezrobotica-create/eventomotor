import type { NewsletterEmailPropsByKind } from "./email-types";

const PREVIEW_BASE_URL = "http://localhost:3000/preview/newsletter";

export const NEWSLETTER_FIXTURES_ARE_PREVIEW_ONLY =
  "Evento ficticio · Ubicación ficticia · Edición de preview";

export const NEWSLETTER_EMAIL_FIXTURES: NewsletterEmailPropsByKind = {
  confirmation: {
    logoUrl: "http://localhost:3000/brand/eventomotor-logo-horizontal-dark-header.png",
    confirmationUrl: `${PREVIEW_BASE_URL}#confirmacion-simulada`,
    expiresInHours: 24,
  },
  welcome: {
    logoUrl: "http://localhost:3000/brand/eventomotor-logo-horizontal-dark-header.png",
    provinceName: "Barcelona",
    eventsUrl: `${PREVIEW_BASE_URL}#proximos-eventos`,
    unsubscribeUrl: `${PREVIEW_BASE_URL}#baja-simulada`,
  },
  weekly: {
    logoUrl: "http://localhost:3000/brand/eventomotor-logo-horizontal-dark-header.png",
    editionDate: "Viernes, 24 de julio de 2026",
    provinceName: "Barcelona",
    introduction:
      "Este fin de semana reúne clásicos, carretera y circuito. Hemos preparado una selección breve con planes distintos, fechas fáciles de comparar y contexto suficiente para decidir sin recorrer decenas de páginas. Además, cada bloque te ayuda a descubrir opciones cercanas y una escapada especial.",
    featuredEvents: [
      {
        title: "Encuentro Clásicos Sierra Norte",
        category: "Clásicos",
        dateLabel: "Sábado 25 de julio",
        locationLabel: "Sierra Norte",
        summary: "Una mañana de vehículos históricos, ruta corta y exposición al aire libre.",
        href: `${PREVIEW_BASE_URL}#evento-preview-clasicos`,
      },
      {
        title: "Rallye Costa Interior",
        category: "Rallyes",
        dateLabel: "Sábado 25 y domingo 26",
        locationLabel: "Comarca del Interior",
        summary: "Dos jornadas y varios tramos para seguir una prueba con ritmo y variedad.",
        href: `${PREVIEW_BASE_URL}#evento-preview-rallye`,
      },
      {
        title: "Ruta Moto Valles del Este",
        category: "Motos",
        dateLabel: "Domingo 26 de julio",
        locationLabel: "Valles del Este",
        summary: "Una propuesta de carretera tranquila, parada gastronómica y regreso antes de la tarde.",
        href: `${PREVIEW_BASE_URL}#evento-preview-ruta`,
      },
    ],
    nearbyEvents: [
      {
        title: "Concentración Moto Puerto",
        category: "Concentraciones",
        dateLabel: "Sábado 25",
        locationLabel: "Barcelona",
        summary: "Encuentro matinal cerca de tu provincia seleccionada.",
        href: `${PREVIEW_BASE_URL}#evento-preview-puerto`,
      },
      {
        title: "Jornada Karting Familiar",
        category: "Karting",
        dateLabel: "Domingo 26",
        locationLabel: "Barcelona",
        summary: "Actividad de iniciación para disfrutar del karting en familia.",
        href: `${PREVIEW_BASE_URL}#evento-preview-karting`,
      },
    ],
    travelEvent: {
      title: "Festival Histórico Circuito del Sur",
      category: "Merece el viaje",
      dateLabel: "1 y 2 de agosto",
      locationLabel: "Circuito del Sur",
      summary: "Exhibiciones, paddock clásico y dos días de programación en un destino pensado para una escapada.",
      href: `${PREVIEW_BASE_URL}#evento-preview-viaje`,
    },
    recentlyAdded: [
      {
        title: "Feria del Vehículo Clásico Atlántico",
        category: "Feria",
        dateLabel: "8 de agosto",
        locationLabel: "Recinto Atlántico",
        summary: "Una cita recién incorporada a la agenda.",
        href: `${PREVIEW_BASE_URL}#evento-preview-feria`,
      },
      {
        title: "Trackday de Iniciación",
        category: "Circuito",
        dateLabel: "9 de agosto",
        locationLabel: "Trazado Escuela",
        summary: "Una jornada pensada para iniciarse en circuito.",
        href: `${PREVIEW_BASE_URL}#evento-preview-trackday`,
      },
    ],
    agendaUrl: `${PREVIEW_BASE_URL}#agenda-completa-simulada`,
    unsubscribeUrl: `${PREVIEW_BASE_URL}#baja-simulada`,
  },
};
