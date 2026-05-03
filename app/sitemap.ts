import type { MetadataRoute } from "next";
import { getListingLinks } from "@/lib/event-listing-slugs";
import { getVisibleEvents } from "@/lib/public-events";
import { getSiteUrl } from "@/lib/site-url";

type ChangeFrequency = MetadataRoute.Sitemap[number]["changeFrequency"];

function sitemapEntry(
  path: string,
  lastModified: Date,
  changeFrequency: ChangeFrequency,
  priority: number,
) {
  return {
    url: `${getSiteUrl()}${path}`,
    lastModified,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await getVisibleEvents();
  const links = getListingLinks(events);
  const now = new Date();
  const staticEntries = [
    sitemapEntry("/", now, "daily", 1),
    sitemapEntry("/eventos-moto", now, "daily", 0.9),
  ];
  const listingEntries = [...links.disciplines, ...links.regions].map((link) =>
    sitemapEntry(`/eventos-moto/${link.slug}`, now, "weekly", 0.8),
  );
  const eventEntries = events
    .filter((event) => Boolean(event.slug))
    .map((event) =>
      sitemapEntry(`/evento/${event.slug}`, new Date(event.start), "weekly", 0.7),
    );

  return [...staticEntries, ...listingEntries, ...eventEntries];
}
