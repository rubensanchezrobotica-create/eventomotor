// Draft editorial only. Images are approved, but no campaign seal exists for Edition 17.
export const NEWSLETTER_EDITION_17_CAMPAIGN_KEY = "agenda_motor_2026_11_26";
export const NEWSLETTER_EDITION_17_SUBJECT = "MotoGP cierra en Cheste: drift en Jarama y montaña en Tenerife";
export const NEWSLETTER_EDITION_17_PREHEADER = "2Ruedas llega a Valencia, el Mundial se despide y EnduRoc se acerca.";
export const NEWSLETTER_EDITION_17_INTRO = "MotoGP despide la temporada en Cheste este fin de semana. También hay drift en el Jarama, dos ruedas en Feria Valencia y montaña en Tenerife. Para el siguiente fin de semana, EnduRoc ya asoma en el calendario.";

export type NewsletterEdition17Event = {
  category: string;
  title: string;
  meta: string;
  paragraphs: readonly string[];
  cta: string;
  url: string;
  image: string;
  imageAlt: string;
  utmContent: string;
};

export const NEWSLETTER_EDITION_17_EVENTS = [
  {
    category: "Evento destacado · MotoGP",
    title: "MotoGP baja el telón en Cheste",
    meta: "27–29 noviembre · Circuit Ricardo Tormo, Cheste (Valencia)",
    paragraphs: [
      "Valencia recibe la última cita del Mundial de MotoGP del 27 al 29 de noviembre. Tres días para despedir la temporada en el Circuit Ricardo Tormo. Las entradas generales están agotadas, según el propio circuito: consulta la información oficial y el plan de acceso si ya tienes entrada.",
    ],
    cta: "Ver el Gran Premio",
    url: "https://www.eventomotor.com/evento/gran-premio-motul-de-la-comunitat-valenciana-2026-11-27",
    image: "01-motogp-valencia-hero.webp",
    imageAlt: "Ilustración editorial de motos de competición en un circuito; no es una fotografía documental de MotoGP",
    utmContent: "motogp_valencia",
  },
  {
    category: "Drift · Circuito",
    title: "El Jarama se llena de derrapes",
    meta: "28–29 noviembre · Circuito de Madrid Jarama–RACE, Comunidad de Madrid",
    paragraphs: [
      "El drift pone el broche al calendario del Jarama con Challenge of the Champions. Dos jornadas de espectáculo, pista en sentido inverso, ambiente nocturno y actividades en el paddock.",
    ],
    cta: "Descubrir el evento",
    url: "https://www.eventomotor.com/evento/challenge-of-the-champions-drift-jarama-2026-11-28",
    image: "02-challenge-of-the-champions-jarama.webp",
    imageAlt: "Ilustración editorial de un coche de drift en circuito; no es una fotografía documental del evento",
    utmContent: "challenge_drift_jarama",
  },
  {
    category: "Feria · Motos y bicicletas",
    title: "Un fin de semana para vivir las dos ruedas",
    meta: "27–29 noviembre · Feria Valencia, Pabellón 7 (nivel 3)",
    paragraphs: [
      "Motos, bicicletas y movilidad eléctrica se reúnen en más de 12.000 m², con exhibiciones de stunt y trial, simuladores y zona de pruebas. La feria coincide con MotoGP: abre viernes y sábado de 11:00 a 20:00, y el domingo de 11:00 a 15:00.",
    ],
    cta: "Ver 2Ruedas",
    url: "https://www.eventomotor.com/evento/2-ruedas-valencia-2026-11-27",
    image: "03-salon-2ruedas-valencia.webp",
    imageAlt: "Ilustración editorial de motos y bicicletas en una feria; no es una fotografía documental de 2Ruedas",
    utmContent: "salon_2ruedas_valencia",
  },
  {
    category: "Montaña · Tenerife",
    title: "La montaña llama en Tenerife",
    meta: "27–28 noviembre · Güímar, Tenerife",
    paragraphs: [
      "La Subida al Mirador de Güímar reúne velocidad y regularidad en uno de los escenarios clásicos del automovilismo canario. El viernes se celebran las verificaciones y el sábado llegan los entrenamientos y las mangas de carrera.",
    ],
    cta: "Consultar la subida",
    url: "https://www.eventomotor.com/evento/subida-al-mirador-de-guimar-2026-11-28",
    image: "04-subida-mirador-guimar.webp",
    imageAlt: "Ilustración editorial de un coche en una carretera de montaña; no es una fotografía documental de la subida",
    utmContent: "subida_guimar",
  },
  {
    category: "Reserva fecha · Enduro",
    title: "Apunta la próxima: EnduRoc 2026",
    meta: "5–6 diciembre · Les Comes, Súria (Barcelona)",
    paragraphs: [
      "El 5 y 6 de diciembre, Les Comes acoge la 16.ª edición del EnduRoc, una gran cita de cierre de temporada para aficionados y pilotos de enduro.",
    ],
    cta: "Guardar la fecha",
    url: "https://www.eventomotor.com/evento/enduroc-2026-12-05",
    image: "05-enduroc-2026.webp",
    imageAlt: "Ilustración editorial de una moto de enduro; no es una fotografía documental de EnduRoc",
    utmContent: "enduroc_2026",
  },
] as const satisfies readonly NewsletterEdition17Event[];

export const NEWSLETTER_EDITION_17_PLANNED_IMAGES = [
  { file: "01-motogp-valencia-hero.webp", width: 1200, height: 675 },
  { file: "02-challenge-of-the-champions-jarama.webp", width: 800, height: 500 },
  { file: "03-salon-2ruedas-valencia.webp", width: 800, height: 500 },
  { file: "04-subida-mirador-guimar.webp", width: 800, height: 500 },
  { file: "05-enduroc-2026.webp", width: 800, height: 500 },
  { file: "06-x-trial-madrid.webp", width: 800, height: 500 },
] as const;

export function edition17TrackedUrl(url: string, utmContent: string): string {
  const tracked = new URL(url);
  tracked.searchParams.set("utm_source", "la_agenda_motor");
  tracked.searchParams.set("utm_medium", "email");
  tracked.searchParams.set("utm_campaign", NEWSLETTER_EDITION_17_CAMPAIGN_KEY);
  tracked.searchParams.set("utm_content", utmContent);
  return tracked.toString();
}
