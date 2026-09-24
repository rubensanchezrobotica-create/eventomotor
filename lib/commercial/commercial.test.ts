import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PreviewEvent, ResolvedEventImage } from "@/components/redesign-v2/redesign-v2-model";
import { getCommercialCampaignRegistry, COMMERCIAL_MANUAL_OPERATIONS } from "./campaign-registry.server";
import {
  buildCommercialSequence,
  commercialAnalyticsParams,
  commercialImpressionDedupeKey,
  COMMERCIAL_IMPRESSION_DURATION_MS,
  COMMERCIAL_IMPRESSION_THRESHOLD,
  COMMERCIAL_SLOTS,
  eventMatchesCommercialFilters,
  preserveCommercialDemoState,
  readCommercialDemoState,
  resolveCommercialPlacement,
  shouldRecordCommercialImpression,
  validateCommercialCampaignRegistry,
  WEEKEND_COLLISION_STRATEGY,
} from "./commercial-resolver";
import type {
  CommercialResolutionContext,
  SectionSponsorCampaign,
  SponsoredEventCampaign,
} from "./commercial-types";

const NOW = "2026-09-24T10:00:00.000Z";
const IMAGE: ResolvedEventImage = {
  src: "/images/redesign-v2/hero-eventomotor.webp",
  kind: "representative",
  alt: "Imagen de demostración",
  label: "Imagen representativa",
};

function event(id: string, overrides: Partial<PreviewEvent> = {}): PreviewEvent {
  return {
    id,
    slug: id,
    title: `Evento ${id}`,
    championship: "Campeonato demo",
    discipline: "Circuito",
    start: "2026-09-24",
    end: "2026-09-24",
    venue: "Circuito Demo",
    city: "Madrid",
    province: "Madrid",
    region: "Comunidad de Madrid",
    tags: ["demo"],
    vehicleType: "Coche",
    featured: false,
    ...overrides,
  };
}

function sponsored(overrides: Partial<SponsoredEventCampaign> = {}): SponsoredEventCampaign {
  const creativeEvent = event("paid-event");
  return {
    campaignId: "campaign-sponsored",
    creativeId: "creative-sponsored",
    productType: "sponsored_event",
    placementId: "HOME_PROMOTED_01",
    surface: "home",
    status: "active",
    startsAt: "2026-09-01T00:00:00.000Z",
    endsAt: "2026-10-01T00:00:00.000Z",
    priority: 10,
    exclusivityKey: "home-promoted",
    productionEligible: false,
    demoState: "inserted",
    deliveryMode: "inserted",
    eventId: creativeEvent.id,
    creative: { event: creativeEvent, image: IMAGE },
    ...overrides,
  };
}

function sponsor(overrides: Partial<SectionSponsorCampaign> = {}): SectionSponsorCampaign {
  return {
    campaignId: "campaign-sponsor",
    creativeId: "creative-sponsor",
    productType: "section_sponsor",
    placementId: "WEEKEND_SPONSOR_01",
    surface: "weekend",
    status: "active",
    startsAt: "2026-09-01T00:00:00.000Z",
    endsAt: "2026-10-01T00:00:00.000Z",
    priority: 20,
    exclusivityKey: "weekend-sponsor",
    productionEligible: false,
    demoState: "collision",
    deliveryMode: "section_sponsor",
    creative: {
      label: "Con el apoyo de",
      brandName: "DEMO PARTNER",
      brandLogo: "/brand/eventomotor-logo-mark-transparent.png",
      shortCopy: "Contenido de demostración.",
      ctaLabel: "Conocer colaboración",
      destinationUrl: "https://www.eventomotor.com/",
    },
    ...overrides,
  };
}

function context(overrides: Partial<CommercialResolutionContext> = {}): CommercialResolutionContext {
  return {
    surface: "home",
    nowIso: NOW,
    demoState: "inserted",
    visibleEvents: [event("a"), event("b"), event("c"), event("d"), event("e"), event("f")],
    ...overrides,
  };
}

test("el registro manual es server-only, sintético, válido y queda vacío en producción", () => {
  const development = getCommercialCampaignRegistry({ now: new Date(NOW), runtime: { nodeEnv: "development", vercelEnv: undefined } });
  const production = getCommercialCampaignRegistry({ now: new Date(NOW), runtime: { nodeEnv: "production", vercelEnv: "production" } });
  assert.equal(development.length, 9);
  assert.equal(validateCommercialCampaignRegistry(development).valid, true);
  assert.equal(development.every((campaign) => campaign.productionEligible === false), true);
  assert.equal(development.every((campaign) => campaign.campaignId.startsWith("demo-")), true);
  assert.deepEqual(production, []);
  assert.match(COMMERCIAL_MANUAL_OPERATIONS.pause, /paused/);
  assert.match(COMMERCIAL_MANUAL_OPERATIONS.schedule, /ISO-8601 UTC/);
  assert.match(COMMERCIAL_MANUAL_OPERATIONS.exclusivity, /exclusivityKey/);
});

