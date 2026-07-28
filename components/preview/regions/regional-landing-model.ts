import type { Metadata } from "next";
import {
  normalizeZoneDiscipline,
  normalizeZoneProvince,
} from "@/components/zones/zone-preview-model";
import {
  isRegionalRegionId,
  normalizeRegionalText,
  type RegionalLandingModel,
  type RegionalRegionId,
} from "@/lib/regions/regional-landing-model";
import { REGIONAL_CONFIGS } from "@/lib/regions/regional-config";
import type { EventItem } from "@/types/event";

export * from "@/lib/regions/regional-landing-model";

const REGIONAL_FIXTURE_NOW = new Date("2026-01-01T12:00:00");

export type RegionalFixtureId =
  | "cataluna-amplia"
  | "madrid-sin-finde"
  | "madrid-sin-futuros"
  | "un-evento"
  | "dos-eventos"
  | "seis-eventos"
  | "aislamiento-territorial";

export function isRegionalPreviewId(value: string): value is RegionalRegionId {
  return isRegionalRegionId(value);
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function countBy(events: EventItem[], readLabel: (event: EventItem) => string) {
  const counts = new Map<string, { count: number; key: string; label: string }>();
  for (const event of events) {
    const label = String(readLabel(event) || "").trim().replace(/\s+/g, " ");
    const key = normalizeRegionalText(label).replace(/\s+/g, "-");
    if (!key || key === "por-confirmar") continue;
    const current = counts.get(key);
    counts.set(key, {
      count: (current?.count || 0) + 1,
      key,
      label: current?.label || label,
    });
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "es"));
}

function vehicleLabel(event: EventItem) {
  const value = String(event.vehicleType || event.vehicle_type || "").trim();
  const labels: Record<string, string> = {
    coche: "Coche",
    karting: "Karting",
    mixto: "Mixto",
    moto: "Moto",
    otros: "Otros",
  };
  return labels[normalizeRegionalText(value)] || value;
}

export function buildRegionalNoUpcomingFixture(
  model: RegionalLandingModel,
): RegionalLandingModel {
  return {
    ...model,
    disciplineCounts: [],
    finderMode: "empty",
    provinceCounts: [],
    nextThirtyDaysEvents: [],
    territorialTotal: model.pastEvents.length,
    upcomingEvents: [],
    upcomingTotal: 0,
    vehicleCounts: [],
    weekendEvents: [],
  };
}

export function regionalFixtureId(
  searchParams: Record<string, string | string[] | undefined>,
): RegionalFixtureId | null {
  const fixture = firstParam(searchParams.fixture);
  if (fixture === "sin-futuros") return "madrid-sin-futuros";
  if (
    fixture === "cataluna-amplia"
    || fixture === "madrid-sin-finde"
    || fixture === "madrid-sin-futuros"
    || fixture === "un-evento"
    || fixture === "dos-eventos"
    || fixture === "seis-eventos"
    || fixture === "aislamiento-territorial"
  ) return fixture;
  return null;
}

export function regionalFixtureNow(fixture: RegionalFixtureId | null, now: Date) {
  if (fixture === "madrid-sin-futuros") {
    return new Date("2026-07-27T12:00:00");
  }
  return fixture ? new Date(REGIONAL_FIXTURE_NOW) : now;
}

function buildRegionalSparseFixture(
  model: RegionalLandingModel,
  count: 1 | 2,
): RegionalLandingModel {
  const upcomingEvents = model.upcomingEvents.slice(0, count);
  const upcomingKeys = new Set(upcomingEvents.map((event) => event.slug || event.id));
  return {
    ...model,
    disciplineCounts: countBy(upcomingEvents, (event) => normalizeZoneDiscipline(event.discipline)),
    finderMode: "hidden",
    nextThirtyDaysEvents: model.nextThirtyDaysEvents.filter((event) => (
      upcomingKeys.has(event.slug || event.id)
    )),
    provinceCounts: countBy(upcomingEvents, (event) => normalizeZoneProvince(event.province)),
    territorialTotal: upcomingEvents.length + model.pastEvents.length,
    upcomingEvents,
    upcomingTotal: upcomingEvents.length,
    vehicleCounts: countBy(upcomingEvents, vehicleLabel),
    weekendEvents: model.weekendEvents.filter((event) => upcomingKeys.has(event.slug || event.id)),
  };
}

export function buildRegionalInventoryFixture(
  model: RegionalLandingModel,
  fixture: RegionalFixtureId | null,
): RegionalLandingModel {
  if (fixture === "madrid-sin-futuros") return buildRegionalNoUpcomingFixture(model);
  if (fixture === "madrid-sin-finde") return { ...model, weekendEvents: [] };
  if (fixture === "un-evento") return buildRegionalSparseFixture(model, 1);
  if (fixture === "dos-eventos") return buildRegionalSparseFixture(model, 2);
  if (fixture === "seis-eventos") {
    const upcomingEvents = model.upcomingEvents.slice(0, 6);
    const upcomingKeys = new Set(upcomingEvents.map((event) => event.slug || event.id));
    return {
      ...model,
      disciplineCounts: countBy(upcomingEvents, (event) => normalizeZoneDiscipline(event.discipline)),
      finderMode: "compact",
      nextThirtyDaysEvents: model.nextThirtyDaysEvents.filter((event) => (
        upcomingKeys.has(event.slug || event.id)
      )),
      provinceCounts: countBy(upcomingEvents, (event) => normalizeZoneProvince(event.province)),
      territorialTotal: upcomingEvents.length + model.pastEvents.length,
      upcomingEvents,
      upcomingTotal: upcomingEvents.length,
      vehicleCounts: countBy(upcomingEvents, vehicleLabel),
      weekendEvents: model.weekendEvents.filter((event) => upcomingKeys.has(event.slug || event.id)),
    };
  }
  return model;
}

export function isRegionalPreviewAvailable(vercelEnvironment: string | undefined) {
  return vercelEnvironment !== "production";
}

export function buildRegionalPreviewMetadata(id: string): Metadata {
  const title = isRegionalRegionId(id)
    ? `Preview regional: ${REGIONAL_CONFIGS[id].h1} | EventoMotor`
    : "Preview regional | EventoMotor";
  return {
    title: { absolute: title },
    description: "Preview aislada del diseño de inventario primero para landings regionales.",
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}
