import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import WeekendPreviewPage, {
  WEEKEND_FAQS,
} from "@/components/preview/weekend/WeekendPreviewPage";
import {
  buildWeekendPreviewData,
  parseWeekendFilters,
} from "@/components/preview/weekend/weekend-preview-model";
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
    itemListElement: events.slice(0, 20).map((event, index) => ({
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

  const [events, params] = await Promise.all([
    getVisibleEvents(),
    searchParams,
  ]);
  const data = buildWeekendPreviewData(events, new Date());
  const initialFilters = parseWeekendFilters(params);

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
      {data.events.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd(data.events)) }}
        />
      ) : null}
      <WeekendPreviewPage
        data={data}
        initialFilters={initialFilters}
        pathname={pathname}
      />
    </>
  );
}