test("la validación falla cerrado ante identidad, rango, destino o duplicados inválidos", () => {
  const valid = sponsored();
  const invalid = { ...sponsored({ campaignId: valid.campaignId }), priority: Number.NaN };
  const validation = validateCommercialCampaignRegistry([valid, invalid]);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /invalid_priority/);
  assert.match(validation.errors.join(" "), /duplicate_campaign_id/);
  assert.equal(resolveCommercialPlacement([valid, invalid], context()).sponsoredEvent, null);
  const invalidSponsor = sponsor({ creative: { ...sponsor().creative, destinationUrl: "javascript:alert(1)" } });
  assert.equal(validateCommercialCampaignRegistry([invalidSponsor]).valid, false);
});

test("status y ventana temporal gobiernan elegibilidad sin azar", () => {
  assert.equal(resolveCommercialPlacement([sponsored({ status: "paused" })], context()).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([sponsored({ startsAt: "2026-09-25T00:00:00.000Z" })], context()).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([sponsored({ endsAt: "2026-09-24T09:59:00.000Z" })], context()).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([sponsored()], context()).sponsoredEvent?.campaign.campaignId, "campaign-sponsored");
});

test("surface y contexto rechazan campañas incompatibles", () => {
  const campaign = sponsored({
    targeting: { disciplines: ["Circuito"], territories: ["Madrid"], vehicles: ["Coche"] },
  });
  assert.equal(resolveCommercialPlacement([campaign], context({ surface: "calendar" })).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([campaign], context({ filters: { discipline: "Rally" } })).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([campaign], context({ filters: { territory: "Barcelona" } })).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([campaign], context({ filters: { vehicle: "Moto" } })).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([campaign], context({ filters: { selectedDate: "2026-09-25" } })).sponsoredEvent, null);
  assert.equal(resolveCommercialPlacement([campaign], context({ filters: { dateFrom: "2026-09-25", dateTo: "2026-09-27" } })).sponsoredEvent, null);
  assert.equal(eventMatchesCommercialFilters(campaign.creative!.event, { query: "Madrid", selectedDate: "2026-09-24" }), true);
});

test("prioridad, especificidad y campaign_id producen un único ganador determinista", () => {
  const low = sponsored({ campaignId: "z-low", creativeId: "z-low-creative", priority: 1 });
  const high = sponsored({ campaignId: "z-high", creativeId: "z-high-creative", priority: 2 });
  assert.equal(resolveCommercialPlacement([low, high], context()).sponsoredEvent?.campaign.campaignId, "z-high");
  const generic = sponsored({ campaignId: "z-generic", creativeId: "z-generic-creative" });
  const specific = sponsored({ campaignId: "z-specific", creativeId: "z-specific-creative", targeting: { disciplines: ["Circuito"] } });
  assert.equal(resolveCommercialPlacement([generic, specific], context()).sponsoredEvent?.campaign.campaignId, "z-specific");
  const alpha = sponsored({ campaignId: "a-campaign", creativeId: "a-creative" });
  const beta = sponsored({ campaignId: "b-campaign", creativeId: "b-creative" });
  assert.equal(resolveCommercialPlacement([beta, alpha], context()).sponsoredEvent?.campaign.campaignId, "a-campaign");
});

test("inserted es aditivo, preserva secuencia y respeta slots por superficie/breakpoint", () => {
  const placement = resolveCommercialPlacement([sponsored()], context()).sponsoredEvent;
  assert.ok(placement);
  const desktop = buildCommercialSequence(context().visibleEvents, placement, "desktop");
  const mobile = buildCommercialSequence(context().visibleEvents, placement, "mobile");
  assert.deepEqual(desktop.map((item) => item.kind === "organic" ? item.event.id : "paid"), ["a", "b", "c", "paid", "d", "e", "f"]);
  assert.deepEqual(mobile.map((item) => item.kind === "organic" ? item.event.id : "paid"), ["a", "b", "paid", "c", "d", "e", "f"]);
  assert.deepEqual(desktop.filter((item) => item.kind === "organic").map((item) => item.event.id), ["a", "b", "c", "d", "e", "f"]);
  assert.equal(COMMERCIAL_SLOTS.home.insertAfter.desktop, 3);
  assert.equal(COMMERCIAL_SLOTS.home.insertAfter.mobile, 2);
  assert.equal(COMMERCIAL_SLOTS.calendar.insertAfter.desktop, 3);
  assert.equal(COMMERCIAL_SLOTS.calendar.insertAfter.mobile, 3);
  assert.equal(COMMERCIAL_SLOTS.weekend.insertAfter.desktop, 3);
  assert.equal(COMMERCIAL_SLOTS.weekend.insertAfter.mobile, 2);
});

