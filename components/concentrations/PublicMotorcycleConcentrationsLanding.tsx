import MotorcycleConcentrationsLanding from "@/components/concentrations/MotorcycleConcentrationsLanding";
import MotorcycleConcentrationsLandingV2 from "@/components/concentrations/MotorcycleConcentrationsLandingV2";
import { redesignV2DisplayPilot } from "@/components/redesign-v2/redesign-v2-fonts";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import {
  buildMotorcycleConcentrationsModel,
  filterMotorcycleConcentrations,
  parseMotorcycleLandingQuery,
} from "@/lib/concentrations/motorcycle-concentrations-model";
import type { OpportunityPage } from "@/lib/opportunity-pages";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

type PublicMotorcycleConcentrationsLandingProps = {
  eventFilter?: OpportunityPage["filter"];
  page: OpportunityPage;
  searchParams: Promise<SearchParams>;
  year: number;
};

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function breadcrumbJsonLd(page: OpportunityPage) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: page.h1,
        item: `${SITE_URL}/${page.slug}`,
      },
    ],
  };
}

function collectionPageJsonLd(page: OpportunityPage) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: page.h1,
    description: page.description,
    url: `${SITE_URL}/${page.slug}`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
}

function faqJsonLd(page: OpportunityPage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export default async function PublicMotorcycleConcentrationsLanding({
  eventFilter,
  page,
  searchParams,
  year,
}: PublicMotorcycleConcentrationsLandingProps) {
  const [events, queryParams] = await Promise.all([getVisibleEvents(), searchParams]);
  const now = new Date();
  const visibleEvents = events.map((event) => ({ ...event, visible: true }));
  const model = buildMotorcycleConcentrationsModel(
    eventFilter ? visibleEvents.filter((event) => eventFilter(event, now)) : visibleEvents,
    now,
    year,
  );
  const parsedQuery = parseMotorcycleLandingQuery(queryParams, year);
  const query = year === 2027 && (
    (parsedQuery.when === "weekend" && model.weekendEvents.length === 0)
    || (parsedQuery.when === "next30" && model.nextThirtyDaysEvents.length === 0)
  )
    ? { ...parsedQuery, when: "upcoming" as const }
    : parsedQuery;
  const jsonLdEvents = eventFilter
    ? filterMotorcycleConcentrations(model, query)
    : model.upcomingEvents;
  const pathname = `/${page.slug}`;
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page.h1,
    itemListElement: jsonLdEvents.slice(0, 20).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/evento/${event.slug || event.id}`,
      name: event.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd(page)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionPageJsonLd(page)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd(page)) }}
      />
      {jsonLdEvents.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
        />
      ) : null}
      {year === 2026 ? (
        <MotorcycleConcentrationsLanding
          model={model}
          page={page}
          pathname={pathname}
          query={query}
        />
      ) : (
        <div className={redesignV2DisplayPilot.variable} data-v2-display-font-pilot="archivo">
          <V2InteriorShell
            breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: page.h1 }]}
            description={page.lead}
            eyebrow={page.eyebrow}
            heroImageSrc="/images/redesign-v2/disciplines/hero-concentraciones.png"
            heroTitleFontClassName={redesignV2DisplayPilot.variable}
            navigationMode="public"
            title={page.h1}
            upcomingCount={events.filter((event) => (event.end || event.start) >= model.today).length}
          >
            <MotorcycleConcentrationsLandingV2
              model={model}
              nowIso={now.toISOString()}
              page={page}
              pathname={pathname}
              query={query}
            />
          </V2InteriorShell>
        </div>
      )}
    </>
  );
}
