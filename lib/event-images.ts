type EventImageInput = {
  slug?: string | null;
  title?: string | null;
  discipline?: string | null;
  championship?: string | null;
  tags?: string[] | null;
  vehicle_type?: string | null;
  vehicleType?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
};

const FALLBACK_IMAGES = {
  rally: "/images/disciplines/eventomotor-fallback-rally.webp",
  circuito: "/images/disciplines/eventomotor-fallback-circuito.webp",
  concentracion: "/images/disciplines/eventomotor-fallback-concentracion.webp",
  offroad: "/images/disciplines/eventomotor-fallback-offroad.webp",
  clasicos: "/images/disciplines/eventomotor-fallback-clasicos.webp",
  karting: "/images/disciplines/eventomotor-fallback-karting.webp",
  drift: "/images/disciplines/eventomotor-fallback-drift.webp",
  feria: "/images/disciplines/eventomotor-fallback-feria.webp",
  ruta: "/images/disciplines/eventomotor-fallback-ruta.webp",
  general: "/images/disciplines/eventomotor-fallback-general.webp",
};

const EVENT_IMAGES_BY_SLUG: Record<string, string> = {
  "xiv-concentracion-automoviles-motocicletas-clasicas-alcoy-2026-06-21":
    "/event-images/xiv-concentracion-classic-alcoy-2026.png",
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function eventSearchText(event: EventImageInput) {
  return normalizeText(
    [
      event.title,
      event.discipline,
      event.championship,
      event.vehicle_type,
      event.vehicleType,
      ...(event.tags ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalizeText(term)));
}

export function getEventImage(event: EventImageInput): string {
  const realImage = event.image_url || event.imageUrl;

  if (realImage) {
    return realImage;
  }

  if (event.slug && EVENT_IMAGES_BY_SLUG[event.slug]) {
    return EVENT_IMAGES_BY_SLUG[event.slug];
  }

  const text = eventSearchText(event);

  if (
    includesAny(text, [
      "rally",
      "rallye",
      "rallysprint",
      "subida",
      "montaña",
      "rally tt",
      "baja",
      "eco rallye",
    ])
  ) {
    return FALLBACK_IMAGES.rally;
  }

  if (
    includesAny(text, [
      "motogp",
      "superbike",
      "velocidad",
      "trackday",
      "circuito",
      "tandas",
      "esbk",
      "gt",
      "racing weekend",
    ])
  ) {
    return FALLBACK_IMAGES.circuito;
  }

  if (
    includesAny(text, [
      "drift",
      "drifting",
      "tuning",
      "stance",
      "show car",
      "exhibición",
      "exhibicion",
      "burnout",
      "gymkhana",
    ])
  ) {
    return FALLBACK_IMAGES.drift;
  }

  if (
    includesAny(text, [
      "concentración",
      "concentracion",
      "motoalmuerzo",
      "custom",
      "bikers",
      "festival motero",
    ])
  ) {
    return FALLBACK_IMAGES.concentracion;
  }

  if (
    includesAny(text, [
      "feria",
      "salón",
      "salon",
      "expo",
      "exposición",
      "exposicion",
      "motor show",
      "motorshow",
      "festival",
      "muestra",
    ])
  ) {
    return FALLBACK_IMAGES.feria;
  }

  if (
    includesAny(text, [
      "ruta",
      "ruta motera",
      "mototurismo",
      "touring",
      "rider",
      "viaje",
      "trail touring",
      "road trip",
      "paseo motero",
    ])
  ) {
    return FALLBACK_IMAGES.ruta;
  }

  if (
    includesAny(text, [
      "motocross",
      "enduro",
      "trial",
      "offroad",
      "mx",
      "4x4",
      "overland",
      "raid",
    ])
  ) {
    return FALLBACK_IMAGES.offroad;
  }

  if (
    includesAny(text, [
      "clásicos",
      "clasicos",
      "clásicas",
      "clasicas",
      "histórico",
      "historico",
      "classic",
      "retro",
      "americanos",
    ])
  ) {
    return FALLBACK_IMAGES.clasicos;
  }

  if (includesAny(text, ["kart", "karting"])) {
    return FALLBACK_IMAGES.karting;
  }

  return FALLBACK_IMAGES.general;
}

export function getEventImageAlt(event: EventImageInput): string {
  const title = event.title ? ` para ${event.title}` : "";
  const image = getEventImage(event);

  if (image.includes("drift")) {
    return `Imagen representativa de evento de drift o tuning${title}`;
  }

  if (image.includes("feria")) {
    return `Imagen representativa de feria o salón del motor${title}`;
  }

  if (image.includes("ruta")) {
    return `Imagen representativa de ruta motera o mototurismo${title}`;
  }

  if (image.includes("rally")) {
    return `Imagen representativa de evento de rally${title}`;
  }

  if (image.includes("circuito")) {
    return `Imagen representativa de evento en circuito${title}`;
  }

  if (image.includes("concentracion")) {
    return `Imagen representativa de concentración motera${title}`;
  }

  if (image.includes("offroad")) {
    return `Imagen representativa de evento offroad${title}`;
  }

  if (image.includes("clasicos")) {
    return `Imagen representativa de evento de vehículos clásicos${title}`;
  }

  if (image.includes("karting")) {
    return `Imagen representativa de evento de karting${title}`;
  }

  return `Imagen representativa de evento de motor${title}`;
}
