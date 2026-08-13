import type { EventItem } from "@/types/event";

export type VehicleType = "moto" | "coche" | "mixto" | "karting" | "otros";

type NullableEventFields = {
  [Key in Extract<
    keyof EventItem,
    "title" | "championship" | "discipline" | "tags" | "source" | "source_url" | "vehicle_type"
  >]?: EventItem[Key] | null;
} & {
  vehicleType?: string | null;
  sourceUrl?: string | null;
  importMethod?: string | null;
  vehicle_type?: string | null;
};

type EventLike = NullableEventFields;

export const VEHICLE_TYPE_OPTIONS: VehicleType[] = ["moto", "coche", "mixto", "karting", "otros"];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  moto: "Moto",
  coche: "Coche",
  mixto: "Mixto",
  karting: "Karting",
  otros: "Otros",
};

const VEHICLE_TYPE_ALIASES: Record<string, VehicleType> = {
  moto: "moto",
  motos: "moto",
  coche: "coche",
  coches: "coche",
  mixto: "mixto",
  mixta: "mixto",
  mixtos: "mixto",
  mixtas: "mixto",
  kart: "karting",
  karts: "karting",
  karting: "karting",
  otro: "otros",
  otra: "otros",
  otros: "otros",
  otras: "otros",
};

const MOTO_TERMS = [
  "fim",
  "fim world championship",
  "fim juniorgp",
  "fim europe",
  "fim enduro",
  "fim motocross",
  "fim trial",
  "fim supermoto",
  "fim minivelocidad",
  "fim moto",
  "rfme",
  "motogp",
  "superbike",
  "esbk",
  "motocross",
  "enduro",
  "trial",
  "supermoto",
  "supermotard",
  "minivelocidad",
  "mini velocidad",
  "drpit",
  "dr pit",
  "drpitbike",
  "dr pitbike",
  "pitbike",
  "pit bike",
  "minimotard",
  "mini motard",
  "mototurismo",
  "motociclismo",
  "moto",
  "moto-ocasion",
  "concentracionesdemotos",
  "concentracion motera",
  "concentracion de motos",
  "motos",
  "motera",
  "moteras",
  "motero",
  "moteros",
  "motoristas",
  "motoalmuerzo",
  "matinal motera",
  "ruta motera",
  "biker",
  "bikers",
  "motoclub",
  "harley",
  "vespa",
  "scooter",
  "custom",
  "tandas para motos",
  "worldsbk",
  "juniorgp",
];

const COCHE_TERMS = [
  "automovilismo",
  "gt winter series",
  "racing weekend",
  "rfeda",
  "rally",
  "rallye",
  "rallysprint",
  "drift",
  "tuning",
  "4x4",
  "coches",
  "turismos",
  "gt",
  "subida",
  "montana",
  "trackday coche",
  "todoterreno",
];

const KARTING_TERMS = ["karting", "kart"];

const MIXTO_TERMS = [
  "coches y motos clasicos",
  "coches y motos",
  "vehiculos clasicos",
  "vehiculos clasicos y tuneados",
  "coches clasicos",
  "retro matinal clasicos",
  "concentracion de vehiculos",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_‐‑‒–—−]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVehicleType(value: string | null | undefined): VehicleType | null {
  return VEHICLE_TYPE_ALIASES[normalizeText(String(value || ""))] ?? null;
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);

    if (/^[a-z0-9]+$/.test(normalizedTerm)) {
      return new RegExp(`(^|[^a-z0-9])${normalizedTerm}([^a-z0-9]|$)`).test(text);
    }

    return text.includes(normalizedTerm);
  });
}

function hasAll(text: string, terms: string[]) {
  return terms.every((term) => text.includes(term));
}

export function getVehicleType(event: EventLike): VehicleType {
  const explicitType = normalizeVehicleType(event.vehicleType || event.vehicle_type);
  const titleText = normalizeText(String(event.title || ""));
  const tagsText = normalizeText(Array.isArray(event.tags) ? event.tags.join(" ") : "");
  const sourceText = normalizeText(String(event.source || ""));
  const searchableText = normalizeText(
    [event.title, event.championship, event.discipline, event.source, tagsText]
      .filter(Boolean)
      .join(" "),
  );

  const isKarting = includesAny(searchableText, KARTING_TERMS);
  const isCanalDifusionMixed =
    sourceText.includes("canal difusion") && hasAll(tagsText, ["coches", "motos", "clasicos"]);
  const isMixto = includesAny(`${titleText} ${tagsText}`, MIXTO_TERMS) || isCanalDifusionMixed;
  const isMoto = includesAny(searchableText, MOTO_TERMS);
  const isCoche = includesAny(searchableText, COCHE_TERMS);

  if (explicitType && explicitType !== "otros") {
    return explicitType;
  }

  if (isKarting) return "karting";
  if (isMixto) return "mixto";
  if (isCoche) return "coche";
  if (isMoto) return "moto";

  return "otros";
}

export function matchesVehicleFilter(event: EventLike, filter: "todos" | "moto" | "coche") {
  if (filter === "todos") {
    return true;
  }

  const vehicleType = getVehicleType(event);

  return vehicleType === filter || vehicleType === "mixto";
}
