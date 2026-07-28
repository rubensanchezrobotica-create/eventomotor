import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import RegionalLandingPreview from "@/components/preview/regions/RegionalLandingPreview";
import {
  assertRegionalLandingModelTerritorial,
  buildRegionalInventoryFixture,
  buildRegionalLandingModel,
  buildRegionalPreviewMetadata,
  isRegionalPreviewAvailable,
  isRegionalPreviewId,
  parseRegionalLandingQuery,
  regionalFixtureId,
  regionalFixtureNow,
} from "@/components/preview/regions/regional-landing-model";
import regionalWideFixtureEvents from "@/data/eventomotor-events-2026-seed-84.json";
import madridNoWeekendFixtureEvents from "@/data/eventomotor-rallyes-coches-2026-seed-77.json";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import type { EventItem } from "@/types/event";

type RegionalPreviewRouteProps = {
  params: Promise<{ region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: RegionalPreviewRouteProps): Promise<Metadata> {
  const { region } = await params;
  return buildRegionalPreviewMetadata(region);
}

export default async function RegionalPreviewRoute({
  params,
  searchParams,
}: RegionalPreviewRouteProps) {
  await connection();

  if (!isRegionalPreviewAvailable(process.env.VERCEL_ENV)) notFound();

  const { region } = await params;
  if (!isRegionalPreviewId(region)) notFound();

  const [events, queryParams] = await Promise.all([
    getVisibleEvents(),
    searchParams,
  ]);
  // getVisibleEvents already applies the public visibility contract. Marking the
  // normalized input explicitly keeps the shared model strict, including when
  // the reader falls back to local events whose legacy records omit this field.
  const visibleEvents = events.map((event) => ({ ...event, visible: true }));
  const fixture = regionalFixtureId(queryParams);
  const now = regionalFixtureNow(fixture, new Date());
  const fixtureEvents = fixture === "cataluna-amplia"
    || fixture === "un-evento"
    || fixture === "dos-eventos"
    || fixture === "seis-eventos"
    ? regionalWideFixtureEvents
    : fixture === "madrid-sin-finde"
      || fixture === "madrid-sin-futuros"
      ? madridNoWeekendFixtureEvents
      : fixture === "aislamiento-territorial"
        ? [...regionalWideFixtureEvents, ...madridNoWeekendFixtureEvents]
      : visibleEvents;
  const inventoryModel = buildRegionalLandingModel(
    (fixtureEvents as EventItem[]).map((event) => ({ ...event, visible: true })),
    region,
    now,
  );
  const model = assertRegionalLandingModelTerritorial(
    buildRegionalInventoryFixture(inventoryModel, fixture),
  );
  const pathname = `/preview/regiones/${region}`;
  const query = parseRegionalLandingQuery(queryParams);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      { "@type": "ListItem", position: 2, name: model.config.h1, item: `${SITE_URL}${pathname}` },
    ],
  };
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: model.config.h1,
    description: model.config.description,
    url: `${SITE_URL}${pathname}`,
  };
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: model.config.h1,
    itemListElement: model.upcomingEvents.slice(0, 20).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: event.title,
      url: `${SITE_URL}/evento/${event.slug || event.id}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd).replace(/</g, "\\u003c") }}
      />
      {model.upcomingTotal ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <RegionalLandingPreview model={model} pathname={pathname} query={query} />
    </>
  );
}
