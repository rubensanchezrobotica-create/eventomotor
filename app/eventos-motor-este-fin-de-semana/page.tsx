import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WEEKEND_FAQS } from "@/components/preview/weekend/weekend-public-content";
import { buildWeekendPreviewData } from "@/components/preview/weekend/weekend-preview-model";
import { assignV2HomeEventImages } from "@/components/redesign-v2/discipline-fallback-resolver";
import { projectPreviewEvent } from "@/components/redesign-v2/redesign-v2-model";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import WeekendPageExperience from "@/components/redesign-v2/weekend/WeekendPageExperience.client";
import WeekendPublicEditorial from "@/components/redesign-v2/weekend/WeekendPublicEditorial";
import {
  buildPublicWeekendResults,
  calculatePublicWeekendRange,
  paginateWeekendEvents,
  parsePublicWeekendUrlState,
} from "@/components/redesign-v2/weekend/weekend-page-model";
import { getVehicleType } from "@/lib/event-classification";
import { buildOpportunityMetadata, getOpportunityPage } from "@/lib/opportunity-pages";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const page = getOpportunityPage("eventos-motor-este-fin-de-semana");
const pathname = "/eventos-motor-este-fin-de-semana";

type WeekendPublicRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = buildOpportunityMetadata(page);

function breadcrumbJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SITE_NAME,
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page?.h1,
        item: `${SITE_URL}${pathname}`,
      },
    ],
  };
}

function collectionPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: page?.h1,
    description: page?.description,
    url: `${SITE_URL}${pathname}`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: WEEKEND_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

function itemListJsonLd(events: ReturnType<typeof buildWeekendPreviewData>["events"]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page?.h1,
    itemListElement: events.map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/evento/${event.slug || event.id}`,
      name: event.title,
    })),
  };
}

export default async function EventosMotorEsteFinDeSemanaPage({
  searchParams,
}: WeekendPublicRouteProps) {
  await connection();

  if (!page) notFound();

  const now = new Date();
  const range = calculatePublicWeekendRange(now);
  const [events, params] = await Promise.all([
    getVisibleEvents(),
    searchParams,
  ]);
  const data = buildWeekendPreviewData(events, now, range);
  const initialState = parsePublicWeekendUrlState(params);
  const imageEvents = data.events.map((event) => projectPreviewEvent({ ...event, vehicleType: getVehicleType(event) }));
  const images = assignV2HomeEventImages(imageEvents);
  const imageByEventId = Object.fromEntries(data.events.map((event, index) => [event.id, images[index]]));
  const filteredEvents = buildPublicWeekendResults(data.events, initialState, range);
  const visibleEvents = paginateWeekendEvents(filteredEvents, initialState.page).visible;
  const upcomingCount = events.filter((event) => (event.end || event.start) >= range.today).length;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      {visibleEvents.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd(visibleEvents)) }}
        />
      ) : null}
      <V2InteriorShell
        breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Este fin de semana" }]}
        currentNavigationId="weekend"
        description="Carreras, concentraciones y planes para disfrutar del motor de viernes a domingo."
        eyebrow="Agenda del fin de semana"
        heroImageSrc="/images/redesign-v2/hero-eventomotor.webp"
        heroTitleFontClassName={redesignV2DisplayPilot.variable}
        navigationMode="public"
        newsletterContextualCta
        title="Este fin de semana"
        upcomingCount={upcomingCount}
      >
        <WeekendPageExperience
          events={data.events}
          imageByEventId={imageByEventId}
          initialState={initialState}
          nowIso={now.toISOString()}
          publicOptions={{
            disciplineOptions: data.disciplineOptions,
            families: data.families,
            provinceOptions: data.provinceOptions,
          }}
          range={range}
          routeContext="public"
        />
        <WeekendPublicEditorial />
      </V2InteriorShell>
    </>
  );
}
