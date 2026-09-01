import type { EventItem } from "@/types/event";

export const MOTORCYCLE_TIME_ZONE = "Europe/Madrid";

const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "cancelado", "cancelada"]);
const EXCLUDED_VEHICLES = new Set(["coche", "coches", "automovil", "automovilismo", "kart", "karting"]);
const DIRECT_MOTORCYCLE_VEHICLES = new Set([
  "moto",
  "motos",
  "motocicleta",
  "motocicletas",
  "motociclismo",
]);
const POSITIVE_MOTORCYCLE_SIGNAL = /(?:^| )(?:moto|motos|motera|moteras|motero|moteros|motocicleta|motocicletas|motociclismo|motoalmuerzo|motoalmuerzos|mototurismo|biker|bikers)(?: |$)/;
const GATHERING_DISCIPLINES = new Set([
  "concentracion",
  "concentraciones",
  "encuentro",
  "encuentros",
  "matinal",
  "matinales",
  "motoalmuerzo",
  "motoalmuerzos",
  "quedada",
  "quedadas",
  "reunion",
  "reuniones",
]);
const STRONG_GATHERING_SIGNAL = /(?:^| )(?:concentracion(?:es)?|encuentro(?:s)?|reunion(?:es)?|quedada(?:s)?|matinal(?:es)?)(?: (?:biker|bikers|motera|moteras|motero|moteros)| de (?:las )?(?:moto|motos|motocicleta|motocicletas))(?: |$)|(?:^| )(?:almuerzo motero|convivencia motera|fiesta motera|meeting biker|moto ?almuerzo(?:s)?|moto ?asado(?:s)?|moto ?encuentro(?:s)?|xuntanza motera)(?: |$)/;
const GENERIC_GATHERING_TITLE_SIGNAL = /(?:^| )(?:concentracion(?:es)?|encuentro(?:s)?|matinal(?:es)?|quedada(?:s)?|reunion(?:es)?)(?: |$)/;
const JOINT_CAR_MOTORCYCLE_GATHERING_SIGNAL = /(?:^| )(?:concentracion(?:es)?|encuentro(?:s)?|matinal(?:es)?|quedada(?:s)?|reunion(?:es)?)[^.?!]{0,80}(?:moto|motos|motocicleta|motocicletas)(?: |$)/;
const EXCLUDED_GATHERING_DISCIPLINE_SIGNAL = /(?:^| )(?:circuito|cross country|curso|enduret|enduro|entrenamiento|feria|ferias|freestyle|hard enduro|juniorgp|minivelocidad|motocross|motogp|off road|offroad|raid|rally raid|resistencia|rodada|rodadas|salon|salones|superbike|supercross|supermotard|supermoto|tanda|tandas|todo terreno|trackday|trial|velocidad)(?: |$)/;
const EXCLUDED_GATHERING_PRIMARY_SIGNAL = /(?:^| )(?:campeonato|carrera|carreras|circuito|copa|curso de conduccion|enduro|entrenamiento|escuela de pilotaje|exhibicion comercial|feria|motocross|off road|offroad|raid|racing|rodada|rodadas|salon|supercross|tanda|tandas|track ?day|trackday|trial|trofeo|velocidad)(?: |$)/;

function normalizeMotorcycleText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function optionalCategory(event: EventItem) {
  return (event as EventItem & { category?: string }).category;
}

function hasMotorcycleSignal(event: EventItem) {
  const fields = [
    event.discipline,
    event.championship,
    ...event.tags,
    event.title,
    event.shortDescription,
    event.longDescription,
  ];
  return fields.some((field) => POSITIVE_MOTORCYCLE_SIGNAL.test(normalizeMotorcycleText(field)));
}

function hasStructuredMotorcycleSignal(event: EventItem) {
  const vehicle = normalizeMotorcycleText(event.vehicleType || event.vehicle_type);
  if (DIRECT_MOTORCYCLE_VEHICLES.has(vehicle)) return true;

  return [
    event.discipline,
    event.championship,
    optionalCategory(event),
    ...event.tags,
  ].some((field) => POSITIVE_MOTORCYCLE_SIGNAL.test(normalizeMotorcycleText(field)));
}

export function isValidIsoDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function effectiveMotorcycleEventEnd(event: EventItem) {
  return isValidIsoDate(event.end) ? event.end : event.start;
}

export function madridIsoDate(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: MOTORCYCLE_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addIsoDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function isoWeekday(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function motorcycleWeekendRange(now: Date) {
  const current = madridIsoDate(now);
  const weekday = isoWeekday(current);
  const daysToFriday = weekday === 0 ? -2 : weekday === 6 ? -1 : weekday === 5 ? 0 : 5 - weekday;
  const friday = addIsoDays(current, daysToFriday);
  return { friday, sunday: addIsoDays(friday, 2) };
}

export function isMotorcycleEvent(event: EventItem) {
  if (event.visible !== true) return false;
  if (event.dataQuality === "cancelled" || event.dataQuality === "pending_date") return false;
  if (CANCELLED_STATUSES.has(normalizeMotorcycleText(event.eventStatus))) return false;
  if (!isValidIsoDate(event.start) || !event.start.startsWith("2026-")) return false;
  if (isValidIsoDate(event.end) && event.end < event.start) return false;

  const vehicle = normalizeMotorcycleText(event.vehicleType || event.vehicle_type);
  if (DIRECT_MOTORCYCLE_VEHICLES.has(vehicle)) return true;
  if (EXCLUDED_VEHICLES.has(vehicle)) return false;
  return hasMotorcycleSignal(event);
}

export function isMotorcycleGatheringEvent(event: EventItem) {
  const discipline = normalizeMotorcycleText(event.discipline);
  const title = normalizeMotorcycleText(event.title);
  const championship = normalizeMotorcycleText(event.championship);
  const category = normalizeMotorcycleText(optionalCategory(event));
  const tags = event.tags.map(normalizeMotorcycleText);
  const descriptions = [event.shortDescription, event.longDescription]
    .map(normalizeMotorcycleText)
    .filter(Boolean);

  if (GATHERING_DISCIPLINES.has(discipline)) return true;
  if (
    STRONG_GATHERING_SIGNAL.test(title)
    || JOINT_CAR_MOTORCYCLE_GATHERING_SIGNAL.test(title)
  ) return true;

  const hasExcludedPrimaryIntent = EXCLUDED_GATHERING_DISCIPLINE_SIGNAL.test(discipline)
    || EXCLUDED_GATHERING_PRIMARY_SIGNAL.test(title)
    || EXCLUDED_GATHERING_PRIMARY_SIGNAL.test(championship)
    || EXCLUDED_GATHERING_PRIMARY_SIGNAL.test(category);
  if (hasExcludedPrimaryIntent) return false;

  if (
    GENERIC_GATHERING_TITLE_SIGNAL.test(title)
    && hasStructuredMotorcycleSignal(event)
  ) return true;

  const secondaryFields = [championship, category, ...tags];
  if (secondaryFields.some((field) => STRONG_GATHERING_SIGNAL.test(field))) return true;

  return descriptions.some((field) => (
    STRONG_GATHERING_SIGNAL.test(field)
    || JOINT_CAR_MOTORCYCLE_GATHERING_SIGNAL.test(field)
  ));
}
