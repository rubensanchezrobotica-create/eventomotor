import type { Metadata } from "next";
import { getEventImage, getEventImageAlt } from "@/lib/event-images";
import { getEventSeoOverride } from "@/lib/event-seo-overrides";
import { absoluteMetadataTitle, brandedPageTitle, SITE_NAME } from "@/lib/seo";
import type { EventItem } from "@/types/event";

const EVENT_STATUS_SCHEMA: Record<string, string> = {
  confirmed: "https://schema.org/EventScheduled",
  tentative: "https://schema.org/EventScheduled",
  postponed: "https://schema.org/EventPostponed",
  cancelled: "https://schema.org/EventCancelled",
};

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function absoluteImageUrl(value: string, siteUrl: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${siteUrl}${value}`;
}

function hasCoordinates(event: EventItem) {
  return typeof event.latitude === "number"
    && typeof event.longitude === "number"
    && Number.isFinite(event.latitude)
    && Number.isFinite(event.longitude);
}

export type EventPageSeoFallback = {
  title: string;
  description: string;
};

export function buildEventMetadata(
  event: EventItem,
  siteUrl: string,
  requestedSlug: string,
  fallback: EventPageSeoFallback,
): Metadata {
  const url = `${siteUrl}/evento/${event.slug || requestedSlug}`;
  const override = getEventSeoOverride(event.slug);
  const title = brandedPageTitle(override?.seoTitle || fallback.title);
  const description = override?.seoDescription || fallback.description;
  const eventImage = getEventImage(event);
  const eventImageAlt = getEventImageAlt(event);
  const image = absoluteImageUrl(eventImage, siteUrl);

  return {
    title: absoluteMetadataTitle(title),
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "article",
      images: [{ url: image, alt: eventImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function buildEventJsonLd(
  event: EventItem,
  url: string,
  imageUrl: string,
  description: string,
) {
  const officialUrl = cleanText(event.officialUrl) || cleanText(event.sourceUrl);
  const organizerName = cleanText(event.organizerName) || cleanText(event.source);
  const organizerUrl = cleanText(event.organizerUrl) || cleanText(event.sourceUrl);
  const location: Record<string, unknown> = {
    "@type": "Place",
    name: event.venue || event.city || "Por confirmar",
    address: {
      "@type": "PostalAddress",
      streetAddress: cleanText(event.address) || undefined,
      addressLocality: event.city || undefined,
      addressRegion: event.province || undefined,
      addressCountry: cleanText(event.country) || "ES",
    },
  };

  if (hasCoordinates(event)) {
    location.geo = {
      "@type": "GeoCoordinates",
      latitude: event.latitude,
      longitude: event.longitude,
    };
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description,
    startDate: event.start,
    endDate: event.end || event.start,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: EVENT_STATUS_SCHEMA[cleanText(event.eventStatus)] || "https://schema.org/EventScheduled",
    url,
    mainEntityOfPage: url,
    image: [imageUrl],
    location,
  };

  if (officialUrl && officialUrl !== url) {
    jsonLd.sameAs = officialUrl;
  }

  if (organizerName) {
    jsonLd.organizer = {
      "@type": "Organization",
      name: organizerName,
      url: organizerUrl || undefined,
    };
  }

  return jsonLd;
}

export function buildEventBreadcrumbJsonLd(event: EventItem, url: string, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Calendario",
        item: `${siteUrl}/#calendario`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: event.title,
        item: url,
      },
    ],
  };
}
