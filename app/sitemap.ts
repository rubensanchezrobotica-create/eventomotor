import type { MetadataRoute } from "next";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";
import { OPPORTUNITY_PAGES } from "@/lib/opportunity-pages";
import { SEO_DISCIPLINES, SEO_ZONES } from "@/lib/seo-taxonomy";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

function sitemapEntry(
  path: string,
  lastModified: Date,
  changeFrequency: ChangeFrequency,
  priority: number,
) {
  return {
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getVisibleEvents();
  const now = new Date();
  const staticEntries = [
    sitemapEntry("/", now, "daily", 1),
    sitemapEntry("/calendario", now, "daily", 0.95),
    sitemapEntry("/contacto", now, "monthly", 0.6),
    sitemapEntry("/publicar-evento", now, "monthly", 0.7),
    sitemapEntry("/aviso-legal", now, "yearly", 0.3),
    sitemapEntry("/privacidad", now, "yearly", 0.3),
    sitemapEntry("/cookies", now, "yearly", 0.3),
    sitemapEntry("/disciplinas", now, "weekly", 0.8),
    sitemapEntry("/zonas", now, "weekly", 0.8),
  ];
  const taxonomyEntries = [
    ...SEO_DISCIPLINES.map((discipline) =>
      sitemapEntry(`/disciplinas/${discipline.slug}`, now, "weekly", 0.75),
    ),
    ...SEO_ZONES.map((zone) =>
      sitemapEntry(`/zonas/${zone.slug}`, now, "weekly", 0.75),
    ),
  ];
  const opportunityEntries = OPPORTUNITY_PAGES.map((page) =>
    sitemapEntry(`/${page.slug}`, now, "daily", 0.85),
  );
  const eventEntries = events
    .filter((event) => Boolean(event.slug))
    .map((event) =>
      sitemapEntry(`/evento/${event.slug}`, new Date(event.start), "weekly", 0.7),
    );

  return [...staticEntries, ...taxonomyEntries, ...opportunityEntries, ...eventEntries];
}
