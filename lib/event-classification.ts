import type { EventItem } from "@/types/event";

export type VehicleType = "moto" | "coche" | "mixto" | "karting" | "otros";

type NullableEventFields = {
  [Key in keyof Pick<EventItem, "title" | "championship" | "discipline" | "tags" | "source" | "vehicleType">]?:
    | EventItem[Key]
    | null;
};

type EventLike = NullableEventFields & {
  vehicle_type?: string | null;
};

export const VEHICLE_TYPE_OPTIONS: VehicleType[] = ["moto", "coche", "mixto", "karting", "otros"];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  moto: "Moto",
  coche: "Coche",
  mixto: "Mixto",
  karting: "Karting",
  otros: "Otros",
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
  "minivelocidad",
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
    .replace(/[\u0300-\u036f]/g, "");
}

function isVehicleType(value: string | null | undefined): value is VehicleType {
  return Boolean(value && VEHICLE_TYPE_OPTIONS.includes(value as VehicleType));
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function hasAll(text: string, terms: string[]) {
  return terms.every((term) => text.includes(term));
}

export function getVehicleType(event: EventLike): VehicleType {
  const explicitType = normalizeText(String(event.vehicleType || event.vehicle_type || "").trim());

  if (isVehicleType(explicitType)) {
    return explicitType;
  }

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

  if (isKarting) return "karting";
  if (isMixto) return "mixto";
  if (isMoto) return "moto";
  if (isCoche) return "coche";

  return "otros";
}

export function matchesVehicleFilter(event: EventLike, filter: "todos" | "moto" | "coche") {
  if (filter === "todos") {
    return true;
  }

  const vehicleType = getVehicleType(event);

  return vehicleType === filter || vehicleType === "mixto";
}
