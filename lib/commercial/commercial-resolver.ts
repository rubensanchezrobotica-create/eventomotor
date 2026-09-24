import type { PreviewEvent, ResolvedEventImage } from "@/components/redesign-v2/redesign-v2-model";
import type {
  CommercialAnalyticsContext,
  CommercialBreakpoint,
  CommercialCampaign,
  CommercialFilterContext,
  CommercialResolutionContext,
  CommercialSlot,
  CommercialSurface,
  ResolvedCommercialPlacement,
  ResolvedSponsoredEvent,
  SectionSponsorCampaign,
  SponsoredEventCampaign,
} from "./commercial-types";

export const COMMERCIAL_IMPRESSION_THRESHOLD = 0.5;
export const COMMERCIAL_IMPRESSION_DURATION_MS = 1_000;
export const WEEKEND_COLLISION_STRATEGY = "DEFER_IF_SAFE_ELSE_SUPPRESS" as const;

export const COMMERCIAL_SLOTS: Readonly<Record<CommercialSurface, CommercialSlot>> = {
  home: { insertAfter: { desktop: 3, mobile: 2 } },
  calendar: { insertAfter: { desktop: 3, mobile: 3 } },
  weekend: {
    insertAfter: { desktop: 3, mobile: 2 },
    deferredAfter: { desktop: 6, mobile: 4 },
  },
};

const PLACEMENT_SURFACE = {
  HOME_PROMOTED_01: "home",
  CALENDAR_PROMOTED_01: "calendar",
  WEEKEND_PROMOTED_01: "weekend",
  WEEKEND_SPONSOR_01: "weekend",
} as const;

export type CommercialSequenceItem<T> =
  | { kind: "organic"; event: T; enhanced: ResolvedSponsoredEvent | null }
  | { kind: "inserted"; placement: ResolvedSponsoredEvent };

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function eventText(event: PreviewEvent) {
  return normalize([
    event.title,
    event.championship,
    event.discipline,
    event.venue,
    event.city,
    event.province,
    event.region,
    event.vehicleType,
    event.tags.join(" "),
  ].join(" "));
}

function intersectsSelectedDate(event: PreviewEvent, selectedDate: string) {
  return event.start <= selectedDate && (event.end || event.start) >= selectedDate;
}

function valueMatches(value: string | undefined, expected: string | undefined) {
  if (!expected) return true;
  return normalize(value).includes(normalize(expected));
}

export function eventMatchesCommercialFilters(event: PreviewEvent, filters: CommercialFilterContext = {}) {
  if (filters.query && !eventText(event).includes(normalize(filters.query))) return false;
  if (!valueMatches(event.discipline, filters.discipline)) return false;
  if (!valueMatches(event.vehicleType, filters.vehicle)) return false;
  if (filters.territory) {
    const territory = normalize([event.city, event.province, event.region].filter(Boolean).join(" "));
    if (!territory.includes(normalize(filters.territory))) return false;
  }
  if (filters.selectedDate && !intersectsSelectedDate(event, filters.selectedDate)) return false;
  if (filters.dateFrom && (event.end || event.start) < filters.dateFrom) return false;
  if (filters.dateTo && event.start > filters.dateTo) return false;
  return true;
}

function eventMatchesTargeting(event: PreviewEvent, campaign: CommercialCampaign) {
  const targeting = campaign.targeting;
  if (!targeting) return true;
  const includes = (values: readonly string[] | undefined, value: string | undefined) => (
    !values?.length || values.some((candidate) => valueMatches(value, candidate))
  );
  return includes(targeting.disciplines, event.discipline)
    && includes(targeting.territories, [event.city, event.province, event.region].filter(Boolean).join(" "))
    && includes(targeting.vehicles, event.vehicleType);
}

