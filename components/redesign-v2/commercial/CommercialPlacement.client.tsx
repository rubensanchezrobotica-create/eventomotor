"use client";

import Image from "next/image";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";
import { trackEvent } from "@/lib/analytics";
import {
  commercialAnalyticsParams,
  commercialImpressionDedupeKey,
  COMMERCIAL_IMPRESSION_DURATION_MS,
  COMMERCIAL_IMPRESSION_THRESHOLD,
  shouldRecordCommercialImpression,
} from "@/lib/commercial/commercial-resolver";
import type {
  CommercialAnalyticsContext,
  ResolvedSponsoredEvent,
  SectionSponsorCampaign,
} from "@/lib/commercial/commercial-types";
import styles from "./CommercialPlacement.module.css";

const recordedImpressions = new Set<string>();
let pageViewId: string | null = null;

export function useCommercialBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setBreakpoint(media.matches ? "mobile" : "desktop");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return breakpoint;
}

function currentPageViewId() {
  if (pageViewId) return pageViewId;
  pageViewId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return pageViewId;
}

function campaignTracking(campaign: ResolvedSponsoredEvent["campaign"] | SectionSponsorCampaign): CommercialAnalyticsContext {
  return {
    campaignId: campaign.campaignId,
    placementId: campaign.placementId,
    creativeId: campaign.creativeId,
    surface: campaign.surface,
    productType: campaign.productType,
    deliveryMode: campaign.deliveryMode,
  };
}

function useCommercialImpression(ref: React.RefObject<HTMLElement | null>, context: CommercialAnalyticsContext) {
  const { campaignId, creativeId, deliveryMode, placementId, productType, surface } = context;
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const trackingContext = { campaignId, creativeId, deliveryMode, placementId, productType, surface };
    const dedupeKey = commercialImpressionDedupeKey(trackingContext, currentPageViewId());
    let ratio = 0;
    let visibleSince = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      visibleSince = 0;
    };

    const record = () => {
      const visibleDurationMs = visibleSince ? performance.now() - visibleSince : 0;
      if (!shouldRecordCommercialImpression({
        intersectionRatio: ratio,
        visibleDurationMs,
        documentVisible: document.visibilityState === "visible",
        alreadyRecorded: recordedImpressions.has(dedupeKey),
      })) return;
      if (!hasAnalyticsConsent()) return;
      recordedImpressions.add(dedupeKey);
      trackEvent("commercial_impression", commercialAnalyticsParams(trackingContext));
    };

    const begin = () => {
      clearTimer();
      if (ratio < COMMERCIAL_IMPRESSION_THRESHOLD || document.visibilityState !== "visible") return;
      visibleSince = performance.now();
      timer = setTimeout(record, COMMERCIAL_IMPRESSION_DURATION_MS);
    };

    const observer = new IntersectionObserver(([entry]) => {
      ratio = entry?.intersectionRatio ?? 0;
      begin();
    }, { threshold: [0, COMMERCIAL_IMPRESSION_THRESHOLD, 1] });
    const onVisibilityChange = () => begin();

    observer.observe(element);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimer();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [campaignId, creativeId, deliveryMode, placementId, productType, ref, surface]);
}

function CommercialBoundary({ children, context, eventLabelLocation, label, variant }: {
  children: ReactNode;
  context: CommercialAnalyticsContext;
  eventLabelLocation?: "content" | "overlay";
  label: ReactNode;
  variant: "event" | "sponsor";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useCommercialImpression(ref, context);

  function trackCommercialClick(event: MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element) || !event.target.closest("a")) return;
    if (!hasAnalyticsConsent()) return;
    trackEvent("commercial_click", commercialAnalyticsParams(context));
  }

  return (
    <div
      className={variant === "sponsor" ? styles.sponsorBoundary : styles.eventBoundary}
      data-commercial-delivery-mode={context.deliveryMode}
      data-commercial-label-location={variant === "event" ? eventLabelLocation : undefined}
      data-commercial-placement={context.placementId}
      onClickCapture={trackCommercialClick}
      ref={ref}
    >
      {variant === "event" ? label : null}
      {children}
    </div>
  );
}

type SponsoredEventCardProps = {
  placement: ResolvedSponsoredEvent;
} & (
  | { children: (label: ReactNode) => ReactNode; labelLocation: "content" }
  | { children: ReactNode; labelLocation: "overlay" }
);

export function SponsoredEventCard({ children, labelLocation, placement }: SponsoredEventCardProps) {
  const label = (
    <span className={labelLocation === "content" ? styles.promotedLabelContent : styles.promotedLabel}>
      Promocionado
    </span>
  );
  const content = labelLocation === "content" ? children(label) : children;

  return (
    <CommercialBoundary
      context={campaignTracking(placement.campaign)}
      eventLabelLocation={labelLocation}
      label={labelLocation === "overlay" ? label : null}
      variant="event"
    >
      {content}
    </CommercialBoundary>
  );
}

export function SectionSponsor({ campaign }: { campaign: SectionSponsorCampaign }) {
  const creative = campaign.creative;
  return (
    <CommercialBoundary context={campaignTracking(campaign)} label={null} variant="sponsor">
      <aside aria-label={`${creative.label}: ${creative.brandName}`} className={styles.sectionSponsor}>
        <span className={styles.sponsorEyebrow}>{creative.label}</span>
        <div className={styles.sponsorBrand}>
          <Image alt="" height={64} src={creative.brandLogo} width={64} />
          <strong>{creative.brandName}</strong>
        </div>
        <p>{creative.shortCopy}</p>
        <a href={creative.destinationUrl}>{creative.ctaLabel} <span aria-hidden="true">→</span></a>
      </aside>
    </CommercialBoundary>
  );
}
