import RegionalLanding from "@/components/regions/RegionalLanding";
import {
  assertRegionalLandingModelTerritorial,
  buildRegionalLandingModel,
  parseRegionalLandingQuery,
  type RegionalLandingModel,
  type RegionalRegionId,
} from "@/lib/regions/regional-landing-model";
import type { OpportunityPage } from "@/lib/opportunity-pages";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

type SearchParams = Record<string, string | string[] | undefined>;

type PublicRegionalLandingProps = {
  page: OpportunityPage;
  region: RegionalRegionId;
  searchParams: Promise<SearchParams>;
};

function publicModel(
  model: RegionalLandingModel,
  page: OpportunityPage,
): RegionalLandingModel {
  if (
    page.title !== model.config.publicMetadata.title
    || page.description !== model.config.publicMetadata.description
    || `/${page.slug}` !== model.config.publicMetadata.canonical
  ) {
    throw new Error(`La metadata pública de ${model.config.name} no coincide con la configuración regional.`);
  }
  const relatedLinks = [...page.relatedLinks, ...model.config.relatedLinks]
    .filter((link, index, links) => (
      link.href !== model.config.publicPath
      && links.findIndex((candidate) => candidate.href === link.href) === index
    ));
  const preservedEditorial = [
    page.intro,
    ...page.editorialBlocks.map((block) => `${block.title}. ${block.text}`),
    ...page.usageSteps.map((step) => `${step.title}. ${step.text}`),
  ];

  return {
    ...model,
    config: {
      ...model.config,
      faqs: page.faqs,
      relatedLinks,
      seoParagraphs: [...preservedEditorial, ...model.config.seoParagraphs],
    },
  };
}

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function breadcrumbJsonLd(page: OpportunityPage) {
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
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

function faqJsonLd(page: OpportunityPage) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

function itemListJsonLd(page: OpportunityPage, model: RegionalLandingModel) {
  return {
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
}

export default async function PublicRegionalLanding({
  page,
  region,
  searchParams,
}: PublicRegionalLandingProps) {
  const [events, queryParams] = await Promise.all([
    getVisibleEvents(),
    searchParams,
  ]);
  const now = new Date();
  const inventoryModel = assertRegionalLandingModelTerritorial(
    buildRegionalLandingModel(
      events.map((event) => ({ ...event, visible: true })),
      region,
      now,
    ),
  );
  const model = publicModel(inventoryModel, page);
  const pathname = `/${page.slug}`;
  const query = parseRegionalLandingQuery(queryParams);

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
      {page.faqs.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd(page)) }}
        />
      ) : null}
      {model.upcomingTotal ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd(page, model)) }}
        />
      ) : null}
      <RegionalLanding
        mode="public"
        model={model}
        pathname={pathname}
        query={query}
      />
    </>
  );
}