test("organic_enhanced conserva posición, longitud y ranking exactos", () => {
  const campaign = sponsored({
    deliveryMode: "organic_enhanced",
    demoState: "organic_enhanced",
    eventId: "b",
    creative: undefined,
  });
  const organicContext = context({ demoState: "organic_enhanced" });
  const placement = resolveCommercialPlacement([campaign], organicContext).sponsoredEvent;
  assert.equal(placement?.eventId, "b");
  const sequence = buildCommercialSequence(organicContext.visibleEvents, placement, "mobile");
  assert.equal(sequence.length, organicContext.visibleEvents.length);
  assert.deepEqual(sequence.map((item) => item.kind === "organic" ? item.event.id : "paid"), ["a", "b", "c", "d", "e", "f"]);
  assert.equal(sequence.findIndex((item) => item.kind === "organic" && item.enhanced), 1);
});

test("event_id visible bloquea inserted y event_id ausente bloquea organic_enhanced", () => {
  const duplicate = sponsored({ eventId: "b", creative: { event: event("b"), image: IMAGE } });
  assert.equal(resolveCommercialPlacement([duplicate], context()).sponsoredEvent, null);
  const missing = sponsored({ deliveryMode: "organic_enhanced", demoState: "organic_enhanced", eventId: "not-visible", creative: undefined });
  assert.equal(resolveCommercialPlacement([missing], context({ demoState: "organic_enhanced" })).sponsoredEvent, null);
});

test("Weekend sponsor conserva primera posición y difiere promoted al siguiente slot seguro", () => {
  const promoted = sponsored({
    campaignId: "weekend-promoted",
    creativeId: "weekend-promoted-creative",
    placementId: "WEEKEND_PROMOTED_01",
    surface: "weekend",
    demoState: "collision",
  });
  const weekendContext = context({ surface: "weekend", demoState: "collision" });
  const resolution = resolveCommercialPlacement([promoted, sponsor()], weekendContext);
  assert.equal(resolution.sectionSponsor?.placementId, "WEEKEND_SPONSOR_01");
  assert.equal(resolution.sponsoredEvent?.deferred, true);
  assert.deepEqual(resolution.sponsoredEvent?.insertAfter, { desktop: 6, mobile: 4 });
  assert.equal(WEEKEND_COLLISION_STRATEGY, "DEFER_IF_SAFE_ELSE_SUPPRESS");
  const mobile = buildCommercialSequence(weekendContext.visibleEvents, resolution.sponsoredEvent, "mobile");
  assert.equal(mobile[4].kind, "inserted");
  const short = buildCommercialSequence(weekendContext.visibleEvents.slice(0, 3), resolution.sponsoredEvent, "mobile");
  assert.equal(short.some((item) => item.kind === "inserted"), false);
});

test("sin campañas no cambia secuencia, totales ni tamaño orgánico", () => {
  const organic = context().visibleEvents;
  const resolution = resolveCommercialPlacement([], context());
  const sequence = buildCommercialSequence(organic, resolution.sponsoredEvent, "desktop");
  assert.equal(resolution.sectionSponsor, null);
  assert.equal(sequence.length, organic.length);
  assert.deepEqual(sequence.map((item) => item.kind === "organic" ? item.event.id : "paid"), organic.map((item) => item.id));
});

test("el contrato de impresión exige 50 %, 1000 ms, documento visible y deduplicación", () => {
  assert.equal(COMMERCIAL_IMPRESSION_THRESHOLD, 0.5);
  assert.equal(COMMERCIAL_IMPRESSION_DURATION_MS, 1_000);
  assert.equal(shouldRecordCommercialImpression({ intersectionRatio: 0.49, visibleDurationMs: 1_000, documentVisible: true, alreadyRecorded: false }), false);
  assert.equal(shouldRecordCommercialImpression({ intersectionRatio: 0.5, visibleDurationMs: 999, documentVisible: true, alreadyRecorded: false }), false);
  assert.equal(shouldRecordCommercialImpression({ intersectionRatio: 0.5, visibleDurationMs: 1_000, documentVisible: false, alreadyRecorded: false }), false);
  assert.equal(shouldRecordCommercialImpression({ intersectionRatio: 0.5, visibleDurationMs: 1_000, documentVisible: true, alreadyRecorded: true }), false);
  assert.equal(shouldRecordCommercialImpression({ intersectionRatio: 0.5, visibleDurationMs: 1_000, documentVisible: true, alreadyRecorded: false }), true);
});

