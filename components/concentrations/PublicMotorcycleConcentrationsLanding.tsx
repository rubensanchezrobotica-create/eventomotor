import MotorcycleConcentrationsLanding from "@/components/concentrations/MotorcycleConcentrationsLanding";
import {
  buildMotorcycleConcentrationsModel,
  parseMotorcycleLandingQuery,
} from "@/lib/concentrations/motorcycle-concentrations-model";
import type { OpportunityPage } from "@/lib/opportunity-pages";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

type PublicMotorcycleConcentrationsLandingProps = {
  page: OpportunityPage;
  searchParams: Promise<SearchParams>;
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
  page,
  searchParams,
}: PublicMotorcycleConcentrationsLandingProps) {
  const [events, queryParams] = await Promise.all([getVisibleEvents(), searchParams]);
  const model = buildMotorcycleConcentrationsModel(
    events.map((event) => ({ ...event, visible: true })),
    new Date(),
  );
  const query = parseMotorcycleLandingQuery(queryParams);
  const pathname = `/${page.slug}`;
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: page.h1,
    itemListElement: model.upcomingEvents.slice(0, 20).map((event, index) => ({
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
      {model.upcomingTotal > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
        />
      ) : null}
      <MotorcycleConcentrationsLanding
        model={model}
        page={page}
        pathname={pathname}
        query={query}
      />
    </>
  );
}
