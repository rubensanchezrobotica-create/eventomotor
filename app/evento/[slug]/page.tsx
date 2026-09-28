import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import EventDetailV2 from "@/components/redesign-v2/event-detail/EventDetailV2";
import {
  buildEventDetailV2Model,
  madridDateKey,
} from "@/components/redesign-v2/event-detail/event-detail-model";
import { getEventImage } from "@/lib/event-images";
import {
  buildEventBreadcrumbJsonLd,
  buildEventJsonLd,
  buildEventMetadata,
  buildEventSeoTitle,
  buildMetadataDescription,
} from "@/lib/event-page-seo";
import {
  buildFaqPageJsonLd,
  getEventSeoOverride,
} from "@/lib/event-seo-overrides";
import { getSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient, mapEventRowToEventItem } from "@/lib/supabase";
import type { EventRow } from "@/lib/supabase";
import type { EventItem } from "@/types/event";
import { eventSlugRedirectHref } from "@/lib/event-slug-redirects";
import {
  currentNewsletterProductionCanaryEnvironment,
  currentNewsletterPublicLaunchEnvironment,
  evaluateNewsletterProductionCanaryResendConfiguration,
  evaluateNewsletterPublicLaunchResendConfiguration,
} from "@/lib/newsletter/resend-config.server";
import { isNewsletterPublicLaunchPageRequestAllowed } from "@/lib/newsletter/r5b-guard";

type EventPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const EVENT_DETAIL_SELECT =
  "id,slug,title,championship,discipline,start_date,end_date,venue,city,province,region,country,level,source,source_url,ticket_url,official_url,registration_url,image_url,image_source_url,event_status,short_description,long_description,schedule_text,address,latitude,longitude,organizer_name,organizer_url,verified_at,source_type,confidence_score,needs_review,tags,vehicle_type,featured,visible,import_method,data_quality,notes";

async function getVisibleEvents(): Promise<EventItem[]> {
  const supabase = createSupabaseServerClient();

  if (!supabase) return [];

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("visible", true)
    .order("start_date", { ascending: true });

  if (error || !data) return [];

  return (data as EventRow[]).map(mapEventRowToEventItem);
}

async function getEventBySlug(slug: string): Promise<EventItem | null> {
  const supabase = createSupabaseServerClient();

  if (!supabase) return null;

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_DETAIL_SELECT)
    .eq("slug", slug)
    .eq("visible", true)
    .maybeSingle();

  if (error || !data) return null;

  return mapEventRowToEventItem(data as unknown as EventRow);
}

function absoluteImageUrl(value: string, siteUrl: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${siteUrl}${value}`;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) return {};

  return buildEventMetadata(event, getSiteUrl(), slug, {
    title: buildEventSeoTitle(event),
    description: buildMetadataDescription(event),
  });
}

export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const [event, events] = await Promise.all([
    getEventBySlug(slug),
    getVisibleEvents(),
  ]);

  if (!event) {
    const redirectHref = eventSlugRedirectHref(slug, await searchParams);
    if (redirectHref) permanentRedirect(redirectHref);
  }
  if (!event) notFound();

  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/evento/${event.slug || slug}`;
  const imageUrl = absoluteImageUrl(getEventImage(event), siteUrl);
  const jsonLd = buildEventJsonLd(event, url, imageUrl, buildMetadataDescription(event));
  const breadcrumbJsonLd = buildEventBreadcrumbJsonLd(event, url, siteUrl);
  const faqItems = getEventSeoOverride(event.slug)?.faqItems;
  const now = new Date();
  const model = buildEventDetailV2Model(event, events, {
    relatedToday: now.toISOString().slice(0, 10),
    routeContext: "public",
    siteUrl,
    today: madridDateKey(now),
  });
  if (!model) notFound();
  const requestHeaders = await headers();
  const publicConfiguration =
    evaluateNewsletterPublicLaunchResendConfiguration(
      currentNewsletterPublicLaunchEnvironment(),
    );
  const canaryConfiguration =
    evaluateNewsletterProductionCanaryResendConfiguration(
      currentNewsletterProductionCanaryEnvironment(),
    );
  const newsletterPublicLaunchEnabled =
    publicConfiguration.enabled &&
    !canaryConfiguration.enabled &&
    isNewsletterPublicLaunchPageRequestAllowed(
      publicConfiguration,
      requestHeaders.get("host"),
      requestHeaders.get("x-forwarded-proto"),
    );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {faqItems?.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqPageJsonLd(faqItems)) }}
        />
      ) : null}
      <EventDetailV2
        model={model}
        publicContext={{ event, faqItems, newsletterPublicLaunchEnabled }}
        routeContext="public"
      />
    </>
  );
}