test("analytics comercial incluye delivery_mode y deduplica por página sin identificador persistente", () => {
  const params = commercialAnalyticsParams({
    campaignId: "campaign",
    placementId: "HOME_PROMOTED_01",
    creativeId: "creative",
    surface: "home",
    productType: "sponsored_event",
    deliveryMode: "inserted",
  });
  assert.deepEqual(params, {
    campaign_id: "campaign",
    placement_id: "HOME_PROMOTED_01",
    creative_id: "creative",
    surface: "home",
    product_type: "sponsored_event",
    delivery_mode: "inserted",
  });
  assert.equal(commercialImpressionDedupeKey({ campaignId: "campaign", placementId: "HOME_PROMOTED_01", creativeId: "creative", surface: "home", productType: "sponsored_event", deliveryMode: "inserted" }, "page-a"), "campaign:HOME_PROMOTED_01:creative:page-a");
});

test("la activación QA es explícita y no acepta estado implícito", () => {
  assert.equal(readCommercialDemoState(new URLSearchParams("commercial_demo=inserted")), "inserted");
  assert.equal(readCommercialDemoState(new URLSearchParams()), "");
  assert.equal(preserveCommercialDemoState("view=list", "inserted", true), "view=list&commercial_demo=inserted");
  assert.equal(preserveCommercialDemoState("view=list", "inserted", false), "view=list");
});