function contextMatchesTargeting(filters: CommercialFilterContext | undefined, campaign: CommercialCampaign) {
  if (!filters || !campaign.targeting) return true;
  const selectedValues: Array<[string | undefined, readonly string[] | undefined]> = [
    [filters.discipline, campaign.targeting.disciplines],
    [filters.territory, campaign.targeting.territories],
    [filters.vehicle, campaign.targeting.vehicles],
  ];
  return selectedValues.every(([selected, allowed]) => (
    !selected || !allowed?.length || allowed.some((candidate) => valueMatches(selected, candidate))
  ));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidDateRange(campaign: CommercialCampaign) {
  const start = Date.parse(campaign.startsAt);
  const end = Date.parse(campaign.endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}

export function validateCommercialCampaign(campaign: CommercialCampaign): string[] {
  const errors: string[] = [];
  if (!campaign.campaignId || !campaign.creativeId || !campaign.exclusivityKey) errors.push("missing_identity");
  if (campaign.productionEligible !== false) errors.push("production_eligibility_forbidden");
  if (PLACEMENT_SURFACE[campaign.placementId] !== campaign.surface) errors.push("placement_surface_mismatch");
  if (!Number.isFinite(campaign.priority)) errors.push("invalid_priority");
  if (!isValidDateRange(campaign)) errors.push("invalid_schedule");
  if (!campaign.demoState) errors.push("missing_demo_state");

  if (campaign.productType === "sponsored_event") {
    if (campaign.deliveryMode === "inserted") {
      if (!campaign.creative) errors.push("inserted_creative_required");
      if (campaign.demoUseFirstVisibleEvent) errors.push("inserted_first_visible_forbidden");
      if (campaign.creative && campaign.creative.event.id !== campaign.eventId) errors.push("event_id_mismatch");
    } else if (!campaign.demoUseFirstVisibleEvent && !campaign.eventId) {
      errors.push("organic_event_id_required");
    }
  } else {
    const creative = campaign.creative;
    if (!creative.label || !creative.brandName || !creative.brandLogo || !creative.shortCopy || !creative.ctaLabel) {
      errors.push("incomplete_section_sponsor_creative");
    }
    if (!isHttpUrl(creative.destinationUrl)) errors.push("invalid_destination_url");
  }
  return errors;
}

export function validateCommercialCampaignRegistry(campaigns: readonly CommercialCampaign[]) {
  const seenCampaigns = new Set<string>();
  const seenCreatives = new Set<string>();
  const errors: string[] = [];
  for (const campaign of campaigns) {
    for (const error of validateCommercialCampaign(campaign)) errors.push(`${campaign.campaignId}:${error}`);
    if (seenCampaigns.has(campaign.campaignId)) errors.push(`${campaign.campaignId}:duplicate_campaign_id`);
    if (seenCreatives.has(campaign.creativeId)) errors.push(`${campaign.creativeId}:duplicate_creative_id`);
    seenCampaigns.add(campaign.campaignId);
    seenCreatives.add(campaign.creativeId);
  }
  return { valid: errors.length === 0, errors } as const;
}

function isCampaignEligible(campaign: CommercialCampaign, context: CommercialResolutionContext) {
  if (validateCommercialCampaign(campaign).length) return false;
  if (campaign.status !== "active" || campaign.surface !== context.surface) return false;
  if (campaign.demoState !== context.demoState || !context.demoState) return false;
  const now = Date.parse(context.nowIso);
  if (!Number.isFinite(now) || now < Date.parse(campaign.startsAt) || now >= Date.parse(campaign.endsAt)) return false;
  return contextMatchesTargeting(context.filters, campaign);
}

function targetingSpecificity(campaign: CommercialCampaign) {
  const targeting = campaign.targeting;
  if (!targeting) return 0;
  return Number(Boolean(targeting.disciplines?.length))
    + Number(Boolean(targeting.territories?.length))
    + Number(Boolean(targeting.vehicles?.length));
}

function deterministicCampaignOrder(left: CommercialCampaign, right: CommercialCampaign) {
  return right.priority - left.priority
    || targetingSpecificity(right) - targetingSpecificity(left)
    || left.campaignId.localeCompare(right.campaignId);
}

function selectCandidate<T extends CommercialCampaign>(campaigns: readonly T[]) {
  return [...campaigns].sort(deterministicCampaignOrder)[0] ?? null;
}

function materializeSponsoredEvent(
  campaign: SponsoredEventCampaign,
  context: CommercialResolutionContext,
): Omit<ResolvedSponsoredEvent, "insertAfter" | "deferred"> | null {
  const firstVisible = context.visibleEvents[0];
  const organicEvent = campaign.demoUseFirstVisibleEvent
    ? firstVisible
    : context.visibleEvents.find((event) => event.id === campaign.eventId);
  const event = campaign.deliveryMode === "organic_enhanced" ? organicEvent : campaign.creative?.event;
  const image = campaign.deliveryMode === "inserted"
    ? campaign.creative?.image
    : campaign.creative?.image ?? ({ src: null, kind: "neutral", alt: "" } satisfies ResolvedEventImage);
  if (!event || !image) return null;
  if (!eventMatchesCommercialFilters(event, context.filters) || !eventMatchesTargeting(event, campaign)) return null;
  const eventId = event.id;
  const isAlreadyVisible = context.visibleEvents.some((visibleEvent) => visibleEvent.id === eventId);
  if (campaign.deliveryMode === "inserted" && isAlreadyVisible) return null;
  if (campaign.deliveryMode === "organic_enhanced" && !isAlreadyVisible) return null;
  return { campaign, deliveryMode: campaign.deliveryMode, eventId, event, image };
}

export function resolveCommercialPlacement(
  campaigns: readonly CommercialCampaign[],
  context: CommercialResolutionContext,
): ResolvedCommercialPlacement {
  const registryValidation = validateCommercialCampaignRegistry(campaigns);
  if (!registryValidation.valid) {
    return { sponsoredEvent: null, sectionSponsor: null, sponsoredEventSuppressedByCollision: false };
  }

  const eligible = campaigns.filter((campaign) => isCampaignEligible(campaign, context));
  const sectionSponsor = selectCandidate(
    eligible.filter((campaign): campaign is SectionSponsorCampaign => campaign.productType === "section_sponsor"),
  );
  const sponsoredCandidate = selectCandidate(
    eligible.filter((campaign): campaign is SponsoredEventCampaign => campaign.productType === "sponsored_event"),
  );
  const sponsored = sponsoredCandidate ? materializeSponsoredEvent(sponsoredCandidate, context) : null;
  if (!sponsored) {
    return { sponsoredEvent: null, sectionSponsor, sponsoredEventSuppressedByCollision: false };
  }

  const slot = COMMERCIAL_SLOTS[context.surface];
  const collision = context.surface === "weekend" && Boolean(sectionSponsor) && sponsored.deliveryMode === "inserted";
  const insertAfter = sponsored.deliveryMode === "inserted"
    ? collision ? slot.deferredAfter ?? null : slot.insertAfter
    : null;
  if (collision && !insertAfter) {
    return { sponsoredEvent: null, sectionSponsor, sponsoredEventSuppressedByCollision: true };
  }

  return {
    sponsoredEvent: { ...sponsored, insertAfter, deferred: collision },
    sectionSponsor,
    sponsoredEventSuppressedByCollision: false,
  };
}

export function buildCommercialSequence<T extends { id: string }>(
  organicEvents: readonly T[],
  placement: ResolvedSponsoredEvent | null,
  breakpoint: CommercialBreakpoint,
): CommercialSequenceItem<T>[] {
  const organic = organicEvents.map((event) => ({
    kind: "organic" as const,
    event,
    enhanced: placement?.deliveryMode === "organic_enhanced" && placement.eventId === event.id ? placement : null,
  }));
  if (!placement || placement.deliveryMode !== "inserted" || !placement.insertAfter) return organic;
  const insertAfter = placement.insertAfter[breakpoint];
  if (insertAfter < 1 || organic.length < insertAfter) return organic;
  return [
    ...organic.slice(0, insertAfter),
    { kind: "inserted" as const, placement },
    ...organic.slice(insertAfter),
  ];
}

export function commercialAnalyticsParams(context: CommercialAnalyticsContext) {
  return {
    campaign_id: context.campaignId,
    placement_id: context.placementId,
    creative_id: context.creativeId,
    surface: context.surface,
    product_type: context.productType,
    delivery_mode: context.deliveryMode,
  };
}

export function commercialImpressionDedupeKey(context: CommercialAnalyticsContext, pageViewId: string) {
  return [context.campaignId, context.placementId, context.creativeId, pageViewId].join(":");
}

export function shouldRecordCommercialImpression(input: {
  intersectionRatio: number;
  visibleDurationMs: number;
  documentVisible: boolean;
  alreadyRecorded: boolean;
}) {
  return input.intersectionRatio >= COMMERCIAL_IMPRESSION_THRESHOLD
    && input.visibleDurationMs >= COMMERCIAL_IMPRESSION_DURATION_MS
    && input.documentVisible
    && !input.alreadyRecorded;
}

export function readCommercialDemoState(searchParams: Pick<URLSearchParams, "get">) {
  return searchParams.get("commercial_demo")?.trim().toLowerCase() ?? "";
}

export function preserveCommercialDemoState(query: string, demoState: string, enabled: boolean) {
  if (!enabled || !demoState) return query;
  const params = new URLSearchParams(query);
  params.set("commercial_demo", demoState);
  return params.toString();
}
