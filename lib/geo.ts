import { parseDate } from "@/lib/date-utils";
import type { EventItem } from "@/types/event";

export type UserLocation = {
  lat: number;
  lng: number;
};

type Coordinates = UserLocation;

const PROVINCE_COORDINATES: Record<string, Coordinates> = {
  acoruna: { lat: 43.3623, lng: -8.4115 },
  alava: { lat: 42.8467, lng: -2.6727 },
  albacete: { lat: 38.9943, lng: -1.8585 },
  alicante: { lat: 38.3452, lng: -0.481 },
  almeria: { lat: 36.834, lng: -2.4637 },
  asturias: { lat: 43.3619, lng: -5.8494 },
  avila: { lat: 40.6565, lng: -4.6818 },
  badajoz: { lat: 38.8794, lng: -6.9707 },
  baleares: { lat: 39.5696, lng: 2.6502 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  burgos: { lat: 42.3439, lng: -3.6969 },
  caceres: { lat: 39.4753, lng: -6.3724 },
  cadiz: { lat: 36.5271, lng: -6.2886 },
  cantabria: { lat: 43.4623, lng: -3.8099 },
  castellon: { lat: 39.9864, lng: -0.0513 },
  ceuta: { lat: 35.8894, lng: -5.3213 },
  ciudadreal: { lat: 38.9861, lng: -3.9273 },
  cordoba: { lat: 37.8882, lng: -4.7794 },
  cuenca: { lat: 40.0704, lng: -2.1374 },
  girona: { lat: 41.9794, lng: 2.8214 },
  granada: { lat: 37.1773, lng: -3.5986 },
  guadalajara: { lat: 40.6333, lng: -3.1667 },
  gipuzkoa: { lat: 43.3183, lng: -1.9812 },
  huelva: { lat: 37.2614, lng: -6.9447 },
  huesca: { lat: 42.1401, lng: -0.4089 },
  jaen: { lat: 37.7796, lng: -3.7849 },
  larioja: { lat: 42.465, lng: -2.4456 },
  laspalmas: { lat: 28.1235, lng: -15.4363 },
  leon: { lat: 42.5987, lng: -5.5671 },
  lleida: { lat: 41.6176, lng: 0.62 },
  lugo: { lat: 43.0097, lng: -7.5568 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  malaga: { lat: 36.7213, lng: -4.4214 },
  melilla: { lat: 35.2923, lng: -2.9381 },
  murcia: { lat: 37.9922, lng: -1.1307 },
  navarra: { lat: 42.8125, lng: -1.6458 },
  ourense: { lat: 42.3358, lng: -7.8639 },
  palencia: { lat: 42.0097, lng: -4.5288 },
  pontevedra: { lat: 42.431, lng: -8.6444 },
  salamanca: { lat: 40.9701, lng: -5.6635 },
  santacruztenerife: { lat: 28.4636, lng: -16.2518 },
  segovia: { lat: 40.9429, lng: -4.1088 },
  sevilla: { lat: 37.3891, lng: -5.9845 },
  soria: { lat: 41.7666, lng: -2.479 },
  tarragona: { lat: 41.1189, lng: 1.2445 },
  teruel: { lat: 40.3456, lng: -1.1065 },
  toledo: { lat: 39.8628, lng: -4.0273 },
  valencia: { lat: 39.4699, lng: -0.3763 },
  valladolid: { lat: 41.6523, lng: -4.7245 },
  vizcaya: { lat: 43.263, lng: -2.935 },
  zamora: { lat: 41.5035, lng: -5.7446 },
  zaragoza: { lat: 41.6488, lng: -0.8891 },
};

const PROVINCE_ALIASES: Record<string, string> = {
  "a-coruna": "acoruna",
  "a-coruna-la-coruna": "acoruna",
  "alava-araba": "alava",
  "araba": "alava",
  "balears": "baleares",
  "illes-balears": "baleares",
  "castello": "castellon",
  "castellon-castello": "castellon",
  "ciudad-real": "ciudadreal",
  "girona-gerona": "girona",
  "gerona": "girona",
  "guipuzcoa": "gipuzkoa",
  "la-rioja": "larioja",
  "las-palmas": "laspalmas",
  "lleida-lerida": "lleida",
  "lerida": "lleida",
  "santa-cruz-de-tenerife": "santacruztenerife",
  "valencia-valencia": "valencia",
  "bizkaia": "vizcaya",
};

function normalizeProvince(province: string) {
  const normalized = province
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return PROVINCE_ALIASES[normalized] || normalized.replace(/-/g, "");
}

function getEventCoordinates(event: EventItem) {
  const eventWithCoordinates = event as EventItem & {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  const directLat = eventWithCoordinates.lat ?? eventWithCoordinates.latitude;
  const directLng = eventWithCoordinates.lng ?? eventWithCoordinates.longitude;

  if (typeof directLat === "number" && typeof directLng === "number") {
    return { lat: directLat, lng: directLng };
  }

  return getProvinceCoordinates(event.province);
}

export function getProvinceCoordinates(province: string) {
  return PROVINCE_COORDINATES[normalizeProvince(province)] || null;
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

export function getEventDistanceKm(event: EventItem, userLocation: UserLocation) {
  const coordinates = getEventCoordinates(event);

  if (!coordinates) {
    return null;
  }

  return calculateDistanceKm(userLocation.lat, userLocation.lng, coordinates.lat, coordinates.lng);
}

export function sortEventsByDistance(events: EventItem[], userLocation: UserLocation) {
  return [...events].sort((left, right) => {
    const leftDistance = getEventDistanceKm(left, userLocation);
    const rightDistance = getEventDistanceKm(right, userLocation);

    if (leftDistance !== null && rightDistance !== null) {
      return leftDistance - rightDistance || parseDate(left.start).getTime() - parseDate(right.start).getTime();
    }

    if (leftDistance !== null) {
      return -1;
    }

    if (rightDistance !== null) {
      return 1;
    }

    return parseDate(left.start).getTime() - parseDate(right.start).getTime();
  });
}