test("los componentes usan consentimiento existente, eventos separados y composición controlada", () => {
  const component = readFileSync(new URL("../../components/redesign-v2/commercial/CommercialPlacement.client.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../components/redesign-v2/commercial/CommercialPlacement.module.css", import.meta.url), "utf8");
  assert.match(component, /hasAnalyticsConsent\(\)/);
  assert.match(component, /trackEvent\("commercial_impression"/);
  assert.match(component, /trackEvent\("commercial_click"/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(component, /localStorage|sessionStorage/);
  assert.match(component, /brandName/);
  assert.match(component, /shortCopy/);
  assert.match(component, /destinationUrl/);
  assert.match(styles, /\.sectionSponsor/);
});

test("Home reserva la zona de fecha y coloca Promocionado dentro del contenido", () => {
  const component = readFileSync(new URL("../../components/redesign-v2/commercial/CommercialPlacement.client.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../components/redesign-v2/commercial/CommercialPlacement.module.css", import.meta.url), "utf8");
  const eventCard = readFileSync(new URL("../../components/redesign-v2/EventCard.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../../components/redesign-v2/SearchExperience.client.tsx", import.meta.url), "utf8");
  const contentLabelStyles = styles.match(/\.promotedLabelContent\s*\{([^}]*)\}/)?.[1] ?? "";
  const bodyIndex = eventCard.indexOf("<div className={styles.eventCardBody}>");
  const commercialLabelIndex = eventCard.indexOf("{commercialLabel}", bodyIndex);
  const metadataIndex = eventCard.indexOf("<div className={styles.eventMetaLine}>", bodyIndex);

  assert.match(component, /labelLocation: "content"/);
  assert.match(component, /labelLocation: "overlay"/);
  assert.match(component, /data-commercial-label-location/);
  assert.match(styles, /\.promotedLabelContent/);
  assert.doesNotMatch(contentLabelStyles, /position:\s*absolute/);
  assert.match(eventCard, /commercialLabel\?: ReactNode/);
  assert.match(eventCard, /styles\.dateBlock/);
  assert.match(eventCard, /styles\.imageLabel/);
  assert.match(eventCard, /styles\.eventSaveAction/);
  assert.ok(bodyIndex >= 0 && commercialLabelIndex > bodyIndex && metadataIndex > commercialLabelIndex);
  assert.equal(home.match(/labelLocation="content"/g)?.length, 2);
  assert.equal(home.match(/commercialLabel=\{commercialLabel\}/g)?.length, 2);
  assert.doesNotMatch(home, /labelLocation="overlay"/);
});

test("Calendar usa el slot seguro, Weekend conserva su overlay y el sponsor móvil usa CTA secundaria", () => {
  const calendar = readFileSync(new URL("../../components/redesign-v2/calendar/CalendarPageExperience.client.tsx", import.meta.url), "utf8");
  const calendarRow = readFileSync(new URL("../../components/redesign-v2/calendar/CalendarEventRow.tsx", import.meta.url), "utf8");
  const weekend = readFileSync(new URL("../../components/redesign-v2/weekend/WeekendPageExperience.client.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../components/redesign-v2/commercial/CommercialPlacement.module.css", import.meta.url), "utf8");
  const mobile = styles.match(/@media \(max-width: 700px\) \{([\s\S]*)\}\s*$/)?.[1] ?? "";
  const mainContentIndex = calendarRow.indexOf("<div className={styles.mainContent}>");
  const commercialLabelIndex = calendarRow.indexOf("{commercialLabel}", mainContentIndex);
  const headingIndex = calendarRow.indexOf("<h3>", mainContentIndex);

  assert.equal(calendar.match(/labelLocation="content"/g)?.length, 2);
  assert.equal(calendar.match(/commercialLabel=\{commercialLabel\}/g)?.length, 2);
  assert.doesNotMatch(calendar, /labelLocation="overlay"/);
  assert.match(calendarRow, /commercialLabel\?: ReactNode/);
  assert.ok(mainContentIndex >= 0 && commercialLabelIndex > mainContentIndex && headingIndex > commercialLabelIndex);
  assert.equal(weekend.match(/labelLocation="overlay"/g)?.length, 2);
  assert.match(mobile, /\.sectionSponsor a\s*\{[^}]*width:\s*auto/);
  assert.match(mobile, /\.sectionSponsor a\s*\{[^}]*border:\s*1px solid rgba\(255, 98, 0, 0\.58\)/);
  assert.match(mobile, /\.sectionSponsor a\s*\{[^}]*background:\s*#151b22/);
  assert.match(mobile, /\.sectionSponsor a\s*\{[^}]*min-height:\s*44px/);
  assert.match(styles, /\.sectionSponsor a\s*\{[^}]*background:\s*#ff6200/);
  assert.match(weekend, /commercialPlacement\.sectionSponsor/);
  assert.match(weekend, /buildCommercialSequence/);
});

test("las integraciones no inyectan publicidad en metadata, JSON-LD ni analítica orgánica", () => {
  const home = readFileSync(new URL("../../components/redesign-v2/SearchExperience.client.tsx", import.meta.url), "utf8");
  const calendar = readFileSync(new URL("../../components/redesign-v2/calendar/CalendarPageExperience.client.tsx", import.meta.url), "utf8");
  const weekend = readFileSync(new URL("../../components/redesign-v2/weekend/WeekendPageExperience.client.tsx", import.meta.url), "utf8");
  const eventCard = readFileSync(new URL("../../components/redesign-v2/EventCard.tsx", import.meta.url), "utf8");
  const calendarRow = readFileSync(new URL("../../components/redesign-v2/calendar/CalendarEventRow.tsx", import.meta.url), "utf8");
  const weekendCard = readFileSync(new URL("../../components/redesign-v2/weekend/WeekendEventCard.tsx", import.meta.url), "utf8");
  assert.match(home, /HOME_PROMOTED_01|surface: "home"/);
  assert.match(calendar, /surface: "calendar"/);
  assert.match(weekend, /surface: "weekend"/);
  assert.doesNotMatch([home, calendar, weekend].join("\n"), /application\/ld\+json|generateMetadata|export const metadata/);
  assert.match(eventCard, /eventName="click_event_detail"/);
  assert.doesNotMatch(calendarRow, /commercial_/);
  assert.doesNotMatch(weekendCard, /commercial_/);
});

test("fixtures de registry contienen los cuatro estados visuales Weekend y los dos de Home/Calendar", () => {
  const registry = getCommercialCampaignRegistry({ now: new Date(NOW), runtime: { nodeEnv: "development", vercelEnv: undefined } });
  const states = (surface: string) => new Set(registry.filter((campaign) => campaign.surface === surface).map((campaign) => campaign.demoState));
  assert.deepEqual([...states("home")].sort(), ["inserted", "organic_enhanced"]);
  assert.deepEqual([...states("calendar")].sort(), ["inserted", "organic_enhanced"]);
  assert.deepEqual([...states("weekend")].sort(), ["collision", "inserted", "organic_enhanced", "sponsor"]);
  assert.equal(registry.filter((campaign) => campaign.productType === "section_sponsor").length, 2);
});
