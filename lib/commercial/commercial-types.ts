import type { PreviewEvent, ResolvedEventImage } from "@/components/redesign-v2/redesign-v2-model";

export type CommercialSurface = "home" | "calendar" | "weekend";
export type CommercialBreakpoint = "desktop" | "mobile";
export type SponsoredEventDeliveryMode = "inserted" | "organic_enhanced";
export type CommercialDeliveryMode = SponsoredEventDeliveryMode | "section_sponsor";

export type SponsoredEventPlacementId =
  | "HOME_PROMOTED_01"
  | "CALENDAR_PROMOTED_01"
  | "WEEKEND_PROMOTED_01";

export type SectionSponsorPlacementId = "WEEKEND_SPONSOR_01";
export type CommercialPlacementId = SponsoredEventPlacementId | SectionSponsorPlacementId;

export type CommercialCampaignStatus = "active" | "paused";

export type CommercialTargeting = {
  disciplines?: readonly string[];
  territories?: readonly string[];
  vehicles?: readonly string[];
};

type CommercialCampaignBase = {
  campaignId: string;
  creativeId: string;
  surface: CommercialSurface;
  status: CommercialCampaignStatus;
  startsAt: string;
  endsAt: string;
  priority: number;
  exclusivityKey: string;
  productionEligible: false;
  demoState: string;
  targeting?: CommercialTargeting;
};

export type CommercialEventCreative = {
  event: PreviewEvent;
  image: ResolvedEventImage;
};

export type SponsoredEventCampaign = CommercialCampaignBase & {
  productType: "sponsored_event";
  placementId: SponsoredEventPlacementId;
  deliveryMode: SponsoredEventDeliveryMode;
  eventId: string;
  creative?: CommercialEventCreative;
  demoUseFirstVisibleEvent?: true;
};

export type SectionSponsorCreative = {
  label: string;
  brandName: string;
  brandLogo: string;
  shortCopy: string;
  ctaLabel: string;
  destinationUrl: string;
};

export type SectionSponsorCampaign = CommercialCampaignBase & {
  productType: "section_sponsor";
  placementId: SectionSponsorPlacementId;
  deliveryMode: "section_sponsor";
  creative: SectionSponsorCreative;
};

export type CommercialCampaign = SponsoredEventCampaign | SectionSponsorCampaign;

export type CommercialFilterContext = {
  query?: string;
  discipline?: string;
  territory?: string;
  vehicle?: string;
  selectedDate?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type CommercialResolutionContext = {
  surface: CommercialSurface;
  nowIso: string;
  demoState: string;
  visibleEvents: readonly PreviewEvent[];
  filters?: CommercialFilterContext;
};

export type CommercialSlot = {
  insertAfter: Readonly<Record<CommercialBreakpoint, number>>;
  deferredAfter?: Readonly<Record<CommercialBreakpoint, number>>;
};

export type ResolvedSponsoredEvent = {
  campaign: SponsoredEventCampaign;
  deliveryMode: SponsoredEventDeliveryMode;
  eventId: string;
  event: PreviewEvent;
  image: ResolvedEventImage;
  insertAfter: Readonly<Record<CommercialBreakpoint, number>> | null;
  deferred: boolean;
};

export type ResolvedCommercialPlacement = {
  sponsoredEvent: ResolvedSponsoredEvent | null;
  sectionSponsor: SectionSponsorCampaign | null;
  sponsoredEventSuppressedByCollision: boolean;
};

export type CommercialAnalyticsContext = {
  campaignId: string;
  placementId: CommercialPlacementId;
  creativeId: string;
  surface: CommercialSurface;
  productType: CommercialCampaign["productType"];
  deliveryMode: CommercialDeliveryMode;
};
