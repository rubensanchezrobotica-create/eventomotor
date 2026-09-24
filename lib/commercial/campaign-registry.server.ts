import "server-only";

import type { PreviewEvent, ResolvedEventImage } from "@/components/redesign-v2/redesign-v2-model";
import { validateCommercialCampaignRegistry } from "./commercial-resolver";
import type { CommercialCampaign, CommercialSurface } from "./commercial-types";

type CommercialRuntime = {
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
};

type CommercialRegistryOptions = {
  now?: Date;
  demoEventDate?: string;
  weekendDemoEventDate?: string;
  runtime?: CommercialRuntime;
};

const DEMO_IMAGE: ResolvedEventImage = {
  src: "/images/redesign-v2/hero-eventomotor.webp",
  kind: "representative",
  alt: "Vehículo deportivo en una carretera al atardecer",
  label: "Imagen representativa",
};

export const COMMERCIAL_MANUAL_OPERATIONS = Object.freeze({
  add: "Añadir una entrada tipada a DEMO_CAMPAIGNS y mantener productionEligible=false hasta que exista un proceso de aprobación de campañas reales.",
  pause: "Cambiar status de active a paused; el resolver la descartará sin alterar resultados orgánicos.",
  schedule: "Definir startsAt/endsAt como instantes ISO-8601 UTC con startsAt anterior a endsAt.",
  target: "Elegir surface/placementId y targeting opcional por disciplina, territorio o vehículo.",
  priority: "Usar un número finito; gana la prioridad más alta y, en empate, la mayor especificidad y campaignId estable.",
  exclusivity: "Asignar exclusivityKey estable. El piloto sólo materializa un ganador por producto y placement.",
});

function madridDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function demoEvent(surface: CommercialSurface, date: string): PreviewEvent {
  const labels: Record<CommercialSurface, string> = {
    home: "DEMO MOTOR · Experiencia de conducción",
    calendar: "DEMO ORGANIZADOR · Jornada de motor",
    weekend: "DEMO WEEKEND · Encuentro del motor",
  };
  return {
    id: `demo-commercial-${surface}`,
    slug: `demo-commercial-${surface}`,
    title: labels[surface],
    championship: "Demostración comercial EventoMotor",
    discipline: "Circuito",
    start: date,
    end: date,
    venue: "Espacio Demo EventoMotor",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    tags: ["demo", "comercial"],
    vehicleType: "Coche",
    featured: false,
    imageUrl: DEMO_IMAGE.src ?? undefined,
  };
}

function sponsoredDemo(
  surface: CommercialSurface,
  demoState: "inserted" | "organic_enhanced" | "collision",
  date: string,
): CommercialCampaign {
  const placementId = {
    home: "HOME_PROMOTED_01",
    calendar: "CALENDAR_PROMOTED_01",
    weekend: "WEEKEND_PROMOTED_01",
  } as const;
  const organicEnhanced = demoState === "organic_enhanced";
  const event = demoEvent(surface, date);
  return {
    campaignId: `demo-${surface}-${demoState}`,
    creativeId: `demo-${surface}-${demoState}-creative`,
    productType: "sponsored_event",
    placementId: placementId[surface],
    surface,
    status: "active",
    startsAt: "2020-01-01T00:00:00.000Z",
    endsAt: "2099-01-01T00:00:00.000Z",
    priority: demoState === "collision" ? 110 : 100,
    exclusivityKey: `${surface}-promoted-event`,
    productionEligible: false,
    demoState,
    deliveryMode: organicEnhanced ? "organic_enhanced" : "inserted",
    eventId: organicEnhanced ? "__demo_first_visible__" : event.id,
    demoUseFirstVisibleEvent: organicEnhanced ? true : undefined,
    creative: organicEnhanced ? undefined : { event, image: DEMO_IMAGE },
  };
}

function sectionSponsorDemo(demoState: "sponsor" | "collision"): CommercialCampaign {
  return {
    campaignId: `demo-weekend-${demoState}-sponsor`,
    creativeId: `demo-weekend-${demoState}-sponsor-creative`,
    productType: "section_sponsor",
    placementId: "WEEKEND_SPONSOR_01",
    surface: "weekend",
    status: "active",
    startsAt: "2020-01-01T00:00:00.000Z",
    endsAt: "2099-01-01T00:00:00.000Z",
    priority: 120,
    exclusivityKey: "weekend-section-sponsor",
    productionEligible: false,
    demoState,
    deliveryMode: "section_sponsor",
    creative: {
      label: "Con el apoyo de",
      brandName: "DEMO WEEKEND PARTNER",
      brandLogo: "/brand/eventomotor-logo-mark-transparent.png",
      shortCopy: "Una colaboración de demostración para revisar el formato comercial de EventoMotor.",
      ctaLabel: "Conocer colaboración",
      destinationUrl: "https://www.eventomotor.com/",
    },
  };
}

function buildDemoCampaigns(now: Date, demoEventDate?: string, weekendDemoEventDate?: string): CommercialCampaign[] {
  const date = demoEventDate ?? madridDateKey(now);
  const madridNoon = new Date(`${date}T12:00:00.000Z`);
  madridNoon.setUTCDate(madridNoon.getUTCDate() + ((6 - madridNoon.getUTCDay() + 7) % 7));
  const weekendDate = weekendDemoEventDate ?? madridDateKey(madridNoon);
  return [
    sponsoredDemo("home", "inserted", date),
    sponsoredDemo("home", "organic_enhanced", date),
    sponsoredDemo("calendar", "inserted", date),
    sponsoredDemo("calendar", "organic_enhanced", date),
    sponsoredDemo("weekend", "inserted", weekendDate),
    sponsoredDemo("weekend", "organic_enhanced", weekendDate),
    sectionSponsorDemo("sponsor"),
    sponsoredDemo("weekend", "collision", weekendDate),
    sectionSponsorDemo("collision"),
  ];
}

export function getCommercialCampaignRegistry(options: CommercialRegistryOptions = {}): readonly CommercialCampaign[] {
  const runtime = options.runtime ?? { nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.VERCEL_ENV };
  if (runtime.nodeEnv !== "development" || runtime.vercelEnv === "production") return [];
  const campaigns = buildDemoCampaigns(options.now ?? new Date(), options.demoEventDate, options.weekendDemoEventDate);
  return validateCommercialCampaignRegistry(campaigns).valid ? campaigns : [];
}
